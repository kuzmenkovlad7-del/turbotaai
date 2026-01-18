import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hmacMd5(secret: string, data: string) {
  return crypto.createHmac("md5", secret).update(data, "utf8").digest("hex");
}

function pickOrderReference(obj: any): string | null {
  if (!obj) return null;
  return (
    obj.orderReference ||
    obj.order_reference ||
    obj.order_ref ||
    obj.order ||
    null
  );
}

function mapStatus(s: any): "paid" | "processing" | "failed" {
  const v = String(s || "").toLowerCase();

  // Approved = успех
  if (v === "approved" || v === "success" || v === "ok") return "paid";

  // pending/in processing
  if (
    v.includes("processing") ||
    v.includes("pending") ||
    v.includes("wait") ||
    v.includes("inprocessing")
  )
    return "processing";

  // иначе считаем неуспехом
  return "failed";
}

function verifyWebhookSignature(payload: any, secret: string): boolean {
  const sig = String(payload?.merchantSignature || payload?.signature || "").trim();
  if (!sig || !secret) return false;

  const base = [
    payload.merchantAccount,
    payload.orderReference,
    payload.amount,
    payload.currency,
    payload.authCode,
    payload.cardPan,
    payload.transactionStatus,
    payload.reasonCode,
  ]
    .map((x) => (x === undefined || x === null ? "" : String(x)))
    .join(";");

  const calc = hmacMd5(secret, base);
  return calc.toLowerCase() === sig.toLowerCase();
}

function acceptResponse(orderReference: string, secret: string) {
  const time = Math.floor(Date.now() / 1000);
  const status = "accept";
  const base = `${orderReference};${status};${time}`;
  const signature = secret ? hmacMd5(secret, base) : "";
  return { orderReference, status, time, signature };
}

async function parseWayForPayPayload(req: NextRequest): Promise<any> {
  const text = (await req.text()).trim();
  if (!text) return {};

  // 1) СНАЧАЛА пробуем JSON (это решает твою главную проблему)
  if (text.startsWith("{")) {
    try {
      return JSON.parse(text);
    } catch {}
  }

  // 2) Затем пробуем form-urlencoded
  const params = new URLSearchParams(text);
  const obj: Record<string, any> = {};
  params.forEach((v, k) => {
    obj[k] = v;
  });

  // 3) Спец-кейс: JSON прилетел без "=" одним ключом
  if (Object.keys(obj).length === 1) {
    const onlyKey = Object.keys(obj)[0];
    const onlyVal = obj[onlyKey];

    if (onlyKey && onlyKey.trim().startsWith("{")) {
      try {
        return JSON.parse(onlyKey);
      } catch {}
    }

    if (typeof onlyVal === "string" && onlyVal.trim().startsWith("{")) {
      try {
        return JSON.parse(onlyVal);
      } catch {}
    }
  }

  // 4) Иногда JSON кладут в поле data
  if (typeof obj.data === "string" && obj.data.trim().startsWith("{")) {
    try {
      return JSON.parse(obj.data);
    } catch {}
  }

  return obj;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Missing Supabase admin env vars");
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  const secret =
    process.env.WAYFORPAY_SECRET_KEY ||
    process.env.WAYFORPAY_SECRET ||
    "";

  const payload = await parseWayForPayPayload(req);
  const orderReference = pickOrderReference(payload);

  // ЛОГИ (чтобы ты видел что именно прилетело, и больше не скидывал мне тонны логов)
  console.log("[billing] WFP webhook raw parsed:", {
    contentType: req.headers.get("content-type"),
    hasOrderReference: Boolean(orderReference),
    keys: Object.keys(payload || {}).slice(0, 30),
    orderReference: orderReference || null,
    transactionStatus: payload?.transactionStatus || null,
  });

  if (!orderReference) {
    console.error("[billing] WayForPay webhook: missing orderReference", payload);
    return NextResponse.json(
      { ok: false, error: "missing_orderReference" },
      { status: 400 }
    );
  }

  // проверяем подпись если она есть
  if (payload?.merchantSignature && secret) {
    const ok = verifyWebhookSignature(payload, secret);
    if (!ok) {
      console.error("[billing] Invalid WayForPay signature", { orderReference });
      return NextResponse.json(
        { ok: false, error: "invalid_signature" },
        { status: 400 }
      );
    }
  } else {
    console.warn("[billing] WayForPay webhook without merchantSignature or secret");
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
    .eq("order_reference", orderReference)
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
      order_reference: orderReference,
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

  return NextResponse.json(acceptResponse(orderReference, secret));
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "wayforpay_webhook" });
}
