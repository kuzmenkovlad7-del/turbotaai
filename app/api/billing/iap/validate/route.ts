import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const APPLE_PROD_URL = "https://buy.itunes.apple.com/verifyReceipt"
const APPLE_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const ANDROID_PKG = "com.turbotaai.app"
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/androidpublisher"

function mustEnv(name: string) {
  const v = (process.env[name] || "").trim()
  if (!v) throw new Error("Missing env " + name)
  return v
}

function sbAdmin() {
  return createClient(
    mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
    mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } })
}

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
}

function planIdFromProduct(productId: string) {
  return productId.includes("yearly") ? "yearly" : "monthly"
}

function tryGetUserId(req: NextRequest) {
  const auth = req.headers.get("authorization") || ""
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  const token = m[1].trim()
  const parts = token.split(".")
  if (parts.length < 2) return null
  try {
    const payloadJson = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    const payload = JSON.parse(payloadJson)
    return (payload.sub || payload.user_id || payload.uid || null) as string | null
  } catch {
    return null
  }
}

async function logOrder(admin: ReturnType<typeof sbAdmin>, args: {
  deviceHash: string
  status: "iap_valid" | "iap_invalid"
  platform: "ios" | "android"
  productId: string
  transactionId?: string | null
  expiresMs?: number | null
  receiptLength?: number | null
  error?: string | null
}) {
  const nowIso = new Date().toISOString()
  await admin.from("billing_orders").insert({
    order_reference: `IAP-${args.platform}-${Date.now()}`,
    status: args.status,
    plan_id: planIdFromProduct(args.productId),
    amount: 0,
    currency: "IAP",
    device_hash: args.deviceHash,
    raw: {
      __event: "iap_validate",
      platform: args.platform,
      productId: args.productId,
      transactionId: args.transactionId || null,
      expiresMs: args.expiresMs ?? null,
      receiptLength: args.receiptLength ?? null,
      error: args.error || null,
    },
    created_at: nowIso,
    updated_at: nowIso,
  } as any)
}

/**
 * Extend paid_until on a single access_grants row (by device_hash key).
 * Mirrors the extendPaidUntil pattern used in the WayForPay callback:
 *   - writes `paid_until` (correct column, not `access_until`)
 *   - zeroes `trial_questions_left`
 *   - never regresses an already-later paid_until
 *
 * The `userId` parameter controls user_id assignment:
 *   - non-null: on INSERT the row is created with user_id=userId; on UPDATE
 *     user_id is only set when existing.user_id is null (never overwrites).
 *   - null: user_id is neither inserted nor updated. Used for device-hash
 *     rows — the canonical user_id lives on the account:${userId} row to
 *     respect the access_grants_user_id_uq unique constraint.
 */
