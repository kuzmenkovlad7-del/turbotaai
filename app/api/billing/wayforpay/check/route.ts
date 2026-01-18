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

  // declined / expired / refunded / unknown -> failed
  return "failed";
}

function pickBestStatus(statuses: string[]): BillingStatus {
  // paid always wins, never downgrade
  if (statuses.includes("paid")) return "paid";
  if (statuses.includes("processing")) return "processing";
  return "failed";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const orderReference = url.searchParams.get("orderReference")?.trim() || "";

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "missing_orderReference" }, { status: 400 });
  }

  const merchantAccount =
    process.env.WAYFORPAY_MERCHANT_ACCOUNT ||
    process.env.WFP_MERCHANT_ACCOUNT ||
    "";

  const secretKey =
    process.env.WAYFORPAY_SECRET_KEY ||
    process.env.WFP_SECRET_KEY ||
    "";

  if (!merchantAccount || !secretKey) {
    console.error("[billing][check] missing env", {
      hasMerchantAccount: Boolean(merchantAccount),
      hasSecretKey: Boolean(secretKey),
    });
    return NextResponse.json({ ok: false, error: "missing_wayforpay_env" }, { status: 500 });
  }

  // ✅ WayForPay CHECK_STATUS signature: HMAC_MD5("merchantAccount;orderReference", secretKey)
  const signStr = `${merchantAccount};${orderReference}`;
  const merchantSignature = hmacMd5(signStr, secretKey);

  const requestBody = {
    transactionType: "CHECK_STATUS",
    merchantAccount,
    orderReference,
    apiVersion: 1,
    merchantSignature,
  };

  console.info("[billing][check] start", { orderReference });

  let wfpJson: any = null;
  try {
    const r = await fetch("https://api.wayforpay.com/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    });

    wfpJson = await r.json().catch(() => null);

    if (!r.ok || !wfpJson) {
      console.error("[billing][check] bad response", {
        orderReference,
        httpStatus: r.status,
        body: wfpJson,
      });
      return NextResponse.json(
        { ok: false, error: "wayforpay_check_failed", httpStatus: r.status },
        { status: 502 }
      );
    }
  } catch (e: any) {
    console.error("[billing][check] fetch error", { orderReference, error: String(e?.message || e) });
    return NextResponse.json({ ok: false, error: "wayforpay_fetch_error" }, { status: 502 });
  }

  const txStatus: string | null =
    wfpJson.transactionStatus || wfpJson.status || null;

  if (!txStatus) {
    console.error("[billing][check] missing transactionStatus", { orderReference, wfpJson });
    return NextResponse.json(
      { ok: false, error: "missing_transactionStatus" },
      { status: 502 }
    );
  }

  const nextStatus = mapWayforpayStatus(txStatus);

  const supabase = getSupabaseAdmin();

  // ✅ читаем все статусы (если вдруг дубли есть)
  const existing = await supabase
    .from("billing_orders")
    .select("status, raw, updated_at")
    .eq("order_reference", orderReference)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (existing.error) {
    console.error("[billing][check] db read error", { orderReference, error: existing.error });
    return NextResponse.json({ ok: false, error: "db_read_failed" }, { status: 500 });
  }

  const existingStatuses = (existing.data || []).map((r: any) => String(r.status || ""));
  const bestExisting = pickBestStatus(existingStatuses);

  // ✅ НЕ даем “понижать” paid → failed
  if (bestExisting === "paid" && nextStatus !== "paid") {
    console.info("[billing][check] protected paid (no downgrade)", {
      orderReference,
      bestExisting,
      nextStatus,
      txStatus,
    });

    return NextResponse.json({
      ok: true,
      orderReference,
      status: "paid",
      protected: true,
      transactionStatus: txStatus,
    });
  }

  const latestRaw = (existing.data?.[0] as any)?.raw || {};
  const mergedRaw = {
    ...(latestRaw || {}),
    check: wfpJson,
    check_received_at: new Date().toISOString(),
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
    console.error("[billing][check] db update error", { orderReference, error: upd.error });
    return NextResponse.json({ ok: false, error: "db_update_failed" }, { status: 500 });
  }

  console.info("[billing][check] done", { orderReference, status: nextStatus, txStatus });

  return NextResponse.json({
    ok: true,
    orderReference,
    status: nextStatus,
    transactionStatus: txStatus,
  });
}
