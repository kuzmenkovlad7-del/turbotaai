import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { randomUUID, createSign } from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ── Env helpers ────────────────────────────────────────────────────────────

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

// ── Date helper ────────────────────────────────────────────────────────────

function toDateOrNull(v: any): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}

// ── Plan duration ──────────────────────────────────────────────────────────

function planDays(productId: string): number {
  return productId.includes("yearly") ? 365 : 31
}

// ── Access grant (mirrors orders/status logic) ─────────────────────────────

async function extendGrantForDevice(
  admin: ReturnType<typeof sbAdmin>,
  deviceHash: string,
  productId: string,
  userId: string | null,
) {
  const now = new Date()
  const nowIso = now.toISOString()
  const days = planDays(productId)

  const { data: rows } = await admin
    .from("access_grants")
    .select("id,paid_until,user_id")
    .eq("device_hash", deviceHash)
    .order("updated_at", { ascending: false })
    .limit(1)

  const existing = Array.isArray(rows) ? rows[0] : null
  const curPaid = toDateOrNull(existing?.paid_until)
  const target = new Date(now)
  target.setUTCDate(target.getUTCDate() + days)
  const nextIso =
    curPaid && curPaid.getTime() >= target.getTime()
      ? curPaid.toISOString()
      : target.toISOString()

  if (existing?.id) {
    const patch: Record<string, any> = {
      paid_until: nextIso,
      trial_questions_left: 0,
      subscription_status: "active",
      updated_at: nowIso,
    }
    if (userId && !existing.user_id) patch.user_id = userId
    await admin.from("access_grants").update(patch as any).eq("id", existing.id)
  } else {
    await admin.from("access_grants").insert({
      id: randomUUID(),
      device_hash: deviceHash,
      user_id: userId,
      paid_until: nextIso,
      promo_until: null,
      trial_questions_left: 0,
      subscription_status: "active",
      created_at: nowIso,
      updated_at: nowIso,
    } as any)
  }

  return nextIso
}

// ── iOS — Apple receipt verification ──────────────────────────────────────

async function verifyAppleReceipt(
  receipt: string,
): Promise<{ ok: boolean; resolvedProductId?: string }> {
  const sharedSecret = process.env.APPLE_IAP_SHARED_SECRET || ""
  const body = JSON.stringify({
    "receipt-data": receipt,
    password: sharedSecret,
    "exclude-old-transactions": true,
  })

  // Try production first; if Apple returns 21007 it's a sandbox receipt — retry
  const urls = [
    "https://buy.itunes.apple.com/verifyReceipt",
    "https://sandbox.itunes.apple.com/verifyReceipt",
  ]

  for (const url of urls) {
    let data: any
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        cache: "no-store",
      })
      data = await r.json()
    } catch (e: any) {
      console.error(`[IAP/iOS] verifyReceipt fetch error (${url}):`, e?.message)
      return { ok: false }
    }

    if (data.status === 21007) continue // sandbox receipt — try sandbox URL

    if (data.status !== 0) {
      console.warn(`[IAP/iOS] verifyReceipt status=${data.status}`)
      return { ok: false }
    }

    const now = Date.now()
    const latestReceipts: any[] = data.latest_receipt_info || []
    const active = latestReceipts
      .filter((ri) => Number(ri.expires_date_ms) > now)
      .sort((a, b) => Number(b.expires_date_ms) - Number(a.expires_date_ms))

    if (!active.length) {
      console.warn("[IAP/iOS] No active subscription found in receipt")
      return { ok: false }
    }

    return { ok: true, resolvedProductId: active[0].product_id }
  }

  return { ok: false }
}

// ── Android — Google Play verification (service account JWT, no extra deps) ─

async function getGoogleAccessToken(svc: {
  client_email: string
  private_key: string
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
  const claimset = Buffer.from(
    JSON.stringify({
      iss: svc.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }),
  ).toString("base64url")

  const signingInput = `${header}.${claimset}`
  const sign = createSign("RSA-SHA256")
  sign.update(signingInput)
  const sig = sign.sign(svc.private_key, "base64url")
  const jwt = `${signingInput}.${sig}`

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    cache: "no-store",
  })
  const tok = await res.json().catch(() => ({} as any))
  return tok.access_token || ""
}

