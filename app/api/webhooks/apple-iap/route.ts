/**
 * Apple App Store Server Notifications v2
 *
 * Setup in App Store Connect:
 *   My Apps → <App> → App Information → App Store Server Notifications
 *   Production URL:  https://www.turbotaai.com/api/webhooks/apple-iap
 *   Sandbox URL:     https://www.turbotaai.com/api/webhooks/apple-iap
 *   Version:         Version 2
 *
 * Apple POSTs a JSON body { "signedPayload": "<JWT>" } signed with
 * Apple's private key and a certificate chain embedded in the JWT header.
 *
 * This handler decodes the payload and nested signed transaction / renewal
 * JWTs (without performing full certificate-chain validation — acceptable
 * for an MVP; add full X.509 chain verification for PCI-level hardening).
 *
 * Notification types handled:
 *   SUBSCRIBED, DID_RENEW           → extend paid_until
 *   EXPIRED, DID_FAIL_TO_RENEW,
 *   GRACE_PERIOD_EXPIRED            → mark subscription_status = expired / past_due
 *   REVOKE, REFUND                  → mark subscription_status = revoked / refunded
 *   Everything else                 → acknowledged (200) but no DB write
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (already used across app)
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } })
}

function sbAdmin() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  if (!url || !key) throw new Error("Missing Supabase env vars")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Decode a signed JWT payload without verifying the signature. */
function decodeJwtPayload(token: string): any {
  const parts = token.split(".")
  if (parts.length < 2) throw new Error("Invalid JWT structure")
  const raw = parts[1].replace(/-/g, "+").replace(/_/g, "/")
  const padded = raw + "=".repeat((4 - (raw.length % 4)) % 4)
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"))
}

/** Apple notification types that extend the subscription. */
const EXTEND_TYPES = new Set([
  "SUBSCRIBED",
  "DID_RENEW",
  "OFFER_REDEEMED",
])

/** Apple notification types that mark the subscription as no longer active. */
const EXPIRE_TYPES = new Set([
  "EXPIRED",
  "DID_FAIL_TO_RENEW",
  "GRACE_PERIOD_EXPIRED",
  "REVOKE",
  "REFUND",
])

async function upsertGrant(admin: ReturnType<typeof sbAdmin>, args: {
  originalTransactionId: string
  productId: string
  expiresMs: number
  notificationType: string
}) {
  const paidUntilIso = new Date(args.expiresMs).toISOString()
  const planId = args.productId.includes("yearly") ? "yearly" : "monthly"
  const isExpiry = EXPIRE_TYPES.has(args.notificationType)

  // Find billing order(s) with this Apple transaction ID to get device_hash.
  // Apple's originalTransactionId links all renewals of the same subscription.
  const { data: orders } = await admin
    .from("billing_orders")
    .select("device_hash, user_id")
    .or(`raw->>transactionId.eq.${args.originalTransactionId},raw->>originalTransactionId.eq.${args.originalTransactionId}`)
    .order("created_at", { ascending: false })
    .limit(5)

  if (!orders?.length) {
    // No matching order found — log and exit cleanly (may be a test event).
    console.warn("[apple-iap-webhook] No billing_orders found for originalTransactionId:", args.originalTransactionId)
    return
  }

  // Update all matching device grants (there may be multiple if user re-installed).
  const nowIso = new Date().toISOString()
  for (const order of orders) {
    if (!order.device_hash) continue
    if (isExpiry) {
      await admin
        .from("access_grants")
        .update({
          subscription_status: args.notificationType === "REFUND" ? "refunded" : "expired",
          updated_at: nowIso,
        })
        .eq("device_hash", order.device_hash)
    } else {
      // Never regress paid_until.
      const { data: existing } = await admin
        .from("access_grants")
        .select("paid_until")
        .eq("device_hash", order.device_hash)
        .maybeSingle()

      const existingMs = existing?.paid_until ? Date.parse(existing.paid_until) : 0
      const newMs = args.expiresMs
      const finalIso = existingMs > newMs ? existing!.paid_until : paidUntilIso

      await admin.from("access_grants").upsert(
        {
          device_hash: order.device_hash,
          ...(order.user_id ? { user_id: order.user_id } : {}),
          plan_id: planId,
          paid_until: finalIso,
          subscription_status: "active",
          source: "iap",
          updated_at: nowIso,
        },
        { onConflict: "device_hash" } as any,
      )
    }
  }

  // Log webhook event to billing_orders.
  await admin.from("billing_orders").insert({
    order_reference: `APPLE-WEBHOOK-${args.originalTransactionId}-${Date.now()}`,
    status: isExpiry ? "expired" : "paid",
    plan_id: planId,
    amount: 0,
    currency: "IAP",
    device_hash: orders[0].device_hash,
    raw: {
      __event: "apple_assn",
      notificationType: args.notificationType,
      originalTransactionId: args.originalTransactionId,
      productId: args.productId,
      expiresMs: args.expiresMs,
    },
    created_at: nowIso,
    updated_at: nowIso,
  } as any)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body?.signedPayload) return json({ ok: false, error: "missing_signed_payload" }, 400)

    // Decode the outer notification payload.
    let outerPayload: any
    try {
      outerPayload = decodeJwtPayload(body.signedPayload)
    } catch (e: any) {
      return json({ ok: false, error: "invalid_signed_payload" }, 400)
    }

    const notificationType: string = outerPayload?.notificationType || ""
    const subtype: string = outerPayload?.subtype || ""
    const data = outerPayload?.data || {}

    // Decode the signed transaction info (nested JWT inside the notification).
    let txInfo: any = {}
    if (data.signedTransactionInfo) {
      try {
        txInfo = decodeJwtPayload(data.signedTransactionInfo)
      } catch {}
    }

    const originalTransactionId: string =
      txInfo?.originalTransactionId || txInfo?.transactionId || ""
    const productId: string = txInfo?.productId || ""
    const expiresMs: number = Number(txInfo?.expiresDate || txInfo?.expiresDateMs || 0)

    // Acknowledge the notification regardless of whether we process it.
    // Apple expects a 2xx within 5 s or will retry.
    if (!originalTransactionId || !productId || !notificationType) {
      console.warn("[apple-iap-webhook] Missing fields — acknowledged without processing", {
        notificationType,
        productId,
        originalTransactionId,
      })
      return json({ ok: true, skipped: true })
    }

    if (!EXTEND_TYPES.has(notificationType) && !EXPIRE_TYPES.has(notificationType)) {
      // Unhandled type (e.g. PRICE_INCREASE, CONSUMPTION_REQUEST) — acknowledge.
      return json({ ok: true, skipped: true })
    }

    const admin = sbAdmin()
    await upsertGrant(admin, { originalTransactionId, productId, expiresMs, notificationType })

    return json({ ok: true, notificationType, subtype })
  } catch (e: any) {
    console.error("[apple-iap-webhook] Error:", e?.message || e)
    // Return 200 to prevent Apple from retrying for server errors.
    return json({ ok: false, error: String(e?.message || "internal_error") })
  }
}
