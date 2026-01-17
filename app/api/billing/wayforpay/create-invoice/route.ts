import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { makeInvoiceSignature } from "@/lib/wayforpay"

const WFP_API = "https://api.wayforpay.com/api"

function missingEnv() {
  const required = ["WAYFORPAY_MERCHANT_ACCOUNT", "WAYFORPAY_SECRET_KEY"]
  const missing = required.filter((k) => !process.env[k])
  return missing
}

export async function POST(req: Request) {
  const missing = missingEnv()
  if (missing.length) {
    return NextResponse.json(
      {
        ok: false,
        error: "WayForPay is not configured",
        missing,
        hint:
          "Add env vars in .env.local (and Vercel). Required: WAYFORPAY_MERCHANT_ACCOUNT, WAYFORPAY_SECRET_KEY. Optional: WAYFORPAY_MERCHANT_DOMAIN_NAME, WAYFORPAY_WEBHOOK_URL, WAYFORPAY_RETURN_URL",
      },
      { status: 400 }
    )
  }

  const merchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT!
  const secretKey = process.env.WAYFORPAY_SECRET_KEY!

  const merchantDomainName =
    process.env.WAYFORPAY_MERCHANT_DOMAIN_NAME ||
    process.env.WAYFORPAY_MERCHANT_DOMAIN ||
    headers().get("host") ||
    "localhost:3000"

  const body = await req.json().catch(() => ({} as any))

  let amount = Number(body?.amount ?? 499)
  const currency = String(body?.currency ?? "UAH")

  // ✅ override работает ВЕЗДЕ если задано WAYFORPAY_TEST_AMOUNT_UAH
  const __testAmount = Number(process.env.WAYFORPAY_TEST_AMOUNT_UAH || "")
  if (Number.isFinite(__testAmount) && __testAmount > 0) {
    amount = __testAmount
  }

  const productName = [String(body?.productName ?? "TurbotaAI Monthly")]
  const productCount = [Number(body?.productCount ?? 1)]
  const productPrice = [amount]

  const orderReference =
    body?.orderReference
      ? String(body.orderReference)
      : `TAI-${Date.now()}-${Math.random().toString(16).slice(2)}`

  const orderDate = Math.floor(Date.now() / 1000)

  const serviceUrl =
    process.env.WAYFORPAY_SERVICE_URL ||
    process.env.WAYFORPAY_WEBHOOK_URL ||
    (headers().get("x-forwarded-proto") && headers().get("host")
      ? `${headers().get("x-forwarded-proto")}://${headers().get("host")}/api/billing/wayforpay/webhook`
      : undefined)

  const returnUrl =
    process.env.WAYFORPAY_RETURN_URL ||
    (headers().get("x-forwarded-proto") && headers().get("host")
      ? `${headers().get("x-forwarded-proto")}://${headers().get("host")}/payment/return`
      : undefined)

  const merchantSignature = makeInvoiceSignature({
    merchantAccount,
    merchantDomainName,
    orderReference,
    orderDate,
    amount,
    currency,
    productName,
    productCount,
    productPrice,
    secretKey,
  })

  const payload: any = {
    transactionType: "CREATE_INVOICE",
    merchantAccount,
    merchantDomainName,
    merchantSignature,
    apiVersion: 1,
    orderReference,
    orderDate,
    amount,
    currency,
    productName,
    productCount,
    productPrice,
    language: "EN",
  }

  if (serviceUrl) payload.serviceUrl = serviceUrl
  if (returnUrl) payload.returnUrl = returnUrl

  const r = await fetch(WFP_API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  const data = await r.json().catch(() => ({}))

  const invoiceUrl = data?.invoiceUrl || data?.url || data?.paymentUrl
  const reason = String(data?.reason ?? "")
  const reasonCode = String(data?.reasonCode ?? "")

  const ok =
    r.ok &&
    !!invoiceUrl &&
    (reason.toLowerCase() === "ok" || reasonCode === "1100" || reasonCode === "")

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
          testAmountApplied: Number.isFinite(__testAmount) && __testAmount > 0,
        },
      },
      { status: 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    orderReference,
    invoiceUrl,
    raw: data,
    debug: {
      amount,
      testAmountApplied: Number.isFinite(__testAmount) && __testAmount > 0,
    },
  })
}
