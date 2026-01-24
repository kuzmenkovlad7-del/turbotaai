import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type BillingStatus = "paid" | "failed" | "processing"

function hmacMd5(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str, "utf8").digest("hex")
}

function mapWayforpayStatus(txStatus?: string | null): BillingStatus {
  const s = (txStatus || "").toLowerCase()

  if (s === "approved" || s === "paid" || s === "successful" || s === "success") return "paid"
  if (s === "inprocessing" || s === "processing" || s === "pending") return "processing"

  // declined / expired / refunded / unknown -> failed
  return "failed"
}

function pickBestStatus(statuses: string[]): BillingStatus {
  // paid always wins, never downgrade
  if (statuses.includes("paid")) return "paid"
  if (statuses.includes("processing")) return "processing"
  return "failed"
}

function toDateOrNull(v: any) {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function isFuture(v: any) {
  const d = toDateOrNull(v)
  if (!d) return false
  return d.getTime() > Date.now()
}

function addDaysFrom(base: Date, days: number) {
  const x = new Date(base)
  x.setDate(x.getDate() + days)
  return x
}

async function extendPaidUntil(admin: any, userId: string, days = 30) {
  const now = new Date()
  const nowIso = now.toISOString()

  const { data: current } = await admin
    .from("access_grants")
    .select("paid_until, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  let base = now
  if (current?.paid_until && isFuture(current.paid_until)) {
    const d = toDateOrNull(current.paid_until)
    if (d) base = d
  }

  const nextIso = addDaysFrom(base, days).toISOString()

  await admin
    .from("access_grants")
    .update({ paid_until: nextIso, updated_at: nowIso })
    .eq("user_id", userId)

  await admin
    .from("access_grants")
    .update({ paid_until: nextIso, updated_at: nowIso })
    .eq("device_hash", `account:${userId}`)

  const profilePayload = {
    paid_until: nextIso,
    auto_renew: true,
    subscription_status: "active",
    updated_at: nowIso,
  }

  await admin.from("profiles").update(profilePayload).eq("id", userId)
  await admin.from("profiles").update(profilePayload).eq("user_id", userId)

  return nextIso
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const orderReference = url.searchParams.get("orderReference")?.trim() || ""

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "missing_orderReference" }, { status: 400 })
  }

  const merchantAccount =
    process.env.WAYFORPAY_MERCHANT_ACCOUNT ||
    process.env.WFP_MERCHANT_ACCOUNT ||
    ""

  const secretKey =
    process.env.WAYFORPAY_SECRET_KEY ||
    process.env.WFP_SECRET_KEY ||
    ""

  if (!merchantAccount || !secretKey) {
    console.error("[billing][check] missing env", {
      hasMerchantAccount: Boolean(merchantAccount),
      hasSecretKey: Boolean(secretKey),
    })
    return NextResponse.json({ ok: false, error: "missing_wayforpay_env" }, { status: 500 })
  }

  // WayForPay CHECK_STATUS signature: HMAC_MD5("merchantAccount;orderReference", secretKey)
  const signStr = `${merchantAccount};${orderReference}`
  const merchantSignature = hmacMd5(signStr, secretKey)

  const requestBody = {
    transactionType: "CHECK_STATUS",
    merchantAccount,
    orderReference,
    apiVersion: 1,
    merchantSignature,
  }

  let wfpJson: any = null
  try {
    const r = await fetch("https://api.wayforpay.com/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    })

    wfpJson = await r.json().catch(() => null)

    if (!r.ok || !wfpJson) {
      console.error("[billing][check] bad response", { orderReference, httpStatus: r.status, body: wfpJson })
      return NextResponse.json({ ok: false, error: "wayforpay_check_failed", httpStatus: r.status }, { status: 502 })
    }
  } catch (e: any) {
    console.error("[billing][check] fetch error", { orderReference, error: String(e?.message || e) })
    return NextResponse.json({ ok: false, error: "wayforpay_fetch_error" }, { status: 502 })
  }

  const txStatus: string | null = wfpJson.transactionStatus || wfpJson.status || null

  if (!txStatus) {
    console.error("[billing][check] missing transactionStatus", { orderReference, wfpJson })
    return NextResponse.json({ ok: false, error: "missing_transactionStatus" }, { status: 502 })
  }

  const nextStatus = mapWayforpayStatus(txStatus)
  const admin = getSupabaseAdmin()

  // читаем текущие статусы в БД
  const existing = await admin
    .from("billing_orders")
    .select("status, raw, updated_at, user_id")
    .eq("order_reference", orderReference)
    .order("updated_at", { ascending: false })
    .limit(10)

  if (existing.error) {
    console.error("[billing][check] db read error", { orderReference, error: existing.error })
    return NextResponse.json({ ok: false, error: "db_read_failed" }, { status: 500 })
  }

  const existingStatuses = (existing.data || []).map((r: any) => String(r.status || ""))
  const bestExisting = pickBestStatus(existingStatuses)

  // НЕ даём понижать paid → failed
  if (bestExisting === "paid" && nextStatus !== "paid") {
    return NextResponse.json({
      ok: true,
      orderReference,
      status: "paid",
      protected: true,
      transactionStatus: txStatus,
    })
  }

  const latestRaw = (existing.data?.[0] as any)?.raw || {}
  const mergedRaw = {
    ...(latestRaw || {}),
    check: wfpJson,
    check_received_at: new Date().toISOString(),
  }

  // обновляем статус заказа
  const upd = await admin
    .from("billing_orders")
    .update({
      status: nextStatus,
      raw: mergedRaw,
      updated_at: new Date().toISOString(),
    })
    .eq("order_reference", orderReference)

  if (upd.error) {
    console.error("[billing][check] db update error", { orderReference, error: upd.error })
    return NextResponse.json({ ok: false, error: "db_update_failed" }, { status: 500 })
  }

  // если paid -> выдаём доступ по user_id из заказа
  const userId = String((existing.data?.[0] as any)?.user_id || "")
  if (nextStatus === "paid" && userId) {
    try {
      await extendPaidUntil(admin, userId, 30)
    } catch (e: any) {
      console.error("[billing][check] extendPaidUntil failed", e?.message || e)
    }
  }

  return NextResponse.json({
    ok: true,
    orderReference,
    status: nextStatus,
    transactionStatus: txStatus,
  })
}
