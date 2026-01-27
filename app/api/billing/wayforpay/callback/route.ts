import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const WFP_SECRET = process.env.WAYFORPAY_SECRET_KEY || ""

function hmacMd5(parts: Array<string | number>) {
  return crypto.createHmac("md5", WFP_SECRET).update(parts.join(";")).digest("hex")
}

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

async function readAnyBody(req: NextRequest): Promise<any> {
  const ct = (req.headers.get("content-type") || "").toLowerCase()
  const text = await req.text()
  if (!text) return {}

  if (ct.includes("application/json")) {
    const j = safeJsonParse(text)
    return j ?? {}
  }

  if (ct.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(text)
    const out: any = {}
    for (const [k, v] of params.entries()) out[k] = v
    if (typeof out.response === "string") {
      const j = safeJsonParse(out.response)
      if (j) return j
    }
    if (typeof out.data === "string") {
      const j = safeJsonParse(out.data)
      if (j) return j
    }
    return out
  }

  const j = safeJsonParse(text)
  return j ?? { raw: text }
}

function normalizePaidStatus(raw: string) {
  const s = (raw || "").toLowerCase()
  if (!s) return "unknown"
  if (s.includes("approved") || s.includes("success") || s === "paid") return "paid"
  if (s.includes("expired") || s.includes("timeout")) return "expired"
  if (s.includes("declined") || s.includes("rejected")) return "failed"
  if (s.includes("refunded") || s.includes("refund")) return "refunded"
  return s
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
  if (!WFP_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Missing WAYFORPAY_SECRET_KEY" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const body = await readAnyBody(req)

  const orderReference =
    body.orderReference ||
    body.order_reference ||
    body.orderRef ||
    body.order_ref ||
    ""

  const transactionType = String(body.transactionType || body.type || "").toUpperCase()
  const transactionStatus =
    body.transactionStatus ||
    body.transaction_status ||
    body.status ||
    ""

  const currency = String(body.currency || body.orderCurrency || "UAH")
  const amountNumRaw = body.amount ?? body.orderAmount ?? null
  const amountNum =
    amountNumRaw === null || amountNumRaw === undefined
      ? null
      : Number(String(amountNumRaw).replace(",", "."))

  if (!orderReference) {
    return NextResponse.json(
      { ok: false, error: "Missing orderReference", body },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const ex = await supabase
    .from("billing_orders")
    .select("device_hash, plan_id")
    .eq("order_reference", orderReference)
    .limit(1)

  const existing = ex.data && ex.data.length ? ex.data[0] : null

  const effectivePlan =
    existing?.plan_id ||
    body.planId ||
    body.plan_id ||
    "monthly"

  const deviceHash =
    existing?.device_hash ||
    body.deviceHash ||
    body.device_hash ||
    null

  const now = new Date()
  const paidUntil = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000)

  const normalized =
    transactionType === "CHECK"
      ? "invoice_created"
      : normalizePaidStatus(String(transactionStatus || ""))

  const upsertObj: any = {
    order_reference: String(orderReference),
    status: String(normalized),
    raw: body,
  }
  if (Number.isFinite(amountNum as any)) upsertObj.amount = amountNum
  if (currency) upsertObj.currency = currency
  if (effectivePlan) upsertObj.plan_id = String(effectivePlan)
  if (deviceHash) upsertObj.device_hash = String(deviceHash)

  await supabase
    .from("billing_orders")
    .upsert(upsertObj, { onConflict: "order_reference" })

  if (normalized === "paid" && deviceHash) {
    const grantObj: any = {
      device_hash: String(deviceHash),
      plan_id: String(effectivePlan),
      paid_until: paidUntil.toISOString(),
    }
    await supabase
      .from("access_grants")
      .upsert(grantObj, { onConflict: "device_hash" })
  }

  const time = Math.floor(Date.now() / 1000).toString()
  const status = "accept"
  const signature = hmacMd5([orderReference, status, time])

  return NextResponse.json(
    { orderReference, status, time, signature },
    { status: 200, headers: { "cache-control": "no-store" } }
  )
}

export async function GET() {
  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { "cache-control": "no-store" } }
  )
}
