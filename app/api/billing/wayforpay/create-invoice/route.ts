import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { makeCreateInvoiceSignature } from "@/lib/wayforpay"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const WFP_API = "https://api.wayforpay.com/api"

function getBaseUrl(req: NextRequest) {
  // ✅ продакшен-оверрайд если надо
  const envBase =
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    ""

  if (envBase) return String(envBase).replace(/\/+$/, "")

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

async function getUserIdFromSession() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return { userId: null as string | null, error: "Missing Supabase public env" }
  }

  const cookieStore = cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user?.id) {
    return { userId: null, error: error?.message || "Unauthorized" }
  }

  return { userId: data.user.id, error: null }
}

function resolveAmountUAH(planId: string, requestAmount?: number) {
  // ✅ прод-цена по умолчанию (и через env можно менять)
  const monthly = Number(process.env.BILLING_MONTHLY_PRICE_UAH ?? "499") || 499

  let amount = Number(requestAmount ?? 0)
  if (!Number.isFinite(amount) || amount <= 0) amount = monthly

  // если пришел planId=monthly — всегда ставим месячную цену
  if (String(planId || "").toLowerCase() === "monthly") {
    amount = monthly
  }

  // ✅ тестовый оверрайд (на проде просто НЕ ставить)
  const testAmount = Number(process.env.WAYFORPAY_TEST_AMOUNT_UAH ?? "")
  if (Number.isFinite(testAmount) && testAmount > 0) {
    amount = testAmount
  }

  return amount
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any))

  const planId = String(body.planId ?? body.plan_id ?? "monthly")
  const currency = String(body.currency ?? "UAH").toUpperCase()

  const { userId, error } = await getUserIdFromSession()
  if (!userId) {
    return NextResponse.json({ ok: false, error: error || "Unauthorized" }, { status: 401 })
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
  if (!baseUrl) {
    return NextResponse.json(
      { ok: false, error: "Base URL is empty. Set PUBLIC_BASE_URL in production." },
      { status: 500 }
    )
  }

  const host = req.headers.get("host") || "turbotaai.com"
  const merchantDomainName =
    cleanDomain(process.env.WAYFORPAY_MERCHANT_DOMAIN || "") ||
    cleanDomain(host) ||
    "turbotaai.com"

  const amount = resolveAmountUAH(planId, Number(body.amount ?? 0))

  const orderDate = Math.floor(Date.now() / 1000)
  const orderReference = `ta_${planId}_${orderDate}_${crypto.randomBytes(4).toString("hex")}`

  // UI return
  const returnUrl = `${baseUrl}/payment/return?orderReference=${encodeURIComponent(orderReference)}`
  // webhook для фактического занесения оплаты
  const serviceUrl = `${baseUrl}/api/billing/wayforpay/webhook`

  const productName = [`TurbotaAI ${planId}`]
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
        debug: { merchantDomainName, orderReference, amount, currency, serviceUrl, returnUrl },
      },
      { status: 400 }
    )
  }

  // ✅ критично: user_id ВСЕГДА должен быть записан
  try {
    await supabaseAdmin.from("billing_orders").insert({
      order_reference: orderReference,
      user_id: userId,
      device_hash: null,
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
    debug: { amount, serviceUrl, returnUrl },
  })
}
