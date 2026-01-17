import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hmacMd5(secret: string, message: string) {
  return crypto.createHmac("md5", secret).update(message, "utf8").digest("hex");
}

function tryJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseUrlEncoded(raw: string) {
  const params = new URLSearchParams(raw);
  const obj: Record<string, string> = {};
  params.forEach((v, k) => (obj[k] = v));
  return obj;
}

function normalizeWeirdForm(obj: any) {
  if (!obj || typeof obj !== "object") return obj;
  const keys = Object.keys(obj);
  if (keys.length === 1) {
    const k = keys[0]?.trim();
    const v = obj[keys[0]];
    // кейс из твоих логов: { '{"merchantAccount":...,"orderReference":...}': '' }
    if ((v === "" || v == null) && k.startsWith("{") && k.endsWith("}")) {
      const parsed = tryJson(k);
      if (parsed && typeof parsed === "object") return parsed;
    }
  }
  return obj;
}

function parseBodySmart(raw: string) {
  const t = (raw || "").trim();
  if (!t) return {};

  // 1) чистый JSON
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    const j = tryJson(t);
    if (j) return j;
  }

  // 2) form-urlencoded
  if (t.includes("=")) {
    const o = parseUrlEncoded(t);
    const fixed = normalizeWeirdForm(o);
    if (fixed !== o) return fixed;

    // иногда шлюз кладёт json в поле payload/data
    const maybeJson = (o as any)?.payload || (o as any)?.data;
    if (typeof maybeJson === "string") {
      const j = tryJson(maybeJson);
      if (j) return j;
    }

    return o;
  }

  // 3) fallback: вдруг всё-таки JSON без корректных заголовков
  const j = tryJson(t);
  if (j) return j;

  return { raw: t };
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase env is not configured (SUPABASE_URL / keys missing)");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function mapTxStatus(tx: string | undefined) {
  const s = (tx || "").toLowerCase();
  if (s === "approved") return "paid";
  if (s === "pending" || s === "inprocessing" || s === "waitingaamountconfirm" || s === "waitingauthcomplete") return "pending";
  if (s === "declined" || s === "expired" || s === "refunded" || s === "voided") return "failed";
  return tx ? `wfp_${s}` : "unknown";
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "wayforpay-webhook" });
}

export async function POST(req: NextRequest) {
  const rawText = await req.text();
  let payload: any = parseBodySmart(rawText);
  payload = normalizeWeirdForm(payload);

  const orderReference = payload?.orderReference || payload?.order_reference;

  if (!orderReference) {
    console.error("[billing] WayForPay webhook: missing orderReference", {
      preview: String(rawText).slice(0, 700),
    });

    // Важно: НЕ 400, иначе WayForPay будет долбить ретраями и ничего не пройдет.
    return NextResponse.json({ ok: false, error: "missing_orderReference" }, { status: 200 });
  }

  const secret =
    process.env.WAYFORPAY_SECRET_KEY ||
    process.env.WFP_SECRET_KEY ||
    process.env.WAYFORPAY_SECRET ||
    "";

  const incomingSignature = String(payload?.merchantSignature || payload?.signature || "");

  // Проверка подписи (не блокируем оплату, просто логируем mismatch)
  if (secret && incomingSignature) {
    const signString = [
      payload?.merchantAccount ?? "",
      orderReference,
      payload?.amount ?? "",
      payload?.currency ?? "",
      payload?.authCode ?? "",
      payload?.cardPan ?? "",
      payload?.transactionStatus ?? "",
      payload?.reasonCode ?? "",
    ]
      .map((v) => String(v))
      .join(";");

    const expected = hmacMd5(secret, signString);

    if (expected !== incomingSignature) {
      console.warn("[billing] WayForPay webhook signature mismatch", {
        orderReference,
        expected,
        incomingSignature,
      });
      payload._signatureValid = false;
    } else {
      payload._signatureValid = true;
    }
  }

  const nowIso = new Date().toISOString();
  const newStatus = mapTxStatus(String(payload?.transactionStatus || ""));

  try {
    const supabase = getSupabaseAdmin();

    const { data: row, error: selErr } = await supabase
      .from("billing_orders")
      .select("raw,status")
      .eq("order_reference", orderReference)
      .maybeSingle();

    if (selErr) {
      console.warn("[billing] webhook select error", selErr);
    }

    const mergedRaw = {
      ...(row?.raw ?? {}),
      wfpWebhook: payload,
      wfpWebhookReceivedAt: nowIso,
    };

    const { error: updErr } = await supabase
      .from("billing_orders")
      .update({
        status: newStatus,
        raw: mergedRaw,
        updated_at: nowIso,
      })
      .eq("order_reference", orderReference);

    if (updErr) {
      console.error("[billing] webhook update error", updErr);
    } else {
      console.log("[billing] webhook OK", { orderReference, newStatus });
    }
  } catch (e: any) {
    console.error("[billing] webhook internal error", e?.message || e);
  }

  // WayForPay ожидает accept-ответ (orderReference/status/time/signature)
  const time = Math.floor(Date.now() / 1000);
  const status = "accept";
  const signature = secret ? hmacMd5(secret, `${orderReference};${status};${time}`) : "";

  return NextResponse.json({ orderReference, status, time, signature });
}