async function extendGrant(
  admin: ReturnType<typeof sbAdmin>,
  key: string,
  userId: string | null,
  paidUntilIso: string,
  nowIso: string,
) {
  console.log(`[iap/validate] extendGrant start key=${key.slice(0, 20)}... userId=${userId ?? "null"} paidUntilIso=${paidUntilIso}`)

  const { data: rows, error: selectErr } = await admin
    .from("access_grants")
    .select("id,paid_until,user_id")
    .eq("device_hash", key)
    .order("updated_at", { ascending: false })
    .limit(1)

  if (selectErr) {
    console.error(`[iap/validate] extendGrant select error key=${key.slice(0, 20)}:`, selectErr.message)
  }

  const existing = Array.isArray(rows) ? rows[0] : null
  console.log(`[iap/validate] extendGrant existing=${existing ? `id=${existing.id} paid_until=${existing.paid_until} user_id=${existing.user_id ?? "null"}` : "none"}`)

  const curMs = existing?.paid_until ? Date.parse(String(existing.paid_until)) : 0
  const newMs = Date.parse(paidUntilIso)
  // Never regress: if current expiry is already later, keep it.
  // Guard: existing may be null when no row exists yet — use paidUntilIso in that case.
  const finalPaidUntil = (existing && !Number.isNaN(curMs) && curMs > newMs)
    ? String(existing.paid_until)
    : paidUntilIso

  console.log(`[iap/validate] extendGrant finalPaidUntil=${finalPaidUntil} curMs=${curMs} newMs=${newMs}`)

  if (existing?.id) {
    const patch: Record<string, any> = {
      paid_until: finalPaidUntil,
      trial_questions_left: 0,
      updated_at: nowIso,
    }
    // Only attach user_id on UPDATE when explicitly requested (userId non-null)
    // AND the existing row has no user_id yet. Prevents overwriting and avoids
    // violating the access_grants_user_id_uq unique constraint.
    if (userId && !existing.user_id) patch.user_id = userId
    const { error: updateErr } = await admin.from("access_grants").update(patch).eq("id", existing.id)
    if (updateErr) {
      console.error(`[iap/validate] extendGrant update error key=${key.slice(0, 20)}:`, updateErr.message)
    } else {
      console.log(`[iap/validate] extendGrant update OK key=${key.slice(0, 20)}`)
    }
  } else {
    // Row doesn't exist yet — insert it. user_id is whatever the caller passed
    // (may be null for device-hash rows).
    const { error: insertErr } = await admin.from("access_grants").insert({
      id: crypto.randomUUID(),
      device_hash: key,
      user_id: userId,
      paid_until: finalPaidUntil,
      promo_until: null,
      trial_questions_left: 0,
      created_at: nowIso,
      updated_at: nowIso,
    } as any)
    if (insertErr) {
      console.error(`[iap/validate] extendGrant insert error key=${key.slice(0, 20)}:`, insertErr.message)
    } else {
      console.log(`[iap/validate] extendGrant insert OK key=${key.slice(0, 20)}`)
    }
  }

  return finalPaidUntil
}

/**
 * Grant paid access after a successful IAP validation.
 *
 * Canonical design (respecting access_grants_user_id_uq):
 *   - The single row carrying user_id for this account is at
 *     device_hash = "account:<userId>".  This is the source-of-truth grant.
 *   - The purchase-device row (device_hash = X-Device-Hash) keeps paid_until
 *     for offline / bootstrap parity but NEVER carries user_id.
 *   - profiles.paid_until is mirrored for web parity.
 *
 * Bootstrap (buildAccessSummary) reads both rows and merges paid_until via
 * laterIso(), so having both rows updated keeps the device immediately paid
 * even if the user later signs out or uses another device.
 *
 * Self-healing: if a previous run placed user_id on the device-hash row
 * (the bug this refactor fixes), we detect the conflict row and clear its
 * user_id before writing the canonical account row.
 */
