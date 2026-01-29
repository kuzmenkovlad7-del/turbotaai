import { getSupabaseAdmin } from "@/lib/supabase/admin"
import type { Principal } from "@/lib/server/principal"

export type AccessState = {
  hasAccess: boolean
  trialLeft: number
  paidUntil: string | null
  promoUntil: string | null
  reason: "ok" | "trial_exhausted" | "not_configured"
}

function isFuture(iso: string | null) {
  if (!iso) return false
  return new Date(iso).getTime() > Date.now()
}

function toDateOrNull(v: any): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function laterIso(a: any, b: any): string | null {
  const da = toDateOrNull(a)
  const db = toDateOrNull(b)
  if (!da && !db) return null
  if (da && !db) return da.toISOString()
  if (!da && db) return db.toISOString()
  return (da!.getTime() >= db!.getTime() ? da! : db!).toISOString()
}

async function readGrantByKey(supabase: any, key: string) {
  const { data } = await supabase
    .from("access_grants")
    .select("trial_questions_left,paid_until,promo_until")
    .eq("device_hash", key)
    .maybeSingle()
  return data || null
}

export async function getAccessState(principal: Principal): Promise<AccessState> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { hasAccess: true, trialLeft: 999, paidUntil: null, promoUntil: null, reason: "not_configured" }
  }

  const supabase = getSupabaseAdmin()

  const deviceHash = String((principal as any)?.deviceHash || "").trim()
  const userId = principal.kind === "user" ? String((principal as any)?.userId || "").trim() : ""
  const accountKey = userId ? `account:${userId}` : ""

  const guest = deviceHash ? await readGrantByKey(supabase, deviceHash) : null
  const acc = accountKey ? await readGrantByKey(supabase, accountKey) : null

  const trialLeft = Number(guest?.trial_questions_left ?? 0)
  const paidUntil = laterIso(guest?.paid_until ?? null, acc?.paid_until ?? null)
  const promoUntil = laterIso(guest?.promo_until ?? null, acc?.promo_until ?? null)

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

  const before = await getAccessState(principal)
  if (before.hasAccess && (isFuture(before.paidUntil) || isFuture(before.promoUntil))) return before

  const deviceHash = String((principal as any)?.deviceHash || "").trim()
  if (!deviceHash) return before

  const supabase = getSupabaseAdmin()
  const { data } = await supabase.rpc("consume_trial_device", { p_device_hash: deviceHash })
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

export function paywallText() {
  return [
    "Лимит бесплатных вопросов закончился.",
    "Оформите подписку на /pricing или активируйте промокод для врачей.",
  ].join(" ")
}
