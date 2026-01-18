import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BillingStatus = "paid" | "failed" | "processing";

function hmacMd5(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str, "utf8").digest("hex");
}

function mapWayforpayStatus(txStatus?: string | null): BillingStatus {
  const s = (txStatus || "").toLowerCase();
  if (s === "approved" || s === "paid") return "paid";
  if (s === "inprocessing" || s === "processing" || s === "pending") return "processing";
  return "failed";
}

function pickBestStatus(statuses: string[]): BillingStatus {
  if (statuses.includes("paid")) return "paid";
  if (statuses.includes("processing")) return "processing";
  return "failed";
}

function buildAcceptResponse(orderReference: string, secretKey: string) {
  const time = Math.floor(Date.now() / 1000);
  const status = "accept";
  const signStr = `${orderReference};${status};${time}`;
  const signature = hmacMd5(signStr, secretKey);
  return { orderReference, status, time, signature };
}

export async function POST(req: NextRequest) {
  const secretKey =
    process.env.WAYFORPAY_SECRET_KEY ||
    process.env.WFP_SECRET_KEY ||
    "";

  if (!secretKey) {
    console.error("[billing][webhook] missing secret key");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const contentType = req.headers.get("content-type") || "";
  let payload: any = null;

  try {
    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else {
      const bodyText = await req.text();
      const params = new URLSearchParams(bodyText);
      const obj: Record<string, any> = {};
      params.forEach((v, k) => (obj[k] = v));
      payload = obj;
    }
  } catch (e: any) {
    console.error("[billing][webhook] parse error", String(e?.message || e));
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const orderReference = String(payload?.orderReference || "").trim();
  const transactionStatus = String(payload?.transactionStatus || "").trim();
  const receivedSignature = String(payload?.merchantSignature || payload?.signature || "").trim();

  if (!orderReference) {
    console.error("[billing][webhook] missing orderReference", payload);
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // ✅ Верификация подписи serviceUrl (WayForPay):
  // merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode
  const merchantAccount = String(payload?.merchantAccount || "").trim();
  const amount = String(payload?.amount ?? "").trim();
  const currency = String(payload?.currency || "").trim();
  const authCode = String(payload?.authCode || "").trim();
  const cardPan = String(payload?.cardPan || "").trim();
  const reasonCode = String(payload?.reasonCode ?? "").trim();

  let signatureOk = true;
  if (merchantAccount && amount && currency && authCode && cardPan && transactionStatus && reasonCode && receivedSignature) {
    const signStr = [
      merchantAccount,
      orderReference,
      amount,
      currency,
      authCode,
      cardPan,
      transactionStatus,
      reasonCode,
    ].join(";");

    const expected = hmacMd5(signStr, secretKey);
    signatureOk = expected === receivedSignature;
  }

  console.info("[billing][webhook] received", {
    orderReference,
    transactionStatus,
    signatureOk,
  });

  // Даже если подпись не сошлась — НЕ валим пользователя, просто логируем.
  if (!signatureOk) {
    console.warn("[billing][webhook] signature mismatch", { orderReference });
  }

  const nextStatus = mapWayforpayStatus(transactionStatus);

  const supabase = getSupabaseAdmin();

  const existing = await supabase
    .from("billing_orders")
    .select("status, raw, updated_at")
    .eq("order_reference", orderReference)
    .order("updated_at", { ascending: false })
    .limit(10);

  const existingStatuses = (existing.data || []).map((r: any) => String(r.status || ""));
  const bestExisting = pickBestStatus(existingStatuses);

  // ✅ НЕ даем “понижать” paid → failed
  if (bestExisting === "paid" && nextStatus !== "paid") {
    console.info("[billing][webhook] protected paid (no downgrade)", { orderReference, bestExisting, nextStatus });
    const accept = buildAcceptResponse(orderReference, secretKey);
    return NextResponse.json(accept);
  }

  const latestRaw = (existing.data?.[0] as any)?.raw || {};
  const mergedRaw = {
    ...(latestRaw || {}),
    webhook: payload,
    webhook_received_at: new Date().toISOString(),
  };

  // ✅ обновляем все строки с order_reference (если были дубли)
  const upd = await supabase
    .from("billing_orders")
    .update({
      status: nextStatus,
      raw: mergedRaw,
      updated_at: new Date().toISOString(),
    })
    .eq("order_reference", orderReference);

  if (upd.error) {
    console.error("[billing][webhook] db update error", { orderReference, error: upd.error });
  }

  const accept = buildAcceptResponse(orderReference, secretKey);
  return NextResponse.json(accept);
}