async function grantPaidAccess(admin: ReturnType<typeof sbAdmin>, args: {
  deviceHash: string
  userId: string | null
  paidUntilIso: string
}) {
  const nowIso = new Date().toISOString()
  console.log(`[iap/validate] grantPaidAccess start deviceHash=...${args.deviceHash.slice(-8)} userId=${args.userId ?? "null"} paidUntilIso=${args.paidUntilIso}`)

  if (!args.userId) {
    // Anonymous / logged-out device: only the device grant can be written.
    console.log(`[iap/validate] grantPaidAccess anonymous — writing device grant only`)
    await extendGrant(admin, args.deviceHash, null, args.paidUntilIso, nowIso)
    return
  }

  const accountKey = `account:${args.userId}`

  // ── STEP 1: Clear conflicting user_id on any non-canonical row ───────────
  // The unique constraint access_grants_user_id_uq permits only one row per
  // user_id.  Old runs of this endpoint accidentally placed user_id on the
  // device-hash row, so the canonical account row could not be inserted.
  // Free the slot before writing below.
  {
    const { data: conflicts, error: confErr } = await admin
      .from("access_grants")
      .select("id,device_hash,user_id,paid_until")
      .eq("user_id", args.userId)
      .neq("device_hash", accountKey)

    if (confErr) {
      console.error(`[iap/validate] grantPaidAccess conflict-scan error:`, confErr.message)
    }

    const conflictCount = Array.isArray(conflicts) ? conflicts.length : 0
    console.log(`[iap/validate] grantPaidAccess conflict rows: ${conflictCount}`)

    for (const c of conflicts || []) {
      const { error } = await admin
        .from("access_grants")
        .update({ user_id: null, updated_at: nowIso } as any)
        .eq("id", c.id)
      if (error) {
        console.error(`[iap/validate] grantPaidAccess clear user_id id=${c.id} error:`, error.message)
      } else {
        console.log(`[iap/validate] grantPaidAccess cleared user_id from conflict row id=${c.id} device_hash=${String(c.device_hash).slice(0, 20)}...`)
      }
    }
  }

  // ── STEP 2: Write canonical account grant (single source of truth) ───────
  console.log(`[iap/validate] grantPaidAccess writing canonical account grant: ${accountKey}`)
  await extendGrant(admin, accountKey, args.userId, args.paidUntilIso, nowIso)

  // ── STEP 3: Mirror paid_until on device-hash row for bootstrap parity ───
  // Pass userId=null so extendGrant never places user_id on the device row,
  // preserving the invariant that only the canonical row holds user_id.
  console.log(`[iap/validate] grantPaidAccess mirroring paid_until onto device grant: ...${args.deviceHash.slice(-8)}`)
  await extendGrant(admin, args.deviceHash, null, args.paidUntilIso, nowIso)

  // ── STEP 4: Update profiles for web parity (matches WayForPay callback) ──
  console.log(`[iap/validate] grantPaidAccess profiles update start userId=${args.userId}`)
  try {
    const { error: profileErr } = await admin
      .from("profiles")
      .update({
        paid_until: args.paidUntilIso,
        subscription_status: "active",
        auto_renew: true,
        updated_at: nowIso,
      } as any)
      .eq("id", args.userId)
    if (profileErr) {
      console.error(`[iap/validate] grantPaidAccess profiles update error:`, profileErr.message)
    } else {
      console.log(`[iap/validate] grantPaidAccess profiles update OK userId=${args.userId}`)
    }
  } catch (e: any) {
    // Non-fatal: bootstrap will re-sync on next call
    console.error(`[iap/validate] grantPaidAccess profiles update exception:`, e?.message)
  }
}

async function verifyApple(productId: string, receiptData: string) {
  const password = mustEnv("APPLE_IAP_SHARED_SECRET")

  const call = async (url: string) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        "receipt-data": receiptData,
        password,
        "exclude-old-transactions": true,
      }),
    })
    const txt = await res.text()
    let j: any
    try { j = JSON.parse(txt) } catch { j = { status: -1, raw: txt } }
    return j
  }

  let data = await call(APPLE_PROD_URL)
  if (data?.status === 21007) data = await call(APPLE_SANDBOX_URL)

  if (!data || data.status !== 0) return { ok: false as const, error: `apple_status_${String(data?.status)}` }

  const infos: any[] = Array.isArray(data.latest_receipt_info) ? data.latest_receipt_info : []
  const now = Date.now()

  const candidates = infos
    .filter(i => i?.product_id === productId)
    .map(i => ({
      expiresMs: Number(i?.expires_date_ms || 0),
      tx: (i?.original_transaction_id || i?.transaction_id || null) as string | null,
    }))
    .filter(x => x.expiresMs > now)
    .sort((a, b) => b.expiresMs - a.expiresMs)

  if (!candidates.length) return { ok: false as const, error: "apple_no_active_subscription" }
  return { ok: true as const, expiresMs: candidates[0].expiresMs, transactionId: candidates[0].tx }
}

