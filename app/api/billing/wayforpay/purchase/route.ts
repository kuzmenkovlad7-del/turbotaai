import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { cookies } from "next/headers"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "turbotaai_device"

function hmacMd5(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str).digest("hex")
}

function pickEnv(...keys: string[]) {
  for (const k of keys) {
    const v = String(process.env[k] || "").trim()
    if (v) return v
  }
  return ""
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

// ✅ FIX: без replaceAll, чтобы TS build не падал
function esc(s: any) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function amountForPlan(planId: string) {
  const test = Number(pickEnv("WAYFORPAY_TEST_AMOUNT_UAH") || 0)
  if (Number.isFinite(test) && test > 0) return test

  const monthly = Number(pickEnv("WAYFORPAY_MONTHLY_AMOUNT") || 0)
  if (planId === "monthly" && Number.isFinite(monthly) && monthly > 0) return monthly

  return 1
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const sp = req.nextUrl.searchParams

  const planId = String(sp.get("planId") || "monthly").trim() || "monthly"
  const orderReference =
    String(sp.get("orderReference") || "").trim() ||
    `ta_${planId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`

  const deviceHash = ensureDeviceHash()

  const merchantAccount = pickEnv("WAYFORPAY_MERCHANT_ACCOUNT", "WFP_MERCHANT_ACCOUNT")
  const secretKey = pickEnv("WAYFORPAY_SECRET_KEY", "WFP_SECRET_KEY")
  const merchantDomainName =
    pickEnv("WAYFORPAY_MERCHANT_DOMAIN_NAME", "WAYFORPAY_MERCHANT_DOMAIN") || req.nextUrl.hostname

  if (!merchantAccount || !secretKey) {
    return NextResponse.json({ ok: false, error: "WayForPay env missing" }, { status: 200 })
  }

  const amount = amountForPlan(planId)
  const currency = "UAH"
  const productName = ["TurbotaAI Monthly"]
  const productCount = [1]
  const productPrice = [amount]

  const orderDate = Math.floor(Date.now() / 1000)

  // ✅ Всегда возвращаем на /payment/return → /payment/result
  const returnUrlBase = pickEnv("WAYFORPAY_RETURN_URL") || `${origin}/payment/return`
  const ret = new URL(returnUrlBase)
  ret.searchParams.set("orderReference", orderReference)
  const returnUrl = ret.toString()

  // ✅ Webhook только сюда
  const serviceUrl = pickEnv("WAYFORPAY_WEBHOOK_URL") || `${origin}/api/billing/wayforpay/webhook`

  const signStr = [
    merchantAccount,
    merchantDomainName,
    orderReference,
    String(orderDate),
    String(amount),
    currency,
    ...productName,
    ...productCount.map(String),
    ...productPrice.map(String),
  ].join(";")

  const merchantSignature = hmacMd5(signStr, secretKey)

  // ✅ Сохраняем заказ (для guest важно сохранить deviceHash)
  try {
    const admin = getSupabaseAdmin()
    const nowIso = new Date().toISOString()

    await admin.from("billing_orders").insert({
      order_reference: orderReference,
      user_id: null,
      status: "invoice_created",
      amount: Number(amount),
      currency,
      raw: {
        planId,
        deviceHash,
        created_at: nowIso,
        last_event: "purchase",
      },
      updated_at: nowIso,
    } as any)
  } catch {
    // ignore
  }

  const fields: Record<string, any> = {
    merchantAccount,
    merchantDomainName,
    orderReference,
    orderDate,
    amount,
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

  // ✅ чек-код на устройстве (чтобы /payment/result мог восстановить)
  res.cookies.set("ta_last_order", orderReference, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  })

  return res
}
