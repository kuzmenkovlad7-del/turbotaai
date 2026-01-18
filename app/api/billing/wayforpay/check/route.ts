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

// WayForPay CHECK_STATUS signature: merchantAccount;orderReference -> HMAC_MD5(secretKey) :contentReference[oaicite:3]{index=3}
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const orderReference = body.orderReference || body.order_reference || body.orderRef;

  if (!orderReference) {
    return NextResponse.json(
      { ok: false, error: "missing_orderReference" },
      { status: 400 }
    );
  }

  const merchantAccount =
    process.env.WAYFORPAY_MERCHANT_ACCOUNT || process.env.WFP_MERCHANT_ACCOUNT || "";
  const secret = process.env.WAYFORPAY_SECRET_KEY || "";

  if (!merchantAccount || !secret) {
    return NextResponse.json(
      { ok: false, error: "env_missing" },
      { status: 500 }
    );
  }

  const merchantSignature = hmacMd5(`${merchantAccount};${orderReference}`, secret);

  const wfpReq = {
    transactionType: "CHECK_STATUS",
    merchantAccount,
    orderReference,
    apiVersion: 1,
    merchantSignature,
  };

  const wfpRes = await fetch("https://api.wayforpay.com/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(wfpReq),
  });

  const wfpJson: any = await wfpRes.json().catch(() => null);

  if (!wfpRes.ok || !wfpJson) {
    return NextResponse.json(
      {
        ok: false,
        error: "wayforpay_check_failed",
        httpStatus: wfpRes.status,
        wayforpay: wfpJson,
      },
      { status: 500 }
    );
  }

  const transactionStatus = wfpJson.transactionStatus;
  const status = mapStatus(transactionStatus);

  const sb = getSupabaseAdmin();

  await sb
    .from("billing_orders")
    .update({
      status,
      raw: { checkStatus: wfpJson },
      updated_at: new Date().toISOString(),
    })
    .eq("order_reference", orderReference);

  const { data: db } = await sb
    .from("billing_orders")
    .select("order_reference,status,updated_at")
    .eq("order_reference", orderReference)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    orderReference,
    status,
    wayforpay: wfpJson,
    db,
  });
}
