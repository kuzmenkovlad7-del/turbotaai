import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const orderReference = String(sp.get("orderReference") || "").trim()

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "orderReference required" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from("billing_orders")
    .select("order_reference,status,raw,updated_at,created_at,plan_id,amount,currency,user_id,device_hash")
    .eq("order_reference", orderReference)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: "billing_orders read failed", details: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ ok: false, orderReference, status: "not_found" }, { status: 200 })
  }

  const status = String((data as any).status || "unknown")
  const final = status === "paid" || status === "failed" || status === "refunded"

  return NextResponse.json(
    {
      ok: true,
      orderReference,
      status,
      final,
      updated_at: (data as any).updated_at || null,
      plan_id: (data as any).plan_id || null,
      amount: (data as any).amount || null,
      currency: (data as any).currency || null,
    },
    { status: 200 }
  )
}
