import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createHmac, randomUUID } from "crypto"
import { buildAccessSummary } from "@/lib/server/access-summary"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "ta_device_hash"
const LAST_ORDER_COOKIE = "ta_last_order"
const WFP_OFFLINE_URL = "https://secure.wayforpay.com/pay?behavior=offline"

function env(name: string) {
  return String(process.env[name] || "").trim()
}
function mustEnv(name: string) {
  const v = env(name)
  if (!v) throw new Error("Missing env " + name)
  return v
}

function hmacMd5Hex(str: string, key: string) {
  return createHmac("md5", key).update(str, "utf8").digest("hex")
}

function cookieDomainFromHost(host: string | null) {
  const h = String(host || "").toLowerCase()
  if (h.endsWith(".turbotaai.com") || h === "turbotaai.com") return ".turbotaai.com"
  return undefined
}

function originFromRequest(req: NextRequest) {
  const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0].trim()
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim()
  const origin = host ? `${proto}://${host}` : ""
  return { origin, host }
}

function formatAmount(v: any): string | null {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (n <= 0) return null
  return n.toFixed(2)
}

function pickPriceFromEnv(planId: string): string | null {
  const p = String(planId || "monthly").toLowerCase()

  const candidates =
    p === "yearly" || p === "annual" || p === "year"
      ? [
          env("PRICE_UAH_YEARLY"),
          env("PRICE_YEARLY_UAH"),
          env("WAYFORPAY_PRICE_YEARLY"),
          env("WAYFORPAY_AMOUNT_YEARLY"),
          env("WAYFORPAY_YEARLY_AMOUNT"),
        ]
      : [
          env("PRICE_UAH_MONTHLY"),
          env("PRICE_MONTHLY_UAH"),
          env("WAYFORPAY_PRICE_MONTHLY"),
          env("WAYFORPAY_AMOUNT_MONTHLY"),
          env("WAYFORPAY_MONTHLY_AMOUNT"),
        ]

  for (const c of candidates) {
    const a = formatAmount(c)
    if (a) return a
  }

  const fallback = formatAmount(env("WAYFORPAY_TEST_AMOUNT")) || formatAmount(env("WAYFORPAY_AMOUNT"))
  return fallback || null
}

function sbAdmin() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL")
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const planId = String(body?.planId || "monthly").trim() || "monthly"

    const currency = String(body?.currency || env("WAYFORPAY_CURRENCY") || "UAH").trim() || "UAH"

    let amountStr = formatAmount(body?.amount) || pickPriceFromEnv(planId)

    const forcedTest =
      formatAmount(env("WAYFORPAY_TEST_AMOUNT_UAH")) ||
      formatAmount(env("WAYFORPAY_TEST_AMOUNT"))

    if (forcedTest) amountStr = forcedTest

    if (!amountStr) {
      return NextResponse.json(
        { ok: false, error: "missing_amount" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }

    const { summary, pendingCookies, needSetDeviceCookie, deviceHash, cookieDomain } = await buildAccessSummary(req)

    if (summary.hasPaid && summary.paidUntil) {
      return NextResponse.json(
        { ok: false, error: "already_active", paidUntil: summary.paidUntil },
        { status: 409, headers: { "cache-control": "no-store" } }
      )
    }

    const merchantAccount = mustEnv("WAYFORPAY_MERCHANT_ACCOUNT")
    const secretKey = mustEnv("WAYFORPAY_SECRET_KEY")

    const { origin, host } = originFromRequest(req)
    if (!origin || !host) {
      return NextResponse.json(
        { ok: false, error: "cannot_detect_origin" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }

    const hostNoPort = host.split(":")[0]
    const domain = cookieDomainFromHost(hostNoPort)

    const userId = summary.userId

    const orderReference = `TA-${Date.now()}-${randomUUID().slice(0, 8)}`
    const orderDate = Math.floor(Date.now() / 1000)

    const productName = body?.productName ? String(body.productName) : "TurbotaAI subscription"
    const productCount = "1"
    const productPrice = amountStr

    const signString = [
      merchantAccount,
      hostNoPort,
      orderReference,
      String(orderDate),
      amountStr,
      currency,
      productName,
      productCount,
      productPrice,
    ].join(";")

    const merchantSignature = hmacMd5Hex(signString, secretKey)

    const returnUrl = `${origin}/payment/return?orderReference=${encodeURIComponent(orderReference)}`
    const serviceUrl = `${origin}/api/billing/wayforpay/callback`

    const admin = sbAdmin()

    await admin.from("billing_orders").insert({
      order_reference: orderReference,
      status: "created",
      plan_id: planId,
      amount: Number(amountStr),
      currency,
      user_id: userId,
      device_hash: deviceHash,
      raw: {
        __event: "create_invoice_request",
        planId,
        amount: amountStr,
        currency,
        origin,
        serviceUrl,
        returnUrl,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)

    const form = new URLSearchParams()
    form.set("merchantAccount", merchantAccount)
    form.set("merchantDomainName", hostNoPort)
    form.set("orderReference", orderReference)
    form.set("orderDate", String(orderDate))
    form.set("amount", amountStr)
    form.set("currency", currency)
    form.append("productName[]", productName)
    form.append("productCount[]", productCount)
    form.append("productPrice[]", productPrice)
    form.set("merchantSignature", merchantSignature)
    form.set("apiVersion", "1")
    form.set("language", String(body?.language || "UA"))
    form.set("returnUrl", returnUrl)
    form.set("serviceUrl", serviceUrl)

    const r = await fetch(WFP_OFFLINE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    })

    const j: any = await r.json().catch(() => ({}))
    const invoiceUrl = String(j?.url || "").trim()

    await admin
      .from("billing_orders")
      .update({
        status: invoiceUrl ? "invoice_created" : "failed",
        raw: {
          __event: "create_invoice_response",
          request: {
            orderReference,
            orderDate,
            amount: amountStr,
            currency,
            planId,
          },
          response: j,
          httpStatus: r.status,
        },
        updated_at: new Date().toISOString(),
      } as any)
      .eq("order_reference", orderReference)

    if (!r.ok || !invoiceUrl) {
      return NextResponse.json(
        { ok: false, error: "wayforpay_offline_failed", httpStatus: r.status, details: j },
        { status: 502, headers: { "cache-control": "no-store" } }
      )
    }

    const res = NextResponse.json(
      { ok: true, orderReference, invoiceUrl },
      { status: 200, headers: { "cache-control": "no-store" } }
    )

    if (needSetDeviceCookie) {
      res.cookies.set(DEVICE_COOKIE, deviceHash, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
        domain: cookieDomain || domain,
      })
    }

    res.cookies.set(LAST_ORDER_COOKIE, orderReference, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      domain: cookieDomain || domain,
    })

    for (const c of pendingCookies) {
      res.cookies.set(c.name, c.value, c.options)
    }

    return res
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "create_invoice_failed", details: String(e?.message || e) },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
