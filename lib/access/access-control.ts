import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { getSupabaseServerClient, isSupabaseServerConfigured } from "@/lib/supabase-server"

export type AccessGrant = {
  id: string
  device_hash: string | null
  trial_questions_left: number | null
  paid_until: string | null
  promo_until: string | null
}

const TABLE = "access_grants"

function num(v: any, fallback: number) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function getTrialLimit() {
  const limit = num(process.env.TRIAL_QUESTIONS_LIMIT, 5)
  return limit > 0 ? Math.floor(limit) : 5
}

export function getDeviceHash(req: NextRequest): string {
  return (req.cookies.get("ta_device_hash")?.value || req.headers.get("x-device-hash") || "").trim()
}

function toMs(iso: string | null): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

function isFuture(iso: string | null): boolean {
  const t = toMs(iso)
  return typeof t === "number" && t > Date.now()
}

function hasUnlimited(grant: AccessGrant | null) {
  if (!grant) return false
  return isFuture(grant.paid_until ?? null) || isFuture(grant.promo_until ?? null)
}

async function getUserIdFromReq(req: NextRequest): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null

  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })

  try {
    const { data } = await supabase.auth.getUser()
    return data?.user?.id || null
  } catch {
    return null
  }
}

export async function getOrCreateGrant(deviceHash: string, trialOverride?: number): Promise<AccessGrant | null> {
  if (!deviceHash) return null
  if (!isSupabaseServerConfigured()) return null

  const supabase = getSupabaseServerClient()
  const trialDefault = typeof trialOverride === "number" ? Math.max(0, Math.floor(trialOverride)) : getTrialLimit()

  const { data: existing, error: selErr } = await supabase
    .from(TABLE)
    .select("id,device_hash,trial_questions_left,paid_until,promo_until")
    .eq("device_hash", deviceHash)
    .maybeSingle()

  if (selErr) throw selErr
  if (existing) return existing as AccessGrant

  const { data: created, error: insErr } = await supabase
    .from(TABLE)
    .insert({
      device_hash: deviceHash,
      trial_questions_left: trialDefault,
      paid_until: null,
      promo_until: null,
    })
    .select("id,device_hash,trial_questions_left,paid_until,promo_until")
    .single()

  if (insErr) throw insErr
  return created as AccessGrant
}

export async function requireAccessByDeviceHash(args: {
  deviceHash: string
  consumeTrial: boolean
  req?: NextRequest
}): Promise<{
  ok: boolean
  status: number
  grant: AccessGrant | null
  reason?: string
}> {
  const { deviceHash, consumeTrial, req } = args

  if (!isSupabaseServerConfigured()) {
    return { ok: true, status: 200, grant: null }
  }

  const grant = await getOrCreateGrant(deviceHash)
  if (!grant) return { ok: true, status: 200, grant: null }

  if (hasUnlimited(grant)) return { ok: true, status: 200, grant }

  if (req) {
    const userId = await getUserIdFromReq(req)
    if (userId) {
      const acc = await getOrCreateGrant(`account:${userId}`, 0)
      if (hasUnlimited(acc)) return { ok: true, status: 200, grant: acc }
    }
  }

  const left = Number(grant.trial_questions_left ?? 0)

  if (left > 0) {
    if (!consumeTrial) return { ok: true, status: 200, grant }

    const supabase = getSupabaseServerClient()
    const next = Math.max(0, left - 1)

    const { data: updated, error: updErr } = await supabase
      .from(TABLE)
      .update({ trial_questions_left: next, updated_at: new Date().toISOString() })
      .eq("id", grant.id)
      .select("id,device_hash,trial_questions_left,paid_until,promo_until")
      .single()

    if (updErr) throw updErr
    return { ok: true, status: 200, grant: (updated as AccessGrant) ?? grant }
  }

  return { ok: false, status: 402, grant, reason: "payment_required" }
}

export async function requireAccess(req: NextRequest, consumeTrial: boolean) {
  const deviceHash = getDeviceHash(req)
  return requireAccessByDeviceHash({ deviceHash, consumeTrial, req })
}
