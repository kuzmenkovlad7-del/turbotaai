import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function env(name: string) {
  return (process.env[name] || "").trim()
}

function esc(v: any) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function hmacMd5HexUpper(data: string, key: string) {
  return crypto.createHmac("md5", key).update(data).digest("hex").toUpperCase()
}

function jwtSub(token: string): string | null {
  try {
    const p = token.split(".")[1]
    if (!p) return null
    const json = Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    const payload = JSON.parse(json)
    return payload?.sub ? String(payload.sub) : null
  } catch {
    return null
  }
}

function getUserIdFromCookies(): string | null {
  const c = cookies()

  // auth-helpers style
  const t1 = c.get("sb-access-token")?.value
  if (t1) {
    const sub = jwtSub(t1)
    if (sub) return sub
  }

  // older SSR cookie style: sb-*-auth-token (JSON)
  const all = c.getAll()
  for (const ck of all) {
    if (ck.name.startsWith("sb-") && ck.name.endsWith("-auth-token")) {
      try {
        const obj = JSON.parse(ck.value)
        const access = obj?.access_token || obj?.currentSession?.access_token
        if (access) {
          const sub = jwtSub(String(access))
          if (sub) return sub
        }
      } catch {}
    }
  }

  return null
}

async function handler(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin

  const planId = url.searchParams.get("planId") || "monthly"
  const orderReference =
    url.searchParams.get("orderReference") ||
    `ta_${planId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`

  // Цена тарифа (потом можно вынести в env)
  const amount = planId === "monthly" ? "499" : "499"
  const currency = "UAH"
  const orderDate = Math.floor(Date.now() / 1000).toString()

  const productName = ["TurbotaAI Monthly"]
  const productCount = ["1"]
  const productPrice = [amount]

  // device hash
  const c = cookies()
  const deviceHash = c.get("ta_device_hash")?.value || crypto.randomUUID()
  const userId = getUserIdFromCookies()

  // сохраним заказ в БД (invoice_created)
  const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL")
  const SERVICE_ROLE = env("SUPABASE_SERVICE_ROLE_KEY")
  const ordersTable = env("TA_ORDERS_TABLE") || "billing_orders"

  if (SUPABASE_URL && SERVICE_ROLE) {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    await supabase
      .from(ordersTable)
      .upsert(
        {
          order_reference: orderReference,
          user_id: userId,
          device_hash: deviceHash,
          plan_id: planId,
          amount,
          currency,
          status: "invoice_created",
          raw: JSON.stringify({
            planId,
            userId,
            deviceHash,
            created_at: new Date().toISOString(),
            last_event: "purchase",
          }),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_reference" }
      )
  }

  // WFP credentials
  const merchantAccount = env("WAYFORPAY_MERCHANT_ACCOUNT")
  const merchantDomainName = env("WAYFORPAY_MERCHANT_DOMAIN_NAME") || url.hostname
  const secretKey =
    env("WAYFORPAY_SECRET_KEY") || env("WAYFORPAY_SECRET") || env("WAYFORPAY_MERCHANT_SECRET_KEY")

  if (!merchantAccount || !secretKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "WayForPay env missing",
        need: ["WAYFORPAY_MERCHANT_ACCOUNT", "WAYFORPAY_SECRET_KEY"],
      },
      { status: 500 }
    )
  }

  // simpleSignature for purchase
  // merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;productName...;productCount...;productPrice...
  const signString = [
    merchantAccount,
    merchantDomainName,
    orderReference,
    orderDate,
    amount,
    currency,
    ...productName,
    ...productCount,
    ...productPrice,
  ].join(";")

  const merchantSignature = hmacMd5HexUpper(signString, secretKey)

  const serviceUrl = env("WAYFORPAY_WEBHOOK_URL") || `${origin}/api/billing/wayforpay/webhook`
  const returnUrl =
    env("WAYFORPAY_RETURN_URL") ||
    `${origin}/payment/result?orderReference=${encodeURIComponent(orderReference)}`

  const baseInputs = [
    ["merchantAccount", merchantAccount],
    ["merchantDomainName", merchantDomainName],
    ["merchantAuthType", "simpleSignature"],
    ["merchantSignature", merchantSignature],
    ["orderReference", orderReference],
    ["orderDate", orderDate],
    ["amount", amount],
    ["currency", currency],
    ["serviceUrl", serviceUrl],
    ["returnUrl", returnUrl],
    ["language", "UA"],
  ]
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("\n")

  const arrInputs =
    productName.map((v) => `<input type="hidden" name="productName[]" value="${esc(v)}">`).join("\n") +
    "\n" +
    productCount.map((v) => `<input type="hidden" name="productCount[]" value="${esc(v)}">`).join("\n") +
    "\n" +
    productPrice.map((v) => `<input type="hidden" name="productPrice[]" value="${esc(v)}">`).join("\n")

  const html = `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Оплата</title>
</head>
<body style="font-family: system-ui; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto;">
    <h2 style="margin: 0 0 8px;">Перенаправляємо на оплату…</h2>
    <div style="opacity: .7; font-size: 14px;">Якщо нічого не відбувається — натисніть кнопку нижче.</div>

    <form id="wfpForm" method="POST" action="https://secure.wayforpay.com/pay" style="margin-top: 16px;">
      ${baseInputs}
      ${arrInputs}
      <button type="submit" style="padding: 12px 16px; border-radius: 12px; border: 1px solid #ddd; background: #111; color: #fff; width: 100%;">
        Перейти до оплати
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

  // важные cookies для связки device/order
  res.cookies.set("ta_last_order", orderReference, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  })

  res.cookies.set("ta_device_hash", deviceHash, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })

  return res
}

export async function GET(req: Request) {
  return handler(req)
}

export async function POST(req: Request) {
  return handler(req)
}
