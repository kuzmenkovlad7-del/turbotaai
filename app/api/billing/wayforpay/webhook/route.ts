import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error("Supabase env missing: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function hmacMd5(message: string, secret: string) {
  return crypto.createHmac("md5", secret).update(message, "utf8").digest("hex");
}

async function readWayForPayBody(req: NextRequest): Promise<Record<string, any>> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  // JSON
  if (ct.includes("application/json")) {
    try {
      return await req.json();
    } catch {
      return {};
    }
  }

  // FormData (multipart OR x-www-form-urlencoded)
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const obj: Record<string, any> = {};

    // важно: fd.forEach без итераторов (чтобы не ломался билд)
    fd.forEach((value, key) => {
      obj[key] = typeof value === "string" ? value : value.name;
    });

    // ✅ ВАЖНО: WayForPay иногда шлёт весь JSON как ОДИН КЛЮЧ
    // {'{...json...}': ''}
    if (!obj.orderReference && !obj.order_reference && Object.keys(obj).length === 1) {
      const onlyKey = Object.keys(obj)[0].trim();
      if (onlyKey.startsWith("{") && onlyKey.endsWith("}")) {
        try {
          return JSON.parse(onlyKey);
        } catch {
          // ignore
        }
      }
    }

    return obj;
  }

  // Fallback: raw text
  try {
    const text = (await req.text()) || "";
    const t = text.trim();
    if (!t) return {};

    if (t.startsWith("{") && t.endsWith("}")) {
      return JSON.parse(t);
    }

    const params = new URLSearchParams(t);
    const obj: Record<string, any> = {};
    params.forEach((v, k) => (obj[k] = v));

    // ещё один шанс распаковать "json ключом"
    if (!obj.orderReference && Object.keys(obj).length === 1) {
      const onlyKey = Object.keys(obj)[0].trim();
      if (onlyKey.startsWith("{") && onlyKey.endsWith("}")) {
        try {
          return JSON.parse(onlyKey);
        } catch {}
      }
    }

    return obj;
  } catch {
    return {};
  }
}

function mapStatus(transactionStatus?: string) {
  const s = (transactionStatus || "").toLowerCase();

  if (s === "approved") return "paid";
  if (s === "inprocessing" || s === "processing") return "processing";
  if (s === "pending") return "pending";
  if (s === "declined") return "declined";
  if (s === "expired") return "expired";
  if (s === "refunded") return "refunded";

  return s || "unknown";
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "wayforpay-webhook" });
}

export async function POST(req: NextRequest) {
  const body = await readWayForPayBody(req);

  const orderReference =
    body.orderReference ||
    body.order_reference ||
    body.orderRef ||
    "";

  const transactionStatus =
    body.transactionStatus ||
    body.transaction_status ||
    body.status ||
    "";

  const reason = body.reason;
  const reasonCode = body.reasonCode;
  const amount = body.amount;
  const currency = body.currency;

  console.log("✅ WFP webhook in:", {
    orderReference,
    transactionStatus,
    reason,
    reasonCode,
    amount,
    currency,
  });

  if (!orderReference) {
    console.error("❌ Missing orderReference in webhook payload", body);
    return NextResponse.json({ ok: false, error: "Missing orderReference" }, { status: 400 });
  }

  // опциональная проверка merchant
  const expectedMerchant =
    process.env.WAYFORPAY_MERCHANT_ACCOUNT ||
    process.env.WAYFORPAY_MERCHANT ||
    "";

  if (expectedMerchant && body.merchantAccount && body.merchantAccount !== expectedMerchant) {
    console.error("❌ Wrong merchantAccount", {
      got: body.merchantAccount,
      expected: expectedMerchant,
    });
    return NextResponse.json({ ok: false, error: "Wrong merchantAccount" }, { status: 400 });
  }

  const newStatus = mapStatus(transactionStatus);

  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("billing_orders")
      .update({
        status: newStatus,
        raw: body,
        updated_at: new Date().toISOString(),
      })
      .eq("order_reference", orderReference);

    if (error) {
      console.error("❌ Supabase update error", error);
      return NextResponse.json({ ok: false, error: "DB update failed" }, { status: 500 });
    }

    console.log("✅ Billing order updated:", { orderReference, status: newStatus });

    // ✅ WayForPay ждёт accept-ответ с подписью, иначе может ретраить webhook
    const secret =
      process.env.WAYFORPAY_SECRET_KEY ||
      process.env.WAYFORPAY_MERCHANT_SECRET_KEY ||
      "";

    const time = Math.floor(Date.now() / 1000);
    const status = "accept";

    if (secret) {
      // правильная схема: HMAC_MD5(orderReference;status;time, secret)
      const signature = hmacMd5(`${orderReference};${status};${time}`, secret);
      return NextResponse.json({ orderReference, status, time, signature });
    }

    return NextResponse.json({ orderReference, status, time });
  } catch (e: any) {
    console.error("❌ Webhook error", e);
    return NextResponse.json({ ok: false, error: "Webhook error" }, { status: 500 });
  }
}
