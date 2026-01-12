import { NextRequest, NextResponse } from "next/server"
import { getPrincipal } from "@/lib/server/principal"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function addMonths(d: Date, months: number) {
  const x = new Date(d)
  x.setMonth(x.getMonth() + months)
  return x
}

export async function POST(req: NextRequest) {
  const p = await getPrincipal(req)
  if (p.principal.kind !== "user") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const code = String(body?.code || "").trim().toUpperCase()

  const want = String(process.env.PROMO_DOCTORS_CODE || "DOCTORS2026").trim().toUpperCase()
  const months = Number(process.env.PROMO_DOCTORS_MONTHS || 12)

  if (!code || code !== want) {
    return NextResponse.json({ ok: false, error: "Invalid promo code" }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // ensure row
  await supabase.from("access_grants").upsert(
    { user_id: p.principal.userId, trial_questions_left: 5 },
    { onConflict: "user_id" },
  )

  const { data: row } = await supabase
    .from("access_grants")
    .select("promo_until")
    .eq("user_id", p.principal.userId)
    .maybeSingle()

  const base = row?.promo_until && new Date(row.promo_until).getTime() > Date.now()
    ? new Date(row.promo_until)
    : new Date()

  const promoUntil = addMonths(base, months).toISOString()

  await supabase
    .from("access_grants")
    .update({ promo_until: promoUntil, updated_at: new Date().toISOString() })
    .eq("user_id", p.principal.userId)

  return NextResponse.json({ ok: true, promoUntil })
}