async function verifyAndroidPurchase(
  packageName: string,
  productId: string,
  purchaseToken: string,
): Promise<{ ok: boolean; resolvedProductId?: string }> {
  const keyJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || ""
  if (!keyJson) {
    console.warn("[IAP/Android] GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not set")
    return { ok: false }
  }

  let svc: { client_email: string; private_key: string }
  try {
    svc = JSON.parse(keyJson)
  } catch {
    console.error("[IAP/Android] Failed to parse GOOGLE_PLAY_SERVICE_ACCOUNT_JSON")
    return { ok: false }
  }

  let accessToken: string
  try {
    accessToken = await getGoogleAccessToken(svc)
  } catch (e: any) {
    console.error("[IAP/Android] Failed to get Google access token:", e?.message)
    return { ok: false }
  }
  if (!accessToken) return { ok: false }

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!r.ok) {
    console.warn(`[IAP/Android] Play API ${r.status} for product=${productId}`)
    return { ok: false }
  }

  const data = await r.json().catch(() => ({} as any))
  const expiryMs = Number(data.expiryTimeMillis ?? 0)
  const paymentState = Number(data.paymentState ?? -1)

  if (expiryMs < Date.now()) return { ok: false }    // subscription expired
  if (paymentState !== 1 && paymentState !== 2) return { ok: false } // not paid / free trial

  return { ok: true, resolvedProductId: productId }
}

// ── Route handler ──────────────────────────────────────────────────────────

/**
 * POST /api/billing/iap/validate
 *
 * Validates an iOS or Android in-app purchase receipt.
 * On success, grants paid_until access to the device.
 *
 * Body:   { platform: "ios"|"android", productId: string, transactionReceipt: string }
 * Header: X-Device-Hash (set automatically by mobile apiFetch)
 *
 * Required env:
 *   APPLE_IAP_SHARED_SECRET            — App Store Connect subscription shared secret
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON   — Google Play service account key (JSON string)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const { platform, productId, transactionReceipt } = body || {}

    if (!platform || !productId || !transactionReceipt) {
      return NextResponse.json(
        { ok: false, error: "missing_fields" },
        { status: 400, headers: { "cache-control": "no-store" } },
      )
    }

    if (platform !== "ios" && platform !== "android") {
      return NextResponse.json(
        { ok: false, error: "invalid_platform" },
        { status: 400, headers: { "cache-control": "no-store" } },
      )
    }

    const deviceHash = req.headers.get("x-device-hash") || ""
    if (!deviceHash) {
      return NextResponse.json(
        { ok: false, error: "missing_device_hash" },
        { status: 400, headers: { "cache-control": "no-store" } },
      )
    }

    // Resolve userId from Authorization header if present
    let userId: string | null = null
    const authHeader = req.headers.get("authorization") || ""
    if (authHeader.startsWith("Bearer ")) {
      const { createClient: createSb } = await import("@supabase/supabase-js")
      const sb = createSb(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      )
      const { data } = await sb.auth.getUser(authHeader.slice(7))
      userId = data?.user?.id || null
    }

    console.log(
      `[IAP] Validating: platform=${platform} product=${productId} device=${deviceHash} user=${userId}`,
    )

    // ── Verify receipt with Apple / Google ─────────────────────────────────
    let verification: { ok: boolean; resolvedProductId?: string }

    if (platform === "ios") {
      verification = await verifyAppleReceipt(transactionReceipt)
    } else {
      // Android purchaseToken is the transactionReceipt field
      verification = await verifyAndroidPurchase(
        "com.turbotaai.app",
        productId,
        transactionReceipt,
      )
    }

    if (!verification.ok) {
      console.warn(`[IAP] Receipt invalid: platform=${platform} product=${productId}`)
      return NextResponse.json(
        { ok: false, error: "receipt_invalid" },
        { status: 402, headers: { "cache-control": "no-store" } },
      )
    }

    // ── Grant access ───────────────────────────────────────────────────────
    const effectiveProduct = verification.resolvedProductId || productId
    const admin = sbAdmin()

    const paidUntil = await extendGrantForDevice(admin, deviceHash, effectiveProduct, userId)

    // Log the validated IAP transaction for auditing
    await admin
      .from("billing_orders")
      .insert({
        order_reference: `IAP-${platform}-${Date.now()}`,
        status: "iap_validated",
        plan_id: effectiveProduct.includes("yearly") ? "yearly" : "monthly",
        amount: 0,
        currency: "IAP",
        device_hash: deviceHash,
        raw: {
          __event: "iap_validated",
          platform,
          productId,
          effectiveProduct,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .catch((e: any) => console.warn("[IAP] billing_orders insert warn:", e?.message))

    console.log(`[IAP] Access granted: device=${deviceHash} paid_until=${paidUntil}`)

    return NextResponse.json(
      { ok: true, paid_until: paidUntil },
      { status: 200, headers: { "cache-control": "no-store" } },
    )
  } catch (e: any) {
    console.error("[IAP] validate error:", e?.message)
    return NextResponse.json(
      { ok: false, error: "iap_validate_failed", details: String(e?.message || e) },
      { status: 500, headers: { "cache-control": "no-store" } },
    )
  }
}
