import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "turbotaai_device"

function hmacMd5(message: string, secret: string) {
  return crypto.createHmac("md5", secret).update(message, "utf8").digest("hex")
}

function pickEnv(...keys: string[]) {
  for (const k of keys) {
    const v = String(process.env[k] || "").trim()
    if (v) return v
  }
  return ""
}

function normalizeDomain(input: string) {
  let s = String(input || "").trim()
  if (!s) return ""
  if (/^https?:\/\//i.test(s)) {
    try {
      return new URL(s).hostname.toLowerCase()
    } catch {
      return ""
    }
  }
  s = s.split("/")[0]
  s = s.split(":")[0]
  return s.toLowerCase()
}

function esc(s: any) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function ensureDeviceHash() {
  const jar = cookies()
  let v = String(jar.get(DEVICE_COOKIE)?.value || "").trim()
  if (v) return v

  v = crypto.randomUUID()
  jar.set(DEVICE_COOKIE, v, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  })
  return v
}

function amountForPlan(planId: string) {
  const raw = pickEnv("NEXT_PUBLIC_PRICE_UAH", "PRICE_UAH", "PLAN_MONTHLY_PRICE_UAH")
  const n = Number(raw || "499")
  return Number.isFinite(n) && n > 0 ? n : 499
}

function formatAmount(n: number) {
  // WayForPay нормально принимает amount как 2 знака
  return (Math.round(n * 100) / 100).toFixed(2)
}

async function resolveUserIdViaSSR() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) return null

    const store = cookies()

    const sb = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return store.getAll()
        },
        setAll() {
          // нам здесь не нужно обновлять cookies
        },
      },
    })

    const { data } = await sb.auth.getUser()
    return data?.user?.id || null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const sp = req.nextUrl.searchParams

  const planId = String(sp.get("planId") || "monthly").trim() || "monthly"
  const orderReference =
    String(sp.get("orderReference") || "").trim() ||
    `ta_${planId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`

  const deviceHash = ensureDeviceHash()

  // ВАЖНО: merchantAccount = MERCHANT LOGIN (например turbotaai_com), НЕ домен и НЕ ID
  const merchantAccount = pickEnv("WAYFORPAY_MERCHANT_ACCOUNT", "WFP_MERCHANT_ACCOUNT")
  const secretKey = pickEnv("WAYFORPAY_SECRET_KEY", "WFP_SECRET_KEY")

  const merchantDomainName =
    normalizeDomain(pickEnv("WAYFORPAY_MERCHANT_DOMAIN_NAME", "WAYFORPAY_MERCHANT_DOMAIN")) ||
    normalizeDomain(req.nextUrl.hostname)

  if (!merchantAccount || !secretKey || !merchantDomainName) {
    return NextResponse.json(
      {
        ok: false,
        error: "WayForPay env missing",
        need: ["WAYFORPAY_MERCHANT_ACCOUNT", "WAYFORPAY_MERCHANT_DOMAIN_NAME", "WAYFORPAY_SECRET_KEY"],
      },
      { status: 500 }
    )
  }

  const userId = await resolveUserIdViaSSR()

  const amount = amountForPlan(planId)
  const amountStr = formatAmount(amount)
  const currency = "UAH"

  const productName = [planId === "monthly" ? "TurbotaAI Monthly" : "TurbotaAI Plan"]
  const productCount = ["1"]
  const productPrice = [amountStr]

  const orderDate = Math.floor(Date.now() / 1000)

  const returnUrlBase = pickEnv("WAYFORPAY_RETURN_URL") || "/payment/result"
  const ret = new URL(returnUrlBase, origin)
  ret.searchParams.set("orderReference", orderReference)
  const returnUrl = ret.toString()

  const serviceUrl = pickEnv("WAYFORPAY_WEBHOOK_URL") || `${origin}/api/billing/wayforpay/webhook`

  // signature строка: merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;productName...;productCount...;productPrice...
  const signStr = [
    merchantAccount,
    merchantDomainName,
    orderReference,
    String(orderDate),
    amountStr,
    currency,
    ...productName,
    ...productCount,
    ...productPrice,
  ].join(";")

  const merchantSignature = hmacMd5(signStr, secretKey)

  // сохраняем заказ в БД
  try {
    const admin = getSupabaseAdmin()
    const nowIso = new Date().toISOString()

    await admin
      .from("billing_orders")
      .upsert(
        {
          order_reference: orderReference,
          user_id: userId,
          device_hash: deviceHash,
          plan_id: planId,
          amount: Number(amountStr),
          currency,
          status: "invoice_created",
          raw: {
            planId,
            deviceHash,
            userId,
            created_at: nowIso,
            last_event: "purchase",
          },
          created_at: nowIso,
          updated_at: nowIso,
        } as any,
        { onConflict: "order_reference" }
      )
  } catch {}

  const fields: Record<string, any> = {
    merchantAccount,
    merchantDomainName,
    orderReference,
    orderDate,
    amount: amountStr,
    currency,
    merchantSignature,
    returnUrl,
    serviceUrl,
    language: "RU",
    merchantTransactionType: "SALE",
  }

  const baseInputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("\n")

  const arrInputs =
    productName.map((v) => `<input type="hidden" name="productName[]" value="${esc(v)}">`).join("\n") +
    "\n" +
    productCount.map((v) => `<input type="hidden" name="productCount[]" value="${esc(v)}">`).join("\n") +
    "\n" +
    productPrice.map((v) => `<input type="hidden" name="productPrice[]" value="${esc(v)}">`).join("\n")

  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Оплата</title>
</head>
<body style="font-family: system-ui; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto;">
    <h2 style="margin: 0 0 8px;">Перенаправляем на оплату…</h2>
    <div style="opacity: .7; font-size: 14px;">Если ничего не происходит, нажмите кнопку ниже.</div>

    <form id="wfpForm" method="POST" action="https://secure.wayforpay.com/pay" style="margin-top: 16px;">
      ${baseInputs}
      ${arrInputs}
      <button type="submit" style="padding: 12px 16px; border-radius: 12px; border: 1px solid #ddd; background: #111; color: #fff; width: 100%;">
        Перейти к оплате
      </button>
    </form>
  </div>

  <script>
    setTimeout(() => {
      const f = document.getElementById("wfpForm");
      if (f) f.submit();
    }, 50);
  </script>
</body>
</html>`

  const res = new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  })

  res.cookies.set("ta_last_order", orderReference, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  })

  return res
}
