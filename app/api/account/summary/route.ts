import { NextRequest, NextResponse } from "next/server"
import { getPrincipal } from "@/lib/server/principal"
import { getAccessState } from "@/lib/server/entitlements"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const p = await getPrincipal(req)
  const state = await getAccessState(p.principal)

  // подтянем trial_left более точно (если есть запись)
  let trialLeft = state.trialLeft

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = getSupabaseAdmin()
      const q =
        p.principal.kind === "user"
          ? supabase.from("access_grants").select("trial_questions_left,paid_until,promo_until").eq("user_id", p.principal.userId).maybeSingle()
          : supabase.from("access_grants").select("trial_questions_left,paid_until,promo_until").eq("device_hash", p.deviceHash).maybeSingle()
      const { data } = await q
      if (data?.trial_questions_left != null) trialLeft = Number(data.trial_questions_left)
      return NextResponse.json({
        ok: true,
        principal: p.principal.kind,
        trialLeft,
        paidUntil: data?.paid_until ?? state.paidUntil,
        promoUntil: data?.promo_until ?? state.promoUntil,
        hasAccess: state.hasAccess,
      })
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    principal: p.principal.kind,
    trialLeft,
    paidUntil: state.paidUntil,
    promoUntil: state.promoUntil,
    hasAccess: state.hasAccess,
  })
}
