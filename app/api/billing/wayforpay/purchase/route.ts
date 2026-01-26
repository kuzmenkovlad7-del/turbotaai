import { NextResponse } from "next/server"
import crypto from "crypto"

export const dynamic = "force-dynamic"

function env(name: string) {
  return String(process.env[name] || "").trim()
}

function hmacMd5HexUpper(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str, "utf8").digest("hex").toUpperCase()
}

function esc(v: any) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export async function POST(req: Request) {
  const body: any = await req.json().catch(() => ({}))

  const merchantAccount = env("WAYFORPAY_MERCHANT_ACCOUNT")
  const merchantDomainName = env("WAYFORPAY_MERCHANT_DOMAIN_NAME")
  const secretKey = env("WAYFORPAY_SECRET_KEY") || env("WAYFORPAY_MERCHANT_SECRET_KEY")

  if (!merchantAccount || !merchantDomainName || !secretKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "WayForPay env missing",
        merchantAccount: !!merchantAccount,
        merchantDomainName: !!merchantDomainName,
        secretKey: !!secretKey,
      },
      { status: 500 }
    )
  }

  const plan = String(body?.plan || "monthly")
  const amount = String(body?.amount || "499") // можно "1" для теста
  const currency = String(body?.currency || "UAH")

  const orderReference = `ta_${plan}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`
  const orderDate = Math.floor(Date.now() / 1000).toString() // СЕКУНДЫ

  const productName = [plan === "monthly" ? "TurbotaAI Monthly" : "TurbotaAI"]
  const productCount = ["1"]
  const productPrice = [amount]

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

  const baseUrl = env("NEXT_PUBLIC_APP_URL") || "https://turbotaai.com"

  const serviceUrl = env("WAYFORPAY_WEBHOOK_URL") || `${baseUrl}/api/billing/wayforpay/webhook`

  const returnUrlBase = env("WAYFORPAY_RETURN_URL") || `${baseUrl}/payment/return`
  const returnUrl =
    `${returnUrlBase}${returnUrlBase.includes("?") ? "&" : "?"}` +
    `orderReference=${encodeURIComponent(orderReference)}`

  const baseInputs = [
    ["merchantAccount", merchantAccount],
    ["merchantDomainName", merchantDomainName],
    ["merchantSignature", merchantSignature],
    ["orderReference", orderReference],
    ["orderDate", orderDate],
    ["amount", amount],
    ["currency", currency],
    ["serviceUrl", serviceUrl],
    ["returnUrl", returnUrl],
    ["language", "UA"],
    ["merchantAuthType", "simpleSignature"],
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

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}
