import { getSupabaseAdmin } from "@/lib/supabase/admin"
import type { Principal } from "@/lib/server/principal"

export type AccessState = {
  hasAccess: boolean
  trialLeft: number
  paidUntil: string | null
  promoUntil: string | null
  reason: "ok" | "trial_exhausted" | "not_configured"
}

function nowIso() {
  return new Date().toISOString()
}

function isFuture(iso: string | null) {
  if (!iso) return false
  return new Date(iso).getTime() > Date.now()
}

export async function getAccessState(principal: Principal): Promise<AccessState> {
  // если нет Supabase admin env — не ломаем проект
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { hasAccess: true, trialLeft: 999, paidUntil: null, promoUntil: null, reason: "not_configured" }
  }

  const supabase = getSupabaseAdmin()

  const q =
    principal.kind === "user"
      ? supabase.from("access_grants").select("*").eq("user_id", principal.userId).maybeSingle()
      : supabase.from("access_grants").select("*").eq("device_hash", principal.deviceHash).maybeSingle()

  const { data } = await q

  const trialLeft = Number(data?.trial_questions_left ?? 0)
  const paidUntil = (data?.paid_until ?? null) as string | null
  const promoUntil = (data?.promo_until ?? null) as string | null

  if (isFuture(paidUntil) || isFuture(promoUntil)) {
    return { hasAccess: true, trialLeft, paidUntil, promoUntil, reason: "ok" }
  }

  if (trialLeft > 0) {
    return { hasAccess: true, trialLeft, paidUntil, promoUntil, reason: "ok" }
  }

  return { hasAccess: false, trialLeft: 0, paidUntil, promoUntil, reason: "trial_exhausted" }
}

export async function consumeQuestion(principal: Principal): Promise<AccessState> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { hasAccess: true, trialLeft: 999, paidUntil: null, promoUntil: null, reason: "not_configured" }
  }

  const supabase = getSupabaseAdmin()

  // если уже подписка/промо — не уменьшаем
  const before = await getAccessState(principal)
  if (before.hasAccess && (isFuture(before.paidUntil) || isFuture(before.promoUntil))) return before

  if (principal.kind === "user") {
    const { data } = await supabase.rpc("consume_trial_user", { p_user_id: principal.userId })
    const row = Array.isArray(data) ? data[0] : data
    const allowed = Boolean(row?.allowed)
    const trialLeft = Number(row?.trial_left ?? 0)
    return {
      hasAccess: allowed,
      trialLeft,
      paidUntil: before.paidUntil,
      promoUntil: before.promoUntil,
      reason: allowed ? "ok" : "trial_exhausted",
    }
  } else {
    const { data } = await supabase.rpc("consume_trial_device", { p_device_hash: principal.deviceHash })
    const row = Array.isArray(data) ? data[0] : data
    const allowed = Boolean(row?.allowed)
    const trialLeft = Number(row?.trial_left ?? 0)
    return {
      hasAccess: allowed,
      trialLeft,
      paidUntil: before.paidUntil,
      promoUntil: before.promoUntil,
      reason: allowed ? "ok" : "trial_exhausted",
    }
  }
}

export function paywallText() {
  return [
    "Лимит бесплатных вопросов закончился.",
    "Оформите подписку на /pricing или активируйте промокод для врачей.",
  ].join(" ")
}
