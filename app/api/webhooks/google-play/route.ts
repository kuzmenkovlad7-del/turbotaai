/**
 * Google Play Real-time Developer Notifications (RTDN)
 *
 * Setup in Google Play Console:
 *   App → Monetize → Monetization setup → Real-time developer notifications
 *   Topic name:  projects/<GCP_PROJECT>/topics/<TOPIC_NAME>
 *   Endpoint:    https://www.turbotaai.com/api/webhooks/google-play
 *
 *   1. Create a Pub/Sub topic in Google Cloud Console.
 *   2. Create a push subscription pointing to this endpoint.
 *   3. Grant "google-play-developer-notifications@system.gserviceaccount.com"
 *      the "Pub/Sub Publisher" role on that topic.
 *   4. Enter the topic name in Play Console Monetization setup.
 *
 * Google POSTs a Pub/Sub push message:
 *   { message: { data: "<base64>", messageId, publishTime }, subscription: "..." }
 *
 * The decoded data is a DeveloperNotification:
 *   { packageName, eventTimeMillis, subscriptionNotification: { notificationType, purchaseToken, subscriptionId } }
 *
 * Notification types (subscriptionNotification.notificationType):
 *   1 = SUBSCRIPTION_RECOVERED
 *   2 = SUBSCRIPTION_RENEWED
 *   3 = SUBSCRIPTION_CANCELED
 *   4 = SUBSCRIPTION_PURCHASED
 *   5 = SUBSCRIPTION_ON_HOLD
 *   6 = SUBSCRIPTION_IN_GRACE_PERIOD
 *   7 = SUBSCRIPTION_RESTARTED
 *   9 = SUBSCRIPTION_DEFERRED
 *  12 = SUBSCRIPTION_REVOKED
 *  13 = SUBSCRIPTION_EXPIRED
 *
 * Required env vars:
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  — same service account used in iap/validate
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env var:
 *   GOOGLE_PUBSUB_TOKEN  — if set, Pub/Sub push subscription includes it as
 *                          ?token=... for lightweight authentication.
 *                          Set it in GCP Pub/Sub push subscription attributes.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ANDROID_PKG = "com.turbotaai.app"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/androidpublisher"

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } })
}

function sbAdmin() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  if (!url || !key) throw new Error("Missing Supabase env vars")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
}

async function googleAccessToken(): Promise<string> {
  const raw = (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || "").trim()
  if (!raw) throw new Error("Missing GOOGLE_PLAY_SERVICE_ACCOUNT_JSON")
  const key = JSON.parse(raw)
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: "RS256", typ: "JWT" }
  const claim = { iss: key.client_email, scope: GOOGLE_SCOPE, aud: GOOGLE_TOKEN_URL, iat: now, exp: now + 3600 }
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`
  const sig = crypto.sign("RSA-SHA256", Buffer.from(signingInput), key.private_key)
  const jwt = `${signingInput}.${b64url(sig)}`
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  })
  const j: any = await res.json().catch(() => ({}))
  if (!j.access_token) throw new Error(`google_oauth_failed: ${JSON.stringify(j).slice(0, 400)}`)
  return j.access_token
}

async function getSubscriptionFromPlay(productId: string, purchaseToken: string) {
  const accessToken = await googleAccessToken()
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(ANDROID_PKG)}` +
    `/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } })
  const txt = await res.text()
  let j: any
  try { j = JSON.parse(txt) } catch { j = { _raw: txt } }
  if (!res.ok) throw new Error(`google_publisher_${res.status}: ${txt.slice(0, 300)}`)
  return j
}

/** Notification types where the subscription is (or becomes) active. */
const ACTIVE_TYPES = new Set([1, 2, 4, 7, 9])   // RECOVERED, RENEWED, PURCHASED, RESTARTED, DEFERRED
/** Notification types where the subscription ends. */
const EXPIRE_TYPES = new Set([12, 13])             // REVOKED, EXPIRED
/** Notification types that are in-progress / at-risk but not yet ended. */
const GRACE_TYPES = new Set([3, 5, 6])             // CANCELED, ON_HOLD, IN_GRACE_PERIOD

