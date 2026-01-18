import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BillingStatus = "paid" | "failed" | "processing" | "invoice_created" | "not_found";

function pickBestStatus(statuses: string[]): BillingStatus {
  if (statuses.includes("paid")) return "paid";
  if (statuses.includes("processing")) return "processing";
  if (statuses.includes("invoice_created")) return "invoice_created";
  if (statuses.length === 0) return "not_found";
  return "failed";
}

function safeJson(raw: any) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const orderReference =
    (url.searchParams.get("orderReference") ||
      url.searchParams.get("order_reference") ||
      "").trim();

  const debug = url.searchParams.get("debug") === "1";

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "missing_orderReference" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("billing_orders")
    .select("status, updated_at, raw")
    .eq("order_reference", orderReference)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[billing][status] db error", { orderReference, error });
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  const rows = data || [];
  const statuses = rows.map((r: any) => String(r.status || "")).filter(Boolean);
  const best = pickBestStatus(statuses);

  const last = rows[0] as any;
  const raw = safeJson(last?.raw);

  const lastTx =
    raw?.check?.transactionStatus ||
    raw?.webhook?.transactionStatus ||
    raw?.transactionStatus ||
    null;

  const payload: any = {
    ok: true,
    orderReference,
    status: best,
    lastTransactionStatus: lastTx,
  };

  if (debug) {
    payload.debug = {
      rows: rows.length,
      statuses,
      lastUpdatedAt: last?.updated_at || null,
      lastEvent: raw?.last_event || null,
    };
  }

  console.info("[billing][status]", { orderReference, best, lastTx });

  return NextResponse.json(payload);
}
