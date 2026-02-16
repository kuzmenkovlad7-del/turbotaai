import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createHmac, randomUUID } from "crypto"
import { buildAccessSummary } from "@/lib/server/access-summary"
import { getRegionPrice } from "@/lib/billing/plans"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "ta_device_hash"
const LAST_ORDER_COOKIE = "ta_last_order"
const WFP_API_URL = "https://api.wayforpay.com/api"

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

function sbAdmin() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL")
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const planId = String(body?.planId || "monthly").trim() || "monthly"

    // Server-authoritative pricing: derive amount + currency from ta_region cookie
    const region = req.cookies.get("ta_region")?.value || "INTL"
    const regionPrice = getRegionPrice(planId, region)
    const currency = regionPrice.currency
    const amountStr = formatAmount(regionPrice.amount) || "499.00"

    const { summary, pendingCookies, needSetDeviceCookie, deviceHash, cookieDomain } = await buildAccessSummary(req)

    // Block payment if user already has active access (paid OR promo) with >3 days left
    if (summary.unlimited && summary.accessUntil) {
      const daysLeft = (new Date(summary.accessUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      if (daysLeft > 3) {
        return NextResponse.json(
          { ok: false, error: "already_active", accessUntil: summary.accessUntil },
          { status: 409, headers: { "cache-control": "no-store" } }
        )
      }
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

    // Stable merchantDomainName: must match what is registered in the WayForPay merchant account.
    // Do NOT derive from request host — x-forwarded-host may be a Vercel preview URL or
    // differ in www-prefix from the registered domain, breaking the HMAC-MD5 signature.
    const merchantDomainName = env("WAYFORPAY_DOMAIN") || "turbotaai.com"

    // Stable base URL for callback and return URLs (must be reachable HTTPS in production).
    // Falls back to request origin only when env is not configured (e.g. local dev).
    const appBase = env("NEXT_PUBLIC_APP_URL") || env("APP_URL") || origin

    const userId = summary.userId

    const orderReference = `TA-${Date.now()}-${randomUUID().slice(0, 8)}`
    const orderDate = Math.floor(Date.now() / 1000)

    const productName = body?.productName ? String(body.productName) : "TurbotaAI subscription"
    const productCount = "1"
    const productPrice = amountStr

    // Signature field order per WayForPay docs:
    // merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;
    // productName;productCount;productPrice
    const signString = [
      merchantAccount,
      merchantDomainName,
      orderReference,
      String(orderDate),
      amountStr,
      currency,
      productName,
      productCount,
      productPrice,
    ].join(";")

    const merchantSignature = hmacMd5Hex(signString, secretKey)

    const returnUrl = `${appBase}/payment/return?orderReference=${encodeURIComponent(orderReference)}`
    const serviceUrl = `${appBase}/api/billing/wayforpay/callback`

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
        merchantDomainName,
        appBase,
        serviceUrl,
        returnUrl,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)

    const wfpBody = {
      transactionType: "CREATE_INVOICE",
      merchantAccount,
      merchantAuthType: "SimpleSignature",
      merchantDomainName,
      merchantSignature,
      apiVersion: 1,
      language: String(body?.language || "UA"),
      orderReference,
      orderDate,
      amount: Number(amountStr),
      currency,
      productName: [productName],
      productCount: [Number(productCount)],
      productPrice: [Number(productPrice)],
      returnUrl,
      serviceUrl,
    }

    const r = await fetch(WFP_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(wfpBody),
      cache: "no-store",
    })

    const j: any = await r.json().catch(() => ({}))
    const invoiceUrl = String(j?.invoiceUrl || j?.url || "").trim()

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
            merchantDomainName,
            serviceUrl,
            returnUrl,
          },
          response: j,
          httpStatus: r.status,
        },
        updated_at: new Date().toISOString(),
      } as any)
      .eq("order_reference", orderReference)

    if (!r.ok || !invoiceUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: "wayforpay_offline_failed",
          reason: String(j?.reason || ""),
          reasonCode: j?.reasonCode ?? null,
          httpStatus: r.status,
        },
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
        httpOnly: false,
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