async function googleAccessToken() {
  console.log(`[iap/validate] googleAccessToken start`)

  const rawEnv = process.env["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"] || ""
  if (!rawEnv.trim()) {
    console.error(`[iap/validate] googleAccessToken GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is MISSING or empty`)
    throw new Error("Missing env GOOGLE_PLAY_SERVICE_ACCOUNT_JSON")
  }
  console.log(`[iap/validate] googleAccessToken env present length=${rawEnv.trim().length}`)

  let key: any
  try {
    key = JSON.parse(rawEnv)
  } catch (e: any) {
    console.error(`[iap/validate] googleAccessToken JSON.parse failed:`, e?.message)
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON")
  }

  const clientEmail = key.client_email
  const privateKey = key.private_key
  if (!clientEmail || !privateKey) {
    console.error(`[iap/validate] googleAccessToken missing client_email=${!!clientEmail} private_key=${!!privateKey}`)
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON missing client_email or private_key")
  }
  console.log(`[iap/validate] googleAccessToken client_email=${clientEmail}`)

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: "RS256", typ: "JWT" }
  const claim = { iss: clientEmail, scope: GOOGLE_SCOPE, aud: GOOGLE_TOKEN_URL, iat: now, exp: now + 3600 }

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`
  const sig = crypto.sign("RSA-SHA256", Buffer.from(signingInput), privateKey)
  const jwt = `${signingInput}.${b64url(sig)}`

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  })

  console.log(`[iap/validate] googleAccessToken fetching token from ${GOOGLE_TOKEN_URL}`)
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  })

  const j: any = await res.json().catch(() => ({}))
  if (!j.access_token) {
    console.error(`[iap/validate] googleAccessToken oauth failed status=${res.status} response=${JSON.stringify(j).slice(0, 400)}`)
    throw new Error(`google_oauth_failed: ${JSON.stringify(j).slice(0, 400)}`)
  }

  console.log(`[iap/validate] googleAccessToken OK token_type=${j.token_type} expires_in=${j.expires_in}`)
  return j.access_token as string
}

/**
 * Validate a Google Play subscription purchase token.
 *
 * Tries purchases.subscriptionsv2.get first (correct for new base-plan/offer
 * subscriptions created in the new Google Play Billing model).
 * Falls back to the legacy purchases.subscriptions.get (v1) for older products.
 *
 * subscriptionsv2 response shape:
 *   { subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", lineItems: [{ productId, expiryTime }], latestOrderId }
 *
 * v1 response shape:
 *   { expiryTimeMillis, paymentState, orderId }
 */
async function verifyGoogle(
  productId: string,
  purchaseToken: string,
): Promise<{ ok: true; expiresMs: number; transactionId: string | null } | { ok: false; error: string }> {
  const tokenSuffix = purchaseToken.slice(-12)
  console.log(`[iap/validate] verifyGoogle start productId=${productId} token=...${tokenSuffix}`)

  const accessToken = await googleAccessToken()
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(ANDROID_PKG)}`

  // ── Try subscriptionsv2 (new billing model with base plans / offers) ──────
  const v2Url = `${base}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`
  console.log(`[iap/validate] verifyGoogle v2 GET ${v2Url.replace(purchaseToken, `...${tokenSuffix}`)}`)

  const v2Res = await fetch(v2Url, { headers: { authorization: `Bearer ${accessToken}` } })
  console.log(`[iap/validate] verifyGoogle v2 response status=${v2Res.status}`)

  if (v2Res.ok) {
    let j: any
    try { j = await v2Res.json() } catch { j = {} }

    console.log(`[iap/validate] verifyGoogle v2 body subscriptionState=${j?.subscriptionState} lineItems=${JSON.stringify(j?.lineItems)?.slice(0, 200)}`)

    const lineItems: any[] = Array.isArray(j?.lineItems) ? j.lineItems : []
    // Prefer the line item matching our productId; fall back to first item
    const item = lineItems.find((li: any) => li.productId === productId) ?? lineItems[0] ?? null

    const expiryIso: string | null = item?.expiryTime ?? null
    const expiresMs = expiryIso ? Date.parse(expiryIso) : 0

    console.log(`[iap/validate] verifyGoogle v2 item=${JSON.stringify(item)} expiryIso=${expiryIso} expiresMs=${expiresMs} now=${Date.now()}`)

    if (!expiresMs || expiresMs <= Date.now()) {
      console.error(`[iap/validate] verifyGoogle v2 expired expiresMs=${expiresMs}`)
      return { ok: false, error: "google_expired" }
    }

    // subscriptionState values: SUBSCRIPTION_STATE_ACTIVE, SUBSCRIPTION_STATE_IN_GRACE_PERIOD, etc.
    const state = String(j?.subscriptionState ?? "")
    const ACTIVE_STATES = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", ""]
    if (state && !ACTIVE_STATES.includes(state)) {
      console.error(`[iap/validate] verifyGoogle v2 inactive state=${state}`)
      return { ok: false, error: `google_state_${state}` }
    }

    const tx = (j?.latestOrderId ?? item?.purchaseToken ?? null) as string | null
    console.log(`[iap/validate] verifyGoogle v2 OK expiresMs=${expiresMs} transactionId=${tx}`)
    return { ok: true, expiresMs, transactionId: tx }
  }

  // ── Fallback: legacy purchases.subscriptions v1 ───────────────────────────
  console.log(`[iap/validate] verifyGoogle v2 failed (${v2Res.status}), falling back to v1`)
  const v1Url = `${base}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`
  console.log(`[iap/validate] verifyGoogle v1 GET ${v1Url.replace(purchaseToken, `...${tokenSuffix}`)}`)

  const v1Res = await fetch(v1Url, { headers: { authorization: `Bearer ${accessToken}` } })
  const v1Txt = await v1Res.text()
  console.log(`[iap/validate] verifyGoogle v1 response status=${v1Res.status} body=${v1Txt.slice(0, 300)}`)

  let j1: any
  try { j1 = JSON.parse(v1Txt) } catch { j1 = { _raw: v1Txt } }

  if (!v1Res.ok) {
    console.error(`[iap/validate] verifyGoogle v1 HTTP error status=${v1Res.status}`)
    return { ok: false, error: `google_http_${v1Res.status}` }
  }

  const expiresMs = Number(j1?.expiryTimeMillis || 0)
  console.log(`[iap/validate] verifyGoogle v1 expiryTimeMillis=${j1?.expiryTimeMillis} expiresMs=${expiresMs} now=${Date.now()}`)

  if (!expiresMs || expiresMs <= Date.now()) {
    console.error(`[iap/validate] verifyGoogle v1 expired expiresMs=${expiresMs}`)
    return { ok: false, error: "google_expired" }
  }

  const paymentState = j1?.paymentState
  // paymentState: 0=pending, 1=paid, 2=free trial. Accept 1 and 2.
  if (paymentState !== undefined && ![1, 2].includes(Number(paymentState))) {
    console.error(`[iap/validate] verifyGoogle v1 bad paymentState=${paymentState}`)
    return { ok: false, error: `google_payment_state_${String(paymentState)}` }
  }

  const tx = (j1?.orderId ?? null) as string | null
  console.log(`[iap/validate] verifyGoogle v1 OK expiresMs=${expiresMs} transactionId=${tx}`)
  return { ok: true, expiresMs, transactionId: tx }
}

