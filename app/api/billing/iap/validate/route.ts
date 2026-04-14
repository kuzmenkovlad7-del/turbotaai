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
 */
async function extendGrant(
  admin: ReturnType<typeof sbAdmin>,
  key: string,
  userId: string | null,
  paidUntilIso: string,
  nowIso: string,
) {
  const { data: rows } = await admin
    .from("access_grants")
    .select("id,paid_until,user_id")
    .eq("device_hash", key)
    .order("updated_at", { ascending: false })
    .limit(1)

  const existing = Array.isArray(rows) ? rows[0] : null
  const curMs = existing?.paid_until ? Date.parse(String(existing.paid_until)) : 0
  const newMs = Date.parse(paidUntilIso)
  // Never regress: if current expiry is already later, keep it.
  // Guard: existing may be null when no row exists yet — use paidUntilIso in that case.
  const finalPaidUntil = (existing && !Number.isNaN(curMs) && curMs > newMs)
    ? String(existing.paid_until)
    : paidUntilIso

  if (existing?.id) {
    const patch: Record<string, any> = {
      paid_until: finalPaidUntil,
      trial_questions_left: 0,
      updated_at: nowIso,
    }
    if (userId && !existing.user_id) patch.user_id = userId
    await admin.from("access_grants").update(patch).eq("id", existing.id)
  } else {
    // Row doesn't exist yet — insert it
    await admin.from("access_grants").insert({
      id: crypto.randomUUID(),
      device_hash: key,
      user_id: userId,
      paid_until: finalPaidUntil,
      promo_until: null,
      trial_questions_left: 0,
      created_at: nowIso,
      updated_at: nowIso,
    } as any)
  }

  return finalPaidUntil
}

/**
 * Grant paid access to the user after a successful IAP validation.
 *
 * Updates three places to ensure mobile AND web both show paid access
 * immediately after the user taps "Refresh Access":
 *   1. Device grant (keyed by X-Device-Hash) — mobile bootstrap reads this
 *   2. Account grant (keyed by account:<userId>) — shared across devices
 *   3. profiles.paid_until — web subscription page reads this
 */
