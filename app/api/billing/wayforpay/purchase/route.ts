import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) throw new Error("Missing Supabase admin env")
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function getUserFromSession() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return { user: null as any, error: "Missing Supabase public env" }

  const cookieStore = cookies()
  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user?.id) return { user: null, error: error?.message || "Unauthorized" }
  return { user: data.user, error: null }
}

function getBaseUrl(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "https"
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || ""
  return `${proto}://${host}`
}

function hmacMd5(secretKey: string, s: string) {
  return crypto.createHmac("md5", secretKey).update(s).digest("hex")
}

function esc(v: any) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function addDays(d: Date, days: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

function fmtDateYYYYMMDD(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export async function GET(req: NextRequest) {
  const { user, error } = await getUserFromSession()
  if (!user) return NextResponse.json({ ok: false, error }, { status: 401 })

  const merchantAccount = String(process.env.WAYFORPAY_MERCHANT_ACCOUNT ?? "").trim()
  const secretKey = String(process.env.WAYFORPAY_SECRET_KEY ?? "").trim()

  const merchantDomainName = String(
    process.env.WAYFORPAY_MERCHANT_DOMAIN_NAME ??
      process.env.WAYFORPAY_MERCHANT_DOMAIN ??
      ""
  ).trim()

  if (!merchantAccount || !secretKey || !merchantDomainName) {
    return NextResponse.json(
      {
        ok: false,
        error: "WayForPay env missing",
        missing: [
          "WAYFORPAY_MERCHANT_ACCOUNT",
          "WAYFORPAY_SECRET_KEY",
          "WAYFORPAY_MERCHANT_DOMAIN_NAME or WAYFORPAY_MERCHANT_DOMAIN",
        ],
      },
      { status: 500 }
    )
  }

  const url = new URL(req.url)
  const planId = String(url.searchParams.get("planId") ?? "monthly").trim()

  const baseAmount = Number(process.env.BILLING_MONTHLY_PRICE_UAH ?? "499") || 499
  const testAmount = Number(process.env.WAYFORPAY_TEST_AMOUNT_UAH ?? "0") || 0
  const amount = Number.isFinite(testAmount) && testAmount > 0 ? testAmount : baseAmount

  const currency = "UAH"
  const orderDate = Math.floor(Date.now() / 1000)

  // формат как у тебя на скрине: ta_monthly_1769252878_3cfaed14
  const ts = Math.floor(Date.now() / 1000)
  const rnd = crypto.randomBytes(4).toString("hex")
  const orderReference = `ta_${planId}_${ts}_${rnd}`

  const productName = `TurbotaAI ${planId}`
  const productCount = "1"
  const productPrice = String(amount)

  const baseUrl = getBaseUrl(req)
  const serviceUrl = `${baseUrl}/api/billing/wayforpay/webhook`
  const returnUrl = `${baseUrl}/payment/result?orderReference=${encodeURIComponent(orderReference)}`

  const dateNext = fmtDateYYYYMMDD(addDays(new Date(), 30))

  const signStr = [
    merchantAccount,
    merchantDomainName,
    orderReference,
    String(orderDate),
    String(amount),
    currency,
    productName,
    productCount,
    productPrice,
  ].join(";")

  const merchantSignature = hmacMd5(secretKey, signStr)

  const payload: Record<string, any> = {
    merchantAccount,
    merchantAuthType: "SimpleSignature",
    merchantDomainName,
    merchantSignature,
    orderReference,
    orderDate,
    amount: String(amount),
    currency,
    productName: [productName],
    productCount: [productCount],
    productPrice: [productPrice],
    clientEmail: user.email || undefined,
    returnUrl,
    serviceUrl,

    // регулярные платежи
    regularOn: "1",
    regularMode: "monthly",
    regularBehavior: "preset",
    regularAmount: String(amount),
    dateNext,
  }

  // пишем заказ в БД ДО редиректа
  try {
    const admin = getSupabaseAdmin()
    await admin.from("billing_orders").insert({
      order_reference: orderReference,
      user_id: user.id,
      plan_id: planId,
      amount,
      currency,
      status: "invoice_created",
      raw: { purchase: payload },
    })
  } catch (e) {
    console.error("[billing][purchase] billing_orders insert failed", e)
  }

  // HTML form auto-submit
  const inputs: string[] = []

  for (const [k, v] of Object.entries(payload)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        inputs.push(`<input type="hidden" name="${esc(k)}[]" value="${esc(item)}" />`)
      }
      continue
    }
    if (v === undefined) continue
    inputs.push(`<input type="hidden" name="${esc(k)}" value="${esc(v)}" />`)
  }

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body>
<form id="wfp" method="post" action="https://secure.wayforpay.com/pay">
${inputs.join("\n")}
<noscript><button type="submit">Continue</button></noscript>
</form>
<script>document.getElementById("wfp").submit();</script>
</body>
</html>`

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  })
}
