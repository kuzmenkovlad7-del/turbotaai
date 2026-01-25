import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type BillingStatus = "paid" | "failed" | "processing" | "invoice_created" | "not_found"

function toLower(v: any) {
  return String(v ?? "").trim().toLowerCase()
}

function normalizeRowStatus(s: any): BillingStatus {
  const v = toLower(s)
  if (!v) return "not_found"
  if (v === "paid") return "paid"
  if (v === "processing") return "processing"
  if (v === "invoice_created") return "invoice_created"
  if (v === "created") return "invoice_created"
  if (v === "failed") return "failed"
  return "failed"
}

function pickBestStatus(statuses: BillingStatus[]): BillingStatus {
  if (statuses.includes("paid")) return "paid"
  if (statuses.includes("processing")) return "processing"
  if (statuses.includes("invoice_created")) return "invoice_created"
  if (statuses.length === 0) return "not_found"
  return "failed"
}

function safeJson(raw: any) {
  if (!raw) return null
  if (typeof raw === "object") return raw
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return null
}

function hmacMd5(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str, "utf8").digest("hex")
}

function mapWayforpayTxToStatus(txStatus?: string | null): BillingStatus {
  const s = toLower(txStatus)
  if (s === "approved" || s === "paid" || s === "success") return "paid"
  if (s === "inprocessing" || s === "processing" || s === "pending") return "processing"
  if (s === "created") return "invoice_created"
  return "failed"
}

async function wayforpayCheck(orderReference: string) {
  const merchantAccount =
    process.env.WAYFORPAY_MERCHANT_ACCOUNT ||
    process.env.WFP_MERCHANT_ACCOUNT ||
    ""

  const secretKey =
    process.env.WAYFORPAY_SECRET_KEY ||
    process.env.WFP_SECRET_KEY ||
    ""

  if (!merchantAccount || !secretKey) {
    return { ok: false, error: "missing_wayforpay_env" as const }
  }

  const signStr = `${merchantAccount};${orderReference}`
  const merchantSignature = hmacMd5(signStr, secretKey)

  const requestBody = {
    transactionType: "CHECK_STATUS",
    merchantAccount,
    orderReference,
    apiVersion: 1,
    merchantSignature,
  }

  const r = await fetch("https://api.wayforpay.com/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    cache: "no-store",
  })

  const json = await r.json().catch(() => null)
  if (!r.ok || !json) return { ok: false, error: "wayforpay_check_failed" as const }

  const txStatus = json.transactionStatus || json.status || null
  return { ok: true, txStatus, raw: json }
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

async function extendPaidUntil(admin: any, userId: string, days: number) {
  const nowIso = new Date().toISOString()

  const { data: prof } = await admin
    .from("profiles")
    .select("paid_until")
    .eq("id", userId)
    .maybeSingle()

  const currentPaid = toDateOrNull(prof?.paid_until)
  const base = currentPaid && currentPaid.getTime() > Date.now() ? currentPaid : new Date()
  const nextPaidUntil = addDays(base, days).toISOString()

  const payloadVariants = [
    { paid_until: nextPaidUntil, auto_renew: true, subscription_status: "active", updated_at: nowIso },
    { paid_until: nextPaidUntil, autorenew: true, subscription_status: "active", updated_at: nowIso },
    { paid_until: nextPaidUntil, auto_renew: true, subscription_status: "active" },
    { paid_until: nextPaidUntil, autorenew: true, subscription_status: "active" },
  ]

  for (const payload of payloadVariants) {
    const r = await admin.from("profiles").update(payload).eq("id", userId)
    if (!r?.error) break
  }

  const accountKey = `account:${userId}`
  await admin.from("access_grants").update({ paid_until: nextPaidUntil, updated_at: nowIso }).eq("user_id", userId)
  await admin.from("access_grants").update({ paid_until: nextPaidUntil, updated_at: nowIso }).eq("device_hash", accountKey)

  return nextPaidUntil
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)

  const orderReference =
    (url.searchParams.get("orderReference") ||
      url.searchParams.get("order_reference") ||
      "").trim()

  const debug = url.searchParams.get("debug") === "1"

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "missing_orderReference" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // читаем из БД
  const read = await admin
    .from("billing_orders")
    .select("status, updated_at, raw, user_id")
    .eq("order_reference", orderReference)
    .order("updated_at", { ascending: false })
    .limit(20)

  if (read.error) {
    console.error("[billing][status] db error", { orderReference, error: read.error })
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 })
  }

  const rows = read.data || []
  const statuses = rows.map((r: any) => normalizeRowStatus(r.status))
  let best = pickBestStatus(statuses)

  const last = rows[0] as any
  let raw = safeJson(last?.raw)
  let lastTx =
    raw?.check?.transactionStatus ||
    raw?.webhook?.transactionStatus ||
    raw?.transactionStatus ||
    null

  // если не paid, делаем CHECK_STATUS, обновляем запись и перечитываем
  if (best !== "paid") {
    const chk = await wayforpayCheck(orderReference)
    if (chk.ok) {
      const next = mapWayforpayTxToStatus(chk.txStatus as any)
      const nowIso = new Date().toISOString()

      const mergedRaw = {
        ...(raw || {}),
        check: chk.raw,
        check_received_at: nowIso,
        last_event: "check",
      }

      await admin
        .from("billing_orders")
        .update({ status: next, raw: mergedRaw, updated_at: nowIso })
        .eq("order_reference", orderReference)

      // обновляем локальные переменные
      best = next
      raw = mergedRaw
      lastTx = chk.txStatus as any

      // если стало paid и есть user_id, продлеваем доступ
      const userId = last?.user_id ? String(last.user_id) : null
      if (best === "paid" && userId) {
        await extendPaidUntil(admin, userId, 30)
      }
    }
  }

  const payload: any = {
    ok: true,
    orderReference,
    status: best,
    transactionStatus: lastTx,
  }

  if (debug) {
    payload.debug = {
      rows: rows.length,
      statuses,
      lastUpdatedAt: last?.updated_at || null,
      lastEvent: raw?.last_event || null,
    }
  }

  return NextResponse.json(payload)
}
