import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { makeServiceWebhookSignature, makeServiceResponseSignature } from "@/lib/wayforpay"
import crypto from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type BillingStatus = "paid" | "failed" | "processing" | "invoice_created"

function parseJsonOrForm(text: string): any {
  if (!text) return {}
  try {
    const j = JSON.parse(text)
    if (j && typeof j === "object") return j
  } catch {}

  try {
    const params = new URLSearchParams(text)
    const obj: any = {}
    params.forEach((v, k) => (obj[k] = v))
    return obj
  } catch {}

  return {}
}

function toLower(v: any) {
  return String(v ?? "").trim().toLowerCase()
}

function mapTxStatusToBillingStatus(txStatusRaw: any): BillingStatus {
  const s = toLower(txStatusRaw)
  if (s === "approved" || s === "paid" || s === "success") return "paid"
  if (s === "inprocessing" || s === "processing" || s === "pending") return "processing"
  if (s === "created" || s === "invoice_created") return "invoice_created"
  return "failed"
}

function toDateOrNull(v: any): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

async function extendDeviceGrant(admin: any, deviceHash: string, days: number) {
  const now = new Date()
  const nowIso = now.toISOString()

  const { data: existing } = await admin
    .from("access_grants")
    .select("id, paid_until")
    .eq("device_hash", deviceHash)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const currentPaid = toDateOrNull(existing?.paid_until)
  const base = currentPaid && currentPaid.getTime() > now.getTime() ? currentPaid : now
  const nextPaidUntil = addDays(base, days).toISOString()

  if (existing?.id) {
    await admin
      .from("access_grants")
      .update({ paid_until: nextPaidUntil, trial_questions_left: 0, updated_at: nowIso })
      .eq("id", existing.id)
  } else {
    await admin.from("access_grants").insert({
      id: crypto.randomUUID(),
      user_id: null,
      device_hash: deviceHash,
      trial_questions_left: 0,
      paid_until: nextPaidUntil,
      promo_until: null,
      created_at: nowIso,
      updated_at: nowIso,
    } as any)
  }

  return nextPaidUntil
}

async function extendPaidUntilProfile(admin: any, userId: string, days: number) {
  const nowIso = new Date().toISOString()

  const { data: prof } = await admin
    .from("profiles")
    .select("paid_until")
    .eq("id", userId)
    .maybeSingle()

  const currentPaid = toDateOrNull(prof?.paid_until)
  const base = currentPaid && currentPaid.getTime() > Date.now() ? currentPaid : new Date()
  const nextPaidUntil = addDays(base, days).toISOString()

  await admin
    .from("profiles")
    .update({ paid_until: nextPaidUntil, subscription_status: "active", updated_at: nowIso } as any)
    .eq("id", userId)

  return nextPaidUntil
}

export async function POST(req: NextRequest) {
  const text = await req.text()
  const payload = parseJsonOrForm(text)

  const orderReference = String(payload?.orderReference ?? payload?.order_reference ?? "").trim()
  const txStatus = payload?.transactionStatus ?? payload?.transaction_status ?? null

  const secretKey = String(process.env.WAYFORPAY_SECRET_KEY || process.env.WFP_SECRET_KEY || "").trim()
  const expectedSignature = secretKey ? makeServiceWebhookSignature(secretKey, payload) : ""
  const gotSignature = String(payload?.merchantSignature ?? payload?.merchant_signature ?? "").trim()

  if (!orderReference) {
    return NextResponse.json({ ok: true })
  }

  if (secretKey && expectedSignature && gotSignature) {
    if (toLower(expectedSignature) !== toLower(gotSignature)) {
      console.error("[wfp][webhook] bad signature", { orderReference })
      return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 403 })
    }
  }

  const admin = getSupabaseAdmin()
  const nextStatus = mapTxStatusToBillingStatus(txStatus)
  const nowIso = new Date().toISOString()

  const { data: existingRows } = await admin
    .from("billing_orders")
    .select("order_reference,user_id,status,raw,updated_at,created_at,plan_id,amount,currency,device_hash")
    .eq("order_reference", orderReference)
    .order("updated_at", { ascending: false })
    .limit(1)

  const existing = (existingRows || [])[0] as any

  const userId = existing?.user_id ?? null
  const deviceHash = String(existing?.device_hash ?? existing?.raw?.deviceHash ?? "").trim()

  const amountRaw = payload?.amount ?? existing?.amount ?? 0
  const currencyRaw = payload?.currency ?? existing?.currency ?? "UAH"

  const planId = String(existing?.plan_id ?? existing?.raw?.planId ?? "monthly").trim() || "monthly"

  const mergedRaw = {
    ...(existing?.raw || {}),
    webhook: payload,
    webhook_received_at: nowIso,
    last_event: "webhook",
  }

  // ✅ всегда upsert с обязательными полями
  await admin
    .from("billing_orders")
    .upsert(
      {
        order_reference: orderReference,
        user_id: userId,
        device_hash: deviceHash || null,
        plan_id: planId,
        amount: Number(amountRaw || 0) || Number(existing?.amount || 0) || Number(process.env.PRICE_UAH || process.env.NEXT_PUBLIC_PRICE_UAH || 1),
        currency: String(currencyRaw || "UAH"),
        status: nextStatus,
        raw: mergedRaw,
        created_at: existing?.created_at || nowIso,
        updated_at: nowIso,
      } as any,
      { onConflict: "order_reference" }
    )

  // ✅ если оплачено — активируем либо user, либо guest device
  if (nextStatus === "paid") {
    try {
      if (userId) {
        await extendPaidUntilProfile(admin, String(userId), 30)
      } else if (deviceHash) {
        await extendDeviceGrant(admin, deviceHash, 30)
      }
    } catch (e: any) {
      console.error("[wfp][webhook] activation failed", String(e?.message || e))
    }
  }

  const status = "accept"
  const time = Math.floor(Date.now() / 1000)
  const signature = secretKey ? makeServiceResponseSignature(secretKey, orderReference, status, time) : ""

  return NextResponse.json({
    orderReference,
    status,
    time,
    signature,
    ok: true,
    nextStatus,
  })
}
