import type { NextRequest } from "next/server"
import { getSupabaseServerClient, isSupabaseServerConfigured } from "@/lib/supabase-server"

export type AccessGrant = {
  id: string
  device_hash: string | null
  trial_questions_left: number | null
  paid_until: string | null
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

function isPaidActive(paidUntil: string | null): boolean {
  if (!paidUntil) return false
  const t = Date.parse(paidUntil)
  if (!Number.isFinite(t)) return false
  return t > Date.now()
}

export async function getOrCreateGrant(deviceHash: string): Promise<AccessGrant | null> {
  if (!deviceHash) return null
  if (!isSupabaseServerConfigured()) return null

  const supabase = getSupabaseServerClient()
  const trialDefault = getTrialLimit()

  const { data: existing, error: selErr } = await supabase
    .from(TABLE)
    .select("id,device_hash,trial_questions_left,paid_until")
    .eq("device_hash", deviceHash)
    .maybeSingle()

  if (selErr) throw selErr
  if (existing) return existing as AccessGrant

  const { data: created, error: insErr } = await supabase
    .from(TABLE)
    .insert({
      device_hash: deviceHash,
      trial_questions_left: trialDefault,
    })
    .select("id,device_hash,trial_questions_left,paid_until")
    .single()

  if (insErr) throw insErr
  return created as AccessGrant
}

export async function requireAccessByDeviceHash(args: {
  deviceHash: string
  consumeTrial: boolean
}): Promise<{
  ok: boolean
  status: number
  grant: AccessGrant | null
  reason?: string
}> {
  const { deviceHash, consumeTrial } = args

  if (!isSupabaseServerConfigured()) {
    return { ok: true, status: 200, grant: null }
  }

  const grant = await getOrCreateGrant(deviceHash)
  if (!grant) return { ok: true, status: 200, grant: null }

  const paid = isPaidActive(grant.paid_until ?? null)
  const left = Number(grant.trial_questions_left ?? 0)

  if (paid) return { ok: true, status: 200, grant }

  if (left > 0) {
    if (!consumeTrial) return { ok: true, status: 200, grant }

    const supabase = getSupabaseServerClient()
    const next = Math.max(0, left - 1)

    const { data: updated, error: updErr } = await supabase
      .from(TABLE)
      .update({ trial_questions_left: next, updated_at: new Date().toISOString() })
      .eq("id", grant.id)
      .select("id,device_hash,trial_questions_left,paid_until")
      .single()

    if (updErr) throw updErr
    return { ok: true, status: 200, grant: (updated as AccessGrant) ?? grant }
  }

  return { ok: false, status: 402, grant, reason: "payment_required" }
}

export async function requireAccess(req: NextRequest, consumeTrial: boolean) {
  const deviceHash = getDeviceHash(req)
  return requireAccessByDeviceHash({ deviceHash, consumeTrial })
}