async function grantPaidAccess(admin: ReturnType<typeof sbAdmin>, args: {
  deviceHash: string
  userId: string | null
  paidUntilIso: string
}) {
  const nowIso = new Date().toISOString()

  // 1. Device grant — always
  await extendGrant(admin, args.deviceHash, args.userId, args.paidUntilIso, nowIso)

  // 2. Account grant + profiles — only when user is authenticated
  if (args.userId) {
    const accountKey = `account:${args.userId}`
    await extendGrant(admin, accountKey, args.userId, args.paidUntilIso, nowIso)

    // 3. Update profiles for web parity (matches WayForPay callback behaviour)
    try {
      await admin
        .from("profiles")
        .update({
          paid_until: args.paidUntilIso,
          subscription_status: "active",
          auto_renew: true,
          updated_at: nowIso,
        } as any)
        .eq("id", args.userId)
    } catch {
      // Non-fatal: bootstrap will sync on next call
    }
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
  const raw = mustEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON")
  let key: any
  try {
    key = JSON.parse(raw)
  } catch {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON")
  }
  const clientEmail = key.client_email
  const privateKey = key.private_key
  if (!clientEmail || !privateKey) throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON missing client_email or private_key")

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

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  })

  const j: any = await res.json().catch(() => ({}))
  if (!j.access_token) throw new Error(`google_oauth_failed: ${JSON.stringify(j).slice(0, 400)}`)
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
  const accessToken = await googleAccessToken()
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(ANDROID_PKG)}`

  // ── Try subscriptionsv2 (new billing model with base plans / offers) ──────
  const v2Url = `${base}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`
  const v2Res = await fetch(v2Url, { headers: { authorization: `Bearer ${accessToken}` } })

  if (v2Res.ok) {
    let j: any
    try { j = await v2Res.json() } catch { j = {} }

    const lineItems: any[] = Array.isArray(j?.lineItems) ? j.lineItems : []
    // Prefer the line item matching our productId; fall back to first item
    const item = lineItems.find((li: any) => li.productId === productId) ?? lineItems[0] ?? null

    const expiryIso: string | null = item?.expiryTime ?? null
    const expiresMs = expiryIso ? Date.parse(expiryIso) : 0

    if (!expiresMs || expiresMs <= Date.now()) {
      return { ok: false, error: "google_expired" }
    }

    // subscriptionState values: SUBSCRIPTION_STATE_ACTIVE, SUBSCRIPTION_STATE_IN_GRACE_PERIOD, etc.
    const state = String(j?.subscriptionState ?? "")
    const ACTIVE_STATES = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", ""]
    if (state && !ACTIVE_STATES.includes(state)) {
      return { ok: false, error: `google_state_${state}` }
    }

    const tx = (j?.latestOrderId ?? item?.purchaseToken ?? null) as string | null
    return { ok: true, expiresMs, transactionId: tx }
  }

  // ── Fallback: legacy purchases.subscriptions v1 ───────────────────────────
  const v1Url = `${base}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`
  const v1Res = await fetch(v1Url, { headers: { authorization: `Bearer ${accessToken}` } })
  const v1Txt = await v1Res.text()
  let j1: any
  try { j1 = JSON.parse(v1Txt) } catch { j1 = { _raw: v1Txt } }

  if (!v1Res.ok) return { ok: false, error: `google_http_${v1Res.status}` }

  const expiresMs = Number(j1?.expiryTimeMillis || 0)
  if (!expiresMs || expiresMs <= Date.now()) return { ok: false, error: "google_expired" }

  const paymentState = j1?.paymentState
  // paymentState: 0=pending, 1=paid, 2=free trial. Accept 1 and 2.
  if (paymentState !== undefined && ![1, 2].includes(Number(paymentState))) {
    return { ok: false, error: `google_payment_state_${String(paymentState)}` }
  }

  const tx = (j1?.orderId ?? null) as string | null
  return { ok: true, expiresMs, transactionId: tx }
}

export async function POST(req: NextRequest) {
  // Validate required headers / env early for clear error messages
  const deviceHash = req.headers.get("x-device-hash") || ""
  if (!deviceHash) return json({ ok: false, error: "missing_device_hash" }, 400)

  const admin = sbAdmin()
  const userId = tryGetUserId(req)

  try {
    const body = await req.json().catch(() => ({} as any))
    const { platform, productId, transactionReceipt, transactionId } = body || {}

    if (!platform || !productId || !transactionReceipt) return json({ ok: false, error: "missing_fields" }, 400)
    if (platform !== "ios" && platform !== "android") return json({ ok: false, error: "invalid_platform" }, 400)

    const planId = planIdFromProduct(String(productId))
    const receiptLen = String(transactionReceipt).length

    let expiresMs = 0
    let txId: string | null = transactionId || null
    let err: string | null = null

    if (platform === "ios") {
      const r = await verifyApple(String(productId), String(transactionReceipt))
      if (!r.ok) err = r.error
      else { expiresMs = r.expiresMs; txId = txId || r.transactionId || null }
    } else {
      // Android: transactionReceipt is the purchaseToken from Google Play
      const r = await verifyGoogle(String(productId), String(transactionReceipt))
      if (!r.ok) err = r.error
      else { expiresMs = r.expiresMs; txId = txId || r.transactionId || null }
    }

    if (!expiresMs || err) {
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

    // Grant access: update device grant, account grant, and profiles
    await grantPaidAccess(admin, { deviceHash, userId, paidUntilIso })

    await logOrder(admin, {
      deviceHash,
      status: "iap_valid",
      platform,
      productId,
      transactionId: txId,
      expiresMs,
      receiptLength: receiptLen,
      error: null,
    }).catch(() => {})

    return json({ ok: true, paid_until: paidUntilIso, platform, productId })
  } catch (e: any) {
    // Surface the actual error message so it's visible in server logs
    // and in the mobile debug panel (DEBUG_ENABLED=true)
    console.error("[iap/validate] unhandled error:", e?.message ?? e)
    return json({ ok: false, error: "iap_validate_failed", details: String(e?.message || e) }, 500)
  }
}
