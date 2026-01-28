import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { createHmac, randomUUID } from "crypto"

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
  const host =
    (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim()
  const origin = host ? `${proto}://${host}` : ""
  return { origin, host }
}

function formatAmount(v: any): string | null {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (n <= 0) return null
  return n.toFixed(2)
}

async function getUserIdFromRequest(): Promise<string | null> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL")
  const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  if (!url || !anon) return null

  const jar = cookies()
  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return jar.getAll()
      },
      setAll() {},
    },
  })

  try {
    const { data } = await sb.auth.getUser()
    return data?.user?.id || null
  } catch {
    return null
  }
}

function sbAdmin() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL")
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function pickPriceFromEnv(planId: string): string | null {
  const p = String(planId || "monthly").toLowerCase()

  // максимально толерантно к названиям переменных (чтобы не сломать текущую конфигурацию)
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

  // общий fallback (для теста 1 грн и т.п.)
  const fallback = formatAmount(env("WAYFORPAY_TEST_AMOUNT")) || formatAmount(env("WAYFORPAY_AMOUNT"))
  return fallback || null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const planId = String(body?.planId || "monthly").trim() || "monthly"

    const currency = String(body?.currency || env("WAYFORPAY_CURRENCY") || "UAH").trim() || "UAH"
    let amountStr = formatAmount(body?.amount) || pickPriceFromEnv(planId)
    // turbota test amount override
    const __turbota_testAmount =
      formatAmount(env("WAYFORPAY_TEST_AMOUNT_UAH")) ||
      formatAmount(env("WAYFORPAY_TEST_AMOUNT"));
    if (__turbota_testAmount) amountStr = __turbota_testAmount;
    if (!amountStr) {
      return NextResponse.json(
        { ok: false, error: "Missing amount (set PRICE_* env or pass amount)" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }

    const merchantAccount = mustEnv("WAYFORPAY_MERCHANT_ACCOUNT")
    const secretKey = mustEnv("WAYFORPAY_SECRET_KEY")

    const { origin, host } = originFromRequest(req)
    if (!origin || !host) {
      return NextResponse.json(
        { ok: false, error: "Cannot detect origin/host" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }

    const hostNoPort = host.split(":")[0]
    const cookieDomain = cookieDomainFromHost(hostNoPort)

    const jar = cookies()
    let deviceHash = jar.get(DEVICE_COOKIE)?.value || ""
    let needSetDeviceCookie = false
    if (!deviceHash) {
      deviceHash = randomUUID()
      needSetDeviceCookie = true
    }

    const userId = await getUserIdFromRequest()

    const orderReference = `TA-${Date.now()}-${randomUUID().slice(0, 8)}`
    const orderDate = Math.floor(Date.now() / 1000)

    const productName = body?.productName ? String(body.productName) : "TurbotaAI subscription"
    const productCount = "1"
    const productPrice = amountStr

    // merchantSignature for PURCHASE:
    // merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;productName...;productCount...;productPrice... :contentReference[oaicite:4]{index=4}
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

    // Сначала создаём заказ в БД
    const admin = sbAdmin()
    await admin.from("billing_orders").insert({
      order_reference: orderReference,
      status: "created",
      plan_id: planId,
      amount: Number(amountStr),
      currency,
      user_id: userId,
      device_hash: deviceHash,
      raw: JSON.stringify({
        __event: "create_invoice_request",
        planId,
        amount: amountStr,
        currency,
        origin,
        serviceUrl,
        returnUrl,
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)

    // Получаем оплатную ссылку через behavior=offline :contentReference[oaicite:5]{index=5}
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

    // Обновим raw ответом
    await admin
      .from("billing_orders")
      .update({
        raw: JSON.stringify({
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
        }),
        updated_at: new Date().toISOString(),
      } as any)
      .eq("order_reference", orderReference)

    if (!r.ok || !invoiceUrl) {
      return NextResponse.json(
        { ok: false, error: "WayForPay offline url failed", httpStatus: r.status, details: j },
        { status: 502, headers: { "cache-control": "no-store" } }
      )
    }

    const res = NextResponse.json(
      { ok: true, orderReference, invoiceUrl },
      { status: 200, headers: { "cache-control": "no-store" } }
    )

    // device cookie
    if (needSetDeviceCookie) {
      res.cookies.set(DEVICE_COOKIE, deviceHash, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      })
    }

    // last order cookie
    res.cookies.set(LAST_ORDER_COOKIE, orderReference, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 14,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    })

    return res
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "create-invoice failed", details: String(e?.message || e) },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
