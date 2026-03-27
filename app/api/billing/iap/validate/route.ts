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

async function upsertAccessGrant(admin: ReturnType<typeof sbAdmin>, args: {
  deviceHash: string
  userId?: string | null
  planId: string
  paidUntilIso: string
}) {
  // never regress: read the current paid_until before writing
  let finalIso = args.paidUntilIso
  try {
    const { data } = await admin
      .from("access_grants")
      .select("paid_until")
      .eq("device_hash", args.deviceHash)
      .limit(1)
      .maybeSingle()

    const existingIso = (data as any)?.paid_until as string | undefined
    if (existingIso) {
      const ex = Date.parse(existingIso)
      const nu = Date.parse(args.paidUntilIso)
      if (!Number.isNaN(ex) && !Number.isNaN(nu) && ex > nu) finalIso = existingIso
    }
  } catch {}

  const base: any = {
    device_hash: args.deviceHash,
    plan_id: args.planId,
    paid_until: finalIso,
    subscription_status: "active",
    source: "iap",
    updated_at: new Date().toISOString(),
  }
  if (args.userId) base.user_id = args.userId

  const attempts: any[] = [
    base,
    (() => { const x = { ...base }; delete x.source; return x })(),
    (() => { const x = { ...base }; delete x.source; delete x.subscription_status; delete x.user_id; return x })(),
    { device_hash: args.deviceHash, paid_until: finalIso, updated_at: new Date().toISOString() },
  ]

  let lastErr: any = null
  for (const payload of attempts) {
    const { error } = await admin.from("access_grants").upsert(payload, { onConflict: "device_hash" } as any)
    if (!error) return finalIso
    lastErr = error
  }
  throw new Error(`access_grants upsert failed: ${String(lastErr?.message || lastErr)}`)
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
  const key = JSON.parse(raw)
  const clientEmail = key.client_email
  const privateKey = key.private_key
  if (!clientEmail || !privateKey) throw new Error("Invalid GOOGLE_PLAY_SERVICE_ACCOUNT_JSON")

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

async function verifyGoogle(productId: string, purchaseToken: string) {
  const accessToken = await googleAccessToken()
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(ANDROID_PKG)}` +
    `/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`

  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } })
  const txt = await res.text()
  let j: any
  try { j = JSON.parse(txt) } catch { j = { _raw: txt } }

  if (!res.ok) return { ok: false as const, error: `google_http_${res.status}` }

  const expiresMs = Number(j?.expiryTimeMillis || 0)
  const paymentState = j?.paymentState
  if (!expiresMs || expiresMs <= Date.now()) return { ok: false as const, error: "google_expired" }
  if (paymentState !== undefined && ![1, 2].includes(Number(paymentState))) {
    return { ok: false as const, error: `google_payment_state_${String(paymentState)}` }
  }

  const tx = (j?.orderId || null) as string | null
  return { ok: true as const, expiresMs, transactionId: tx }
}

export async function POST(req: NextRequest) {
  const admin = sbAdmin()
  const userId = tryGetUserId(req)

  try {
    const body = await req.json().catch(() => ({} as any))
    const { platform, productId, transactionReceipt, transactionId } = body || {}

    if (!platform || !productId || !transactionReceipt) return json({ ok: false, error: "missing_fields" }, 400)
    if (platform !== "ios" && platform !== "android") return json({ ok: false, error: "invalid_platform" }, 400)

    const deviceHash = req.headers.get("x-device-hash") || ""
    if (!deviceHash) return json({ ok: false, error: "missing_device_hash" }, 400)

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
      })
      return json({ ok: false, error: err || "invalid_receipt" }, 400)
    }

    const paidUntilIso = new Date(expiresMs).toISOString()
    await upsertAccessGrant(admin, { deviceHash, userId, planId, paidUntilIso })

    await logOrder(admin, {
      deviceHash,
      status: "iap_valid",
      platform,
      productId,
      transactionId: txId,
      expiresMs,
      receiptLength: receiptLen,
      error: null,
    })

    return json({ ok: true, paid_until: paidUntilIso, platform, productId })
  } catch (e: any) {
    return json({ ok: false, error: "iap_validate_failed", details: String(e?.message || e) }, 500)
  }
}
