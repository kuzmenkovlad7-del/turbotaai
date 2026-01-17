import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { makeCreateInvoiceSignature } from "@/lib/wayforpay"

export const runtime = "nodejs"

const WFP_API = "https://api.wayforpay.com/api"

function getBaseUrl(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "https"
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    ""

  if (!host) return ""
  return `${proto}://${host}`
}

function cleanDomain(hostOrUrl: string) {
  return String(hostOrUrl || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .trim()
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any))

  const planId = String(body.planId ?? body.plan_id ?? "")
  const userId = body.userId ?? body.user_id ?? null
  const deviceHash = body.deviceHash ?? body.device_hash ?? null

  const currency = String(body.currency ?? "UAH").toUpperCase()

  let amount = Number(body.amount ?? 0)
  if (!Number.isFinite(amount) || amount <= 0) {
    amount = 1
  }

  const testAmount = Number(process.env.WAYFORPAY_TEST_AMOUNT_UAH ?? "")
  if (Number.isFinite(testAmount) && testAmount > 0) {
    amount = testAmount
  }

  const merchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT || ""
  const secret = process.env.WAYFORPAY_SECRET_KEY || ""

  if (!merchantAccount || !secret) {
    return NextResponse.json(
      { ok: false, error: "WayForPay env missing (WAYFORPAY_MERCHANT_ACCOUNT / WAYFORPAY_SECRET_KEY)" },
      { status: 500 }
    )
  }

  const baseUrl = getBaseUrl(req)
  const host = req.headers.get("host") || "turbotaai.com"

  const merchantDomainName =
    cleanDomain(process.env.WAYFORPAY_MERCHANT_DOMAIN || "") ||
    cleanDomain(host) ||
    "turbotaai.com"

  const orderDate = Math.floor(Date.now() / 1000)
  const orderReference = `ta_${planId || "plan"}_${orderDate}_${crypto.randomBytes(4).toString("hex")}`

  // returnUrl только для UI редиректа, но сделаем удобным
  const returnUrl = `${baseUrl}/payment/return?orderReference=${encodeURIComponent(orderReference)}`

  // serviceUrl = webhook который реально заносит оплату в Supabase
  const serviceUrl = `${baseUrl}/api/billing/wayforpay/webhook`

  const productName = [`TurbotaAI ${planId || "Plan"}`]
  const productCount = [1]
  const productPrice = [amount]

  const merchantSignature = makeCreateInvoiceSignature(secret, {
    merchantAccount,
    merchantDomainName,
    orderReference,
    orderDate,
    amount,
    currency,
    productName,
    productCount,
    productPrice,
  })

  const payload = {
    transactionType: "CREATE_INVOICE",
    merchantAccount,
    merchantAuthType: "SimpleSignature",
    merchantDomainName,
    merchantSignature,
    apiVersion: 1,
    language: "EN",
    serviceUrl,
    returnUrl,
    orderReference,
    orderDate,
    amount,
    currency,
    productName,
    productPrice,
    productCount,
  }

  const r = await fetch(WFP_API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  const data = await r.json().catch(() => ({} as any))

  const invoiceUrl = data?.invoiceUrl || data?.url || data?.paymentUrl || ""
  const reason = String(data?.reason ?? "")
  const reasonCode = String(data?.reasonCode ?? "")

  const reasonNorm = reason.toLowerCase()
  const reasonCodeNorm = reasonCode.toLowerCase()

  const ok =
    r.ok &&
    !!invoiceUrl &&
    (
      reasonNorm === "ok" ||
      reasonCodeNorm === "ok" ||
      reason === "1100" ||
      reasonCode === "1100" ||
      reasonNorm === "1100" ||
      reasonCodeNorm === "1100" ||
      reason === "" ||
      reasonCode === ""
    )

  if (!ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "WayForPay create invoice failed",
        status: r.status,
        response: data,
        debug: {
          merchantDomainName,
          orderReference,
          amount,
          currency,
          serviceUrl,
          returnUrl,
          testAmountApplied: Number.isFinite(testAmount) && testAmount > 0,
        },
      },
      { status: 400 }
    )
  }

  // ✅ Сразу заносим order в Supabase (даже до оплаты, статус invoice_created)
  try {
    await supabaseAdmin.from("billing_orders").insert({
      order_reference: orderReference,
      user_id: userId,
      device_hash: deviceHash,
      plan_id: planId,
      amount,
      currency,
      status: "invoice_created",
      raw: {
        invoice: data,
        wfpPayload: payload,
      },
    })
  } catch (e) {
    console.error("billing_orders insert failed", e)
  }

  return NextResponse.json({
    ok: true,
    orderReference,
    invoiceUrl,
    raw: data,
    debug: {
      amount,
      testAmountApplied: Number.isFinite(testAmount) && testAmount > 0,
      serviceUrl,
      returnUrl,
    },
  })
}
