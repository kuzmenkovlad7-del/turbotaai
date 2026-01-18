import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function hmacMd5(message: string, secret: string) {
  return crypto.createHmac("md5", secret).update(message, "utf8").digest("hex");
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin env is missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

function mapStatus(transactionStatus?: string) {
  const s = String(transactionStatus || "").toLowerCase();
  if (s === "approved") return "paid";
  if (s === "inprocessing" || s === "pending") return "processing";
  if (s) return "failed";
  return "unknown";
}

async function parseBody(req: Request) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  // multipart
  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const obj: Record<string, any> = {};
    fd.forEach((value, key) => {
      obj[key] = typeof value === "string" ? value : value.name;
    });
    return obj;
  }

  // fallback raw text
  const raw = await req.text();
  const trimmed = raw.trim();
  if (!trimmed) return {};

  // JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // continue
    }
  }

  // x-www-form-urlencoded
  const params = new URLSearchParams(trimmed);
  const obj: Record<string, any> = {};
  for (const [k, v] of params.entries()) obj[k] = v;

  // special case: body is JSON string but came in wrong format without "="
  if (Object.keys(obj).length === 1) {
    const onlyKey = Object.keys(obj)[0] || "";
    if (onlyKey.trim().startsWith("{")) {
      try {
        return JSON.parse(onlyKey);
      } catch {
        // ignore
      }
    }
  }

  return obj;
}

function normalizeWfpPayload(payload: any) {
  const orderReference =
    payload.orderReference ||
    payload.order_reference ||
    payload.orderRef ||
    payload?.wfpPayload?.orderReference;

  const transactionStatus =
    payload.transactionStatus || payload.transaction_status || payload.status;

  const merchantAccount =
    payload.merchantAccount || payload.merchant_account || "";

  const merchantSignature =
    payload.merchantSignature || payload.merchant_signature || payload.signature;

  const amount = payload.amount;
  const currency = payload.currency;

  const authCode = payload.authCode || "";
  const cardPan = payload.cardPan || "";

  const reasonCode = payload.reasonCode ?? payload.reason ?? "";

  return {
    ...payload,
    orderReference,
    transactionStatus,
    merchantAccount,
    merchantSignature,
    amount,
    currency,
    authCode,
    cardPan,
    reasonCode,
  };
}

// WayForPay webhook signature:
// merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode
// HMAC_MD5(secretKey) :contentReference[oaicite:1]{index=1}
function verifyWebhookSignature(p: any, secret: string) {
  const signStr = [
    p.merchantAccount ?? "",
    p.orderReference ?? "",
    p.amount ?? "",
    p.currency ?? "",
    p.authCode ?? "",
    p.cardPan ?? "",
    p.transactionStatus ?? "",
    p.reasonCode ?? "",
  ].join(";");

  const expected = hmacMd5(signStr, secret).toLowerCase();
  const provided = String(p.merchantSignature || "").toLowerCase();

  return { ok: expected === provided, expected, provided };
}

// WayForPay ожидает accept-ответ:
// orderReference;status;time -> HMAC_MD5(secretKey) :contentReference[oaicite:2]{index=2}
function wfpAcceptResponse(orderReference: string, secret: string) {
  const time = Math.floor(Date.now() / 1000);
  const status = "accept";
  const signature = hmacMd5([orderReference, status, time].join(";"), secret);
  return { orderReference, status, time, signature };
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "wayforpay-webhook" });
}

export async function POST(req: Request) {
  const secret = process.env.WAYFORPAY_SECRET_KEY || "";
  if (!secret) {
    console.error("[billing] WAYFORPAY_SECRET_KEY is missing");
    return NextResponse.json(
      { ok: false, error: "secret_missing" },
      { status: 500 }
    );
  }

  const parsed = await parseBody(req);
  const payload = normalizeWfpPayload(parsed);

  console.log("[billing] WayForPay webhook keys:", Object.keys(parsed));
  console.log("[billing] WayForPay webhook normalized:", {
    orderReference: payload.orderReference,
    transactionStatus: payload.transactionStatus,
    amount: payload.amount,
    currency: payload.currency,
  });

  if (!payload.orderReference) {
    console.error("[billing] Missing orderReference in webhook payload", parsed);
    return NextResponse.json(
      { ok: false, error: "missing_orderReference" },
      { status: 400 }
    );
  }

  if (payload.merchantSignature) {
    const check = verifyWebhookSignature(payload, secret);
    if (!check.ok) {
      console.error("[billing] Invalid WayForPay signature", {
        orderReference: payload.orderReference,
      });
      return NextResponse.json(
        { ok: false, error: "invalid_signature" },
        { status: 400 }
      );
    }
  } else {
    console.warn("[billing] WayForPay webhook without merchantSignature");
  }

  const sb = getSupabaseAdmin();
  const status = mapStatus(payload.transactionStatus);

  const { data: updated, error: updErr } = await sb
    .from("billing_orders")
    .update({
      status,
      raw: { webhook: payload },
      updated_at: new Date().toISOString(),
    })
    .eq("order_reference", payload.orderReference)
    .select("order_reference");

  if (updErr) {
    console.error("[billing] Supabase update error", updErr);
    return NextResponse.json(
      { ok: false, error: "db_update_failed" },
      { status: 500 }
    );
  }

  if (!updated || updated.length === 0) {
    const { error: insErr } = await sb.from("billing_orders").insert({
      order_reference: payload.orderReference,
      amount: payload.amount ?? null,
      currency: payload.currency ?? null,
      status,
      raw: { webhook: payload },
    } as any);

    if (insErr) {
      console.error("[billing] Supabase insert error", insErr);
      return NextResponse.json(
        { ok: false, error: "db_insert_failed" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(wfpAcceptResponse(payload.orderReference, secret));
}
