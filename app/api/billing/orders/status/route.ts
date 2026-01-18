import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BillingStatus = "paid" | "failed" | "processing" | "not_found";

function pickBestStatus(statuses: string[]): BillingStatus {
  if (statuses.includes("paid")) return "paid";
  if (statuses.includes("processing")) return "processing";
  if (statuses.length === 0) return "not_found";
  return "failed";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const orderReference = url.searchParams.get("orderReference")?.trim() || "";

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "missing_orderReference" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("billing_orders")
    .select("status, updated_at")
    .eq("order_reference", orderReference)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[billing][status] db error", { orderReference, error });
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  const statuses = (data || []).map((r: any) => String(r.status || ""));
  const best = pickBestStatus(statuses);

  return NextResponse.json({
    ok: true,
    orderReference,
    status: best,
  });
}
