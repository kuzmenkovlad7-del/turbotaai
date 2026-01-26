import crypto from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hmacMd5HexUpper(str: string, secret: string) {
  return crypto.createHmac("md5", secret).update(str, "utf8").digest("hex").toUpperCase();
}

function getOrigin(req: Request) {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

function parseMoney2(raw: string) {
  const n = Number(String(raw ?? "").trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return "499.00";
  return n.toFixed(2);
}

function getMonthlyPriceUah() {
  // Серверная цена (для подписи) — БЕРЁМ ИЗ TA_MONTHLY_PRICE_UAH,
  // если не задано — fallback на NEXT_PUBLIC_PRICE_UAH,
  // если и там пусто — 499
  const raw =
    process.env.TA_MONTHLY_PRICE_UAH ||
    process.env.NEXT_PUBLIC_PRICE_UAH ||
    "499";
  return parseMoney2(raw);
}

async function handler(req: Request) {
  const url = new URL(req.url);
  const planId = (url.searchParams.get("planId") || "monthly").toLowerCase();
  const debug = url.searchParams.get("debug") === "1";

  const origin = getOrigin(req);

  const merchantAccount = (process.env.WAYFORPAY_MERCHANT_ACCOUNT || "").trim();
  const secretKey = (process.env.WAYFORPAY_SECRET_KEY || "").trim();

  if (!merchantAccount || !secretKey) {
    return NextResponse.json(
      { ok: false, error: "Missing WAYFORPAY_MERCHANT_ACCOUNT or WAYFORPAY_SECRET_KEY" },
      { status: 500 }
    );
  }

  const merchantDomainName = new URL(origin).host;
  const currency = "UAH";

  const amount = planId === "monthly" ? getMonthlyPriceUah() : getMonthlyPriceUah();

  const orderReference = `ta_${planId}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
  const orderDate = String(Math.floor(Date.now() / 1000));

  const productName = planId === "monthly" ? "TurbotaAI Monthly" : "TurbotaAI";
  const productCount = "1";
  const productPrice = amount;

  // ВАЖНО: signString строго по доке
  const signString = [
    merchantAccount,
    merchantDomainName,
    orderReference,
    orderDate,
    amount,
    currency,
    productName,
    productCount,
    productPrice,
  ].join(";");

  const merchantSignature = hmacMd5HexUpper(signString, secretKey);

  // device hash (чтобы потом матчить пользователя)
  const existingDeviceHash = cookies().get("ta_device_hash")?.value;
  const deviceHash = existingDeviceHash || crypto.randomBytes(16).toString("hex");

  if (debug) {
    return NextResponse.json({
      ok: true,
      merchantAccount,
      merchantDomainName,
      orderReference,
      orderDate,
      amount,
      currency,
      signString,
      merchantSignature,
    });
  }

  const esc = (s: string) =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const baseInputs = [
    ["merchantAccount", merchantAccount],
    ["merchantAuthType", "SimpleSignature"],
    ["merchantDomainName", merchantDomainName],
    ["orderReference", orderReference],
    ["orderDate", orderDate],
    ["amount", amount],
    ["currency", currency],

    // Эти два поля очень желательно передать
    ["returnUrl", `${origin}/payment/return`],
    ["serviceUrl", `${origin}/api/billing/wayforpay/callback`],
  ]
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}" />`)
    .join("\n");

  const arrInputs = `
    <input type="hidden" name="productName[]" value="${esc(productName)}" />
    <input type="hidden" name="productCount[]" value="${esc(productCount)}" />
    <input type="hidden" name="productPrice[]" value="${esc(productPrice)}" />
    <input type="hidden" name="merchantSignature" value="${esc(merchantSignature)}" />
  `;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Redirecting…</title>
</head>
<body style="font-family: system-ui; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto;">
    <h2 style="margin: 0 0 8px;">Перенаправляємо на оплату…</h2>
    <div style="opacity: .7; font-size: 14px;">Якщо нічого не відбувається — натисніть кнопку нижче.</div>

    <form id="wfpForm" method="POST" action="https://secure.wayforpay.com/pay" accept-charset="utf-8" style="margin-top: 16px;">
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
</html>`;

  const res = new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });

  res.cookies.set("ta_last_order", orderReference, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });

  res.cookies.set("ta_device_hash", deviceHash, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return res;
}

export async function GET(req: Request) {
  return handler(req);
}

export async function POST(req: Request) {
  return handler(req);
}