async function handleSubscriptionEvent(admin: ReturnType<typeof sbAdmin>, args: {
  notificationType: number
  purchaseToken: string
  subscriptionId: string
}) {
  const { notificationType, purchaseToken, subscriptionId } = args
  const planId = subscriptionId.includes("yearly") ? "yearly" : "monthly"
  const nowIso = new Date().toISOString()

  // Fetch current subscription state from Play to get authoritative expiry.
  const sub = await getSubscriptionFromPlay(subscriptionId, purchaseToken)
  const expiresMs = Number(sub?.expiryTimeMillis || 0)
  const orderId: string = sub?.orderId || ""
  const isExpired = !expiresMs || expiresMs <= Date.now()
  const isRevoked = EXPIRE_TYPES.has(notificationType) || isExpired

  // Look up the device_hash from billing_orders using the purchaseToken.
  // The token is stored in raw.transactionId (set during initial purchase validate).
  const { data: orders } = await admin
    .from("billing_orders")
    .select("device_hash, user_id")
    .or(
      `raw->>transactionId.eq.${orderId},` +
      `raw->>purchaseToken.eq.${purchaseToken}`
    )
    .order("created_at", { ascending: false })
    .limit(5)

  if (!orders?.length) {
    console.warn("[google-play-webhook] No billing_orders found for purchaseToken:", purchaseToken.slice(0, 20) + "...")
    // Still log the event even if no matching order.
    await admin.from("billing_orders").insert({
      order_reference: `GPLAY-WEBHOOK-${Date.now()}`,
      status: isRevoked ? "expired" : "paid",
      plan_id: planId,
      amount: 0,
      currency: "IAP",
      device_hash: "",
      raw: {
        __event: "google_rtdn",
        notificationType,
        subscriptionId,
        purchaseToken: purchaseToken.slice(0, 40),
        expiresMs,
        orderId,
      },
      created_at: nowIso,
      updated_at: nowIso,
    } as any)
    return
  }

  for (const order of orders) {
    if (!order.device_hash) continue

    if (isRevoked) {
      await admin
        .from("access_grants")
        .update({
          subscription_status: notificationType === 12 ? "revoked" : "expired",
          updated_at: nowIso,
        })
        .eq("device_hash", order.device_hash)
    } else if (GRACE_TYPES.has(notificationType)) {
      // Mark as past_due / grace period — still has access until expiry.
      await admin
        .from("access_grants")
        .update({ subscription_status: "past_due", updated_at: nowIso })
        .eq("device_hash", order.device_hash)
    } else if (ACTIVE_TYPES.has(notificationType) && expiresMs > Date.now()) {
      const paidUntilIso = new Date(expiresMs).toISOString()

      // Never regress paid_until.
      const { data: existing } = await admin
        .from("access_grants")
        .select("paid_until")
        .eq("device_hash", order.device_hash)
        .maybeSingle()

      const existingMs = existing?.paid_until ? Date.parse(existing.paid_until) : 0
      const finalIso = existingMs > expiresMs ? existing!.paid_until : paidUntilIso

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

  // Log event.
  await admin.from("billing_orders").insert({
    order_reference: `GPLAY-WEBHOOK-${Date.now()}`,
    status: isRevoked ? "expired" : GRACE_TYPES.has(notificationType) ? "past_due" : "paid",
    plan_id: planId,
    amount: 0,
    currency: "IAP",
    device_hash: orders[0].device_hash || "",
    raw: {
      __event: "google_rtdn",
      notificationType,
      subscriptionId,
      purchaseToken: purchaseToken.slice(0, 40),
      expiresMs,
      orderId,
    },
    created_at: nowIso,
    updated_at: nowIso,
  } as any)
}

export async function POST(req: NextRequest) {
  try {
    // Optional lightweight auth: Google Pub/Sub can send a token query param.
    const configuredToken = (process.env.GOOGLE_PUBSUB_TOKEN || "").trim()
    if (configuredToken) {
      const { searchParams } = new URL(req.url)
      const incomingToken = searchParams.get("token") || ""
      if (incomingToken !== configuredToken) {
        return json({ ok: false, error: "unauthorized" }, 401)
      }
    }

    const body = await req.json().catch(() => null)
    if (!body?.message?.data) return json({ ok: false, error: "missing_message_data" }, 400)

    // Decode the base64-encoded Pub/Sub message data.
    let notification: any
    try {
      const decoded = Buffer.from(body.message.data, "base64").toString("utf8")
      notification = JSON.parse(decoded)
    } catch (e: any) {
      return json({ ok: false, error: "invalid_message_data" }, 400)
    }

    // Verify this notification is for our package.
    if (notification.packageName && notification.packageName !== ANDROID_PKG) {
      return json({ ok: false, error: "wrong_package" }, 400)
    }

    const sub = notification?.subscriptionNotification
    if (!sub?.purchaseToken || !sub?.subscriptionId || sub?.notificationType == null) {
      // Could be a test notification or one-time product — acknowledge and skip.
      return json({ ok: true, skipped: true })
    }

    const admin = sbAdmin()
    await handleSubscriptionEvent(admin, {
      notificationType: Number(sub.notificationType),
      purchaseToken: sub.purchaseToken,
      subscriptionId: sub.subscriptionId,
    })

    // Acknowledge the Pub/Sub message (must return 2xx or Google will retry).
    return json({ ok: true, notificationType: sub.notificationType })
  } catch (e: any) {
    console.error("[google-play-webhook] Error:", e?.message || e)
    // Return 200 to ack the Pub/Sub message and prevent infinite retries
    // for server-side errors. Permanent failures (bad data) returned 4xx above.
    return json({ ok: false, error: String(e?.message || "internal_error") })
  }
}
