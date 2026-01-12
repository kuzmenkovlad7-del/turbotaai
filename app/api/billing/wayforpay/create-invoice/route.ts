import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { getPrincipal } from "@/lib/server/principal"
import { getPlan } from "@/lib/billing/plans"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { signCreateInvoice } from "@/lib/wayforpay"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function baseUrlFromReq(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "https"
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000"
  return `${proto}://${host}`
}

export async function POST(req: NextRequest) {
  const p = await getPrincipal(req)

  const body = await req.json().catch(() => ({}))
  const planId = String(body?.planId || "").trim()
  const plan = getPlan(planId)

  if (!plan) {
    return NextResponse.json({ ok: false, error: "Unknown plan" }, { status: 400 })
  }

  const merchantAccount = String(process.env.WAYFORPAY_MERCHANT_ACCOUNT || "").trim()
  const secret = String(process.env.WAYFORPAY_SECRET_KEY || "").trim()
  const merchantDomainName = String(process.env.WAYFORPAY_MERCHANT_DOMAIN || "").trim()
  const apiUrl = String(process.env.WAYFORPAY_API_URL || "https://api.wayforpay.com/api").trim()

  if (!merchantAccount || !secret || !merchantDomainName) {
    return NextResponse.json({ ok: false, error: "WayForPay is not configured" }, { status: 500 })
  }

  const orderReference = `tb_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
  const orderDate = Math.floor(Date.now() / 1000)

  const productName = [`TurbotaAI ${plan.title}`]
  const productCount = [1]
  const productPrice = [plan.amount]

  const merchantSignature = signCreateInvoice({
    secret,
    merchantAccount,
    merchantDomainName,
    orderReference,
    orderDate,
    amount: plan.amount,
    currency: plan.currency,
    productName,
    productCount,
    productPrice,
  })

  const serviceUrl = `${baseUrlFromReq(req)}/api/billing/wayforpay/webhook`

  const payload = {
    transactionType: "CREATE_INVOICE",
    merchantAccount,
    merchantAuthType: "SimpleSignature",
    merchantDomainName,
    merchantSignature,
    apiVersion: 1,
    language: "UA",
    serviceUrl,
    orderReference,
    orderDate,
    amount: plan.amount,
    currency: plan.currency,
    orderTimeout: 86400,
    productName,
    productPrice,
    productCount,
    clientEmail: p.principal.kind === "user" ? (p.principal.email || undefined) : undefined,
  }

  // persist billing order
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = getSupabaseAdmin()
    await supabase.from("billing_orders").insert({
      order_reference: orderReference,
      user_id: p.principal.kind === "user" ? p.principal.userId : null,
      device_hash: p.deviceHash,
      plan_id: plan.id,
      amount: plan.amount,
      currency: plan.currency,
      status: "pending",
      raw: payload,
    })
  }

  const r = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  const text = await r.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { json = { raw: text } }

  if (!r.ok) {
    return NextResponse.json({ ok: false, error: "WayForPay error", details: json }, { status: 502 })
  }

  const invoiceUrl = String(json?.invoiceUrl || "").trim()
  if (!invoiceUrl) {
    return NextResponse.json({ ok: false, error: "Missing invoiceUrl", details: json }, { status: 502 })
  }

  return NextResponse.json({ ok: true, invoiceUrl, orderReference })
}
