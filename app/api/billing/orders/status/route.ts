import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const orderReference = searchParams.get("orderReference") || ""

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "missing orderReference" }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from("billing_orders")
    .select("order_reference,status,amount,currency,plan_id,created_at,updated_at")
    .eq("order_reference", orderReference)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, order: data || null })
}