export async function POST(req: NextRequest) {
  // Validate required headers / env early for clear error messages
  const deviceHash = req.headers.get("x-device-hash") || ""
  if (!deviceHash) return json({ ok: false, error: "missing_device_hash" }, 400)

  console.log(`[iap/validate] POST start deviceHash=...${deviceHash.slice(-8)}`)

  const admin = sbAdmin()
  const userId = tryGetUserId(req)
  console.log(`[iap/validate] userId=${userId ?? "null (unauthenticated)"}`)

  try {
    const body = await req.json().catch(() => ({} as any))
    const { platform, productId, transactionReceipt, transactionId } = body || {}

    console.log(`[iap/validate] body platform=${platform} productId=${productId} receiptLength=${String(transactionReceipt || "").length} transactionId=${transactionId ?? "null"}`)

    if (!platform || !productId || !transactionReceipt) return json({ ok: false, error: "missing_fields" }, 400)
    if (platform !== "ios" && platform !== "android") return json({ ok: false, error: "invalid_platform" }, 400)

    const planId = planIdFromProduct(String(productId))
    const receiptLen = String(transactionReceipt).length

    console.log(`[iap/validate] planId=${planId} receiptLen=${receiptLen}`)

    let expiresMs = 0
    let txId: string | null = transactionId || null
    let err: string | null = null

    if (platform === "ios") {
      console.log(`[iap/validate] verifyApple start productId=${productId}`)
      const r = await verifyApple(String(productId), String(transactionReceipt))
      console.log(`[iap/validate] verifyApple result ok=${r.ok} ${r.ok ? `expiresMs=${r.expiresMs}` : `error=${r.error}`}`)
      if (!r.ok) err = r.error
      else { expiresMs = r.expiresMs; txId = txId || r.transactionId || null }
    } else {
      // Android: transactionReceipt may arrive in two forms:
      //
      //   (a) Raw purchaseToken string — sent by syncExistingPurchases / recovery path,
      //       which already extracts purchase.purchaseToken before calling this endpoint.
      //
      //   (b) JSON-serialised purchase object — sent by the main purchase() flow, where
      //       react-native-iap sets purchase.transactionReceipt = JSON.stringify(purchase).
      //       The mobile code picks transactionReceipt before purchaseToken as the field
      //       name, so the full JSON blob ends up in this field.
      //
      // In case (b) the Google API receives the full JSON string as the token path
      // segment, which returns 400/404 immediately.  We unwrap it here so the backend
      // always forwards only the raw purchaseToken regardless of which mobile path sent it.
      let rawToken = String(transactionReceipt)
      let receiptParseNote = "raw_token"
      try {
        const parsed = JSON.parse(rawToken)
        if (parsed && typeof parsed === "object" && typeof parsed.purchaseToken === "string" && parsed.purchaseToken) {
          rawToken = parsed.purchaseToken
          receiptParseNote = "extracted_from_json"
          // Also recover orderId / transactionId from the serialised receipt if the
          // caller did not supply a separate transactionId field.
          if (!txId) {
            txId = (parsed.orderId || parsed.transactionId) ?? null
          }
        }
      } catch {
        // Not JSON — already a raw token, use as-is
      }
      console.log(`[iap/validate] android receiptParse=${receiptParseNote} tokenSuffix=...${rawToken.slice(-12)}`)
      const r = await verifyGoogle(String(productId), rawToken)
      console.log(`[iap/validate] verifyGoogle result ok=${r.ok} ${r.ok ? `expiresMs=${r.expiresMs}` : `error=${r.error}`}`)
      if (!r.ok) err = r.error
      else { expiresMs = r.expiresMs; txId = txId || r.transactionId || null }
    }

    if (!expiresMs || err) {
      console.error(`[iap/validate] validation failed err=${err} expiresMs=${expiresMs}`)
      await logOrder(admin, {
        deviceHash,
        status: "iap_invalid",
        platform,
        productId,
        transactionId: txId,
        expiresMs: expiresMs || null,
        receiptLength: receiptLen,
        error: err || "invalid_receipt",
      }).catch(() => {})
      return json({ ok: false, error: err || "invalid_receipt" }, 400)
    }

    const paidUntilIso = new Date(expiresMs).toISOString()
    console.log(`[iap/validate] paidUntilIso=${paidUntilIso} — granting access`)

    // Grant access: update device grant, account grant, and profiles
    await grantPaidAccess(admin, { deviceHash, userId, paidUntilIso })

    console.log(`[iap/validate] logOrder iap_valid start`)
    await logOrder(admin, {
      deviceHash,
      status: "iap_valid",
      platform,
      productId,
      transactionId: txId,
      expiresMs,
      receiptLength: receiptLen,
      error: null,
    }).catch((e: any) => console.error(`[iap/validate] logOrder error:`, e?.message))

    console.log(`[iap/validate] POST success productId=${productId} paidUntil=${paidUntilIso}`)
    return json({ ok: true, paid_until: paidUntilIso, platform, productId })
  } catch (e: any) {
    // Surface the actual error message so it's visible in server logs
    // and in the mobile debug panel (DEBUG_ENABLED=true)
    console.error("[iap/validate] unhandled error:", e?.message ?? e)
    console.error("[iap/validate] stack:", e?.stack ?? "(no stack)")
    return json({ ok: false, error: "iap_validate_failed", details: String(e?.message || e) }, 500)
  }
}
