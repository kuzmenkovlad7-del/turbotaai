import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

/**
 * POST /api/billing/iap/validate
 *
 * Validates an in-app purchase receipt from iOS or Android.
 * On successful validation, grants access to the user.
 *
 * Body: { platform: "ios" | "android", productId: string, transactionReceipt: string }
 *
 * TODO: Implement actual receipt verification with Apple/Google servers:
 * - iOS: POST to https://buy.itunes.apple.com/verifyReceipt (or sandbox)
 * - Android: Use Google Play Developer API to verify purchase token
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

    // Extract device hash from header (mobile client sends it)
    const deviceHash = req.headers.get("x-device-hash") || ""
    if (!deviceHash) {
      return NextResponse.json(
        { ok: false, error: "missing_device_hash" },
        { status: 400, headers: { "cache-control": "no-store" } },
      )
    }

    // TODO: Verify receipt with Apple / Google
    // For now, log the receipt and return a placeholder response.
    // In production, this MUST validate the receipt server-side before granting access.
    console.log(`[IAP] Receipt validation request: platform=${platform}, product=${productId}, device=${deviceHash}`)

    const admin = sbAdmin()

    // Log the IAP transaction
    await admin.from("billing_orders").insert({
      order_reference: `IAP-${platform}-${Date.now()}`,
      status: "iap_pending_validation",
      plan_id: productId.includes("yearly") ? "yearly" : "monthly",
      amount: 0,
      currency: "IAP",
      device_hash: deviceHash,
      raw: {
        __event: "iap_validate_request",
        platform,
        productId,
        receiptLength: transactionReceipt.length,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)

    // TODO: After actual receipt verification, grant access:
    // const months = productId.includes("yearly") ? 12 : 1
    // const accessUntil = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000)
    // await admin.from("access_grants").upsert({
    //   device_hash: deviceHash,
    //   plan_id: productId.includes("yearly") ? "yearly" : "monthly",
    //   access_until: accessUntil.toISOString(),
    //   source: "iap",
    // })

    return NextResponse.json(
      {
        ok: false,
        error: "iap_validation_not_implemented",
        message: "Receipt logged. Server-side validation with Apple/Google is not yet implemented.",
      },
      { status: 501, headers: { "cache-control": "no-store" } },
    )
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "iap_validate_failed", details: String(e?.message || e) },
      { status: 500, headers: { "cache-control": "no-store" } },
    )
  }
}
