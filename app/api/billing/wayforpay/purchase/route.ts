import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEVICE_COOKIE = "ta_device_hash";

function hmacMd5HexLower(message: string, secret: string) {
  return crypto.createHmac("md5", secret).update(message, "utf8").digest("hex");
}

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_PROJECT_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function getCookie(req: Request, name: string) {
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

function htmlEscape(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function hidden(name: string, value: string) {
  return `<input type="hidden" name="${htmlEscape(name)}" value="${htmlEscape(value)}" />`;
}

function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function handler(req: Request) {
  const url = new URL(req.url);
  const planId = (url.searchParams.get("planId") || url.searchParams.get("plan") || "monthly").toLowerCase();
  const debug = url.searchParams.get("debug") === "1";

  const merchantAccount =
    process.env.WAYFORPAY_MERCHANT_ACCOUNT ||
    process.env.WAYFORPAY_MERCHANT ||
    "";

  const merchantDomainName =
    process.env.WAYFORPAY_DOMAIN ||
    "www.turbotaai.com";

  const secret =
    process.env.WAYFORPAY_SECRET_KEY ||
    process.env.WAYFORPAY_SECRET ||
    "";

  const currency = "UAH";

  // Цена только из env, дефолт 499
  // Для теста ставишь 1 в Vercel env и делаешь redeploy
  const monthlyPrice = num(
    process.env.TA_MONTHLY_PRICE_UAH ||
      process.env.MONTHLY_PRICE_UAH ||
      process.env.NEXT_PUBLIC_TA_MONTHLY_PRICE_UAH ||
      499,
    499
  );

  const amountNumber = planId === "monthly" ? monthlyPrice : monthlyPrice;

  const amount = Number(amountNumber || 0);
  const amountStr = amount.toFixed(2);

  const productName = planId === "monthly" ? "TurbotaAI Monthly" : "TurbotaAI Monthly";
  const productCount = "1";
  const productPrice = amountStr;

  const orderDate = Math.floor(Date.now() / 1000).toString();
  const orderReference = `ta_${planId}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;

  const signString = [
    merchantAccount,
    merchantDomainName,
    orderReference,
    orderDate,
    amountStr,
    currency,
    productName,
    productCount,
    productPrice,
  ].join(";");

  const merchantSignature = secret ? hmacMd5HexLower(signString, secret) : "";

  const existingDeviceHash = getCookie(req, DEVICE_COOKIE);
  const deviceHash = existingDeviceHash || crypto.randomUUID();

  // Пишем billing_orders, но не тормозим ответ если Supabase завис
  try {
    const sb = getSupabaseAdmin();
    if (sb) {
      await Promise.race([
        sb.from("billing_orders").upsert([
          {
            order_reference: orderReference,
            plan_id: planId,
            amount,
            currency,
            status: "invoice_created",
            device_hash: deviceHash,
            raw: {
              merchantAccount,
              merchantDomainName,
              orderReference,
              orderDate,
              amount: amountStr,
              currency,
              productName,
              productCount,
              productPrice,
            },
          },
        ]),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    }
  } catch {}

  if (debug) {
    return NextResponse.json({
      ok: true,
      merchantAccount,
      merchantDomainName,
      orderReference,
      orderDate,
      amount: amountStr,
      currency,
      signString,
      merchantSignature,
    });
  }

  // Важно: returnUrl сразу с orderReference
  const returnUrl = `${url.origin}/payment/result?orderReference=${encodeURIComponent(orderReference)}`;
  const serviceUrl = `${url.origin}/api/billing/wayforpay/callback`;

  const baseInputs = [
    hidden("merchantAccount", merchantAccount),
    hidden("merchantDomainName", merchantDomainName),
    hidden("merchantAuthType", "SimpleSignature"),
    hidden("orderReference", orderReference),
    hidden("orderDate", orderDate),
    hidden("amount", amountStr),
    hidden("currency", currency),
    hidden("merchantSignature", merchantSignature),
    hidden("returnUrl", returnUrl),
    hidden("serviceUrl", serviceUrl),
  ].join("\n");

  const arrInputs = [
    hidden("productName[]", productName),
    hidden("productCount[]", productCount),
    hidden("productPrice[]", productPrice),
  ].join("\n");

  const html = `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Оплата</title>
</head>
<body style="font-family: system-ui; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto;">
    <h2 style="margin: 0 0 8px;">Перенаправляємо на оплату…</h2>
    <div style="opacity: .7; font-size: 14px;">Якщо нічого не відбувається, натисніть кнопку нижче.</div>

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

  res.cookies.set(DEVICE_COOKIE, deviceHash, {
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
