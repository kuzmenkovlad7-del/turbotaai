import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { getSupabaseServerClient, isSupabaseServerConfigured } from "@/lib/supabase-server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

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

/**
 * Read paid_until / promo_until from the profiles table.
 * Bootstrap uses this as a third fallback after device + account grants.
 * We must do the same so requireAccess reflects the same truth as bootstrap.
 */
async function getProfileAccess(userId: string): Promise<{ paid_until: string | null; promo_until: string | null } | null> {
  try {
    const supabase = getSupabaseServerClient()
    const { data } = await supabase
      .from("profiles")
      .select("paid_until,promo_until")
      .eq("id", userId)
      .maybeSingle()
    if (!data) return null
    return { paid_until: (data as any).paid_until ?? null, promo_until: (data as any).promo_until ?? null }
  } catch {
    return null
  }
}

async function getUserIdFromReq(req: NextRequest): Promise<string | null> {
  // Mobile clients send a Bearer token instead of session cookies.
  // Try it first so the account grant is always checked for mobile requests.
  const authHeader = req.headers.get("authorization") || ""
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (bearerToken) {
    try {
      const admin = getSupabaseAdmin()
      const { data } = await admin.auth.getUser(bearerToken)
      if (data?.user?.id) return data.user.id
    } catch {}
  }

  // Fall back to cookie-based session (web browsers).
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

  // ВАЖНО: если в таблице вдруг есть дубли, берём самую свежую запись
  const { data: existingArr, error: selErr } = await supabase
    .from(TABLE)
    .select("id,device_hash,trial_questions_left,paid_until,promo_until,updated_at,created_at")
    .eq("device_hash", deviceHash)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)

  if (selErr) throw selErr
  const existing = Array.isArray(existingArr) ? existingArr[0] : null
  if (existing) return existing as AccessGrant

  // Use upsert to prevent duplicates from concurrent requests
  const { error: upsErr } = await supabase
    .from(TABLE)
    .upsert(
      {
        device_hash: deviceHash,
        trial_questions_left: trialDefault,
        paid_until: null,
        promo_until: null,
      },
      { onConflict: "device_hash", ignoreDuplicates: true },
    )

  if (upsErr) throw upsErr

  // Re-read to get the row (whether just inserted or already existed)
  const { data: row, error: selErr2 } = await supabase
    .from(TABLE)
    .select("id,device_hash,trial_questions_left,paid_until,promo_until")
    .eq("device_hash", deviceHash)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single()

  if (selErr2) throw selErr2
  return row as AccessGrant
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

  let grant: AccessGrant | null = null
  try {
    grant = await getOrCreateGrant(deviceHash)
  } catch (e) {
    console.error("[access-control] device grant lookup failed, failing open:", e)
    return { ok: true, status: 200, grant: null }
  }
  if (!grant) return { ok: true, status: 200, grant: null }

  if (hasUnlimited(grant)) return { ok: true, status: 200, grant }

  // If the user is logged in, check the account-level grant then profiles.
  // This mirrors the three-source merge that bootstrap uses:
  //   device grant  → account grant  → profiles.paid_until / profiles.promo_until
  // All three must be checked so that access granted on web (which may only write
  // to profiles) is visible here too — not just in bootstrap.
  if (req) {
    const userId = await getUserIdFromReq(req)
    if (userId) {
      let acc: AccessGrant | null = null
      try {
        acc = await getOrCreateGrant(`account:${userId}`, 0)
      } catch (e) {
        console.error("[access-control] account grant lookup failed:", e)
      }
      if (hasUnlimited(acc)) return { ok: true, status: 200, grant: acc }

      // profiles fallback — same check bootstrap performs
      const prof = await getProfileAccess(userId)
      if (prof && (isFuture(prof.paid_until) || isFuture(prof.promo_until))) {
        return { ok: true, status: 200, grant: acc ?? grant }
      }
    }
  }

  const left = Number(grant.trial_questions_left ?? 0)

  if (left > 0) {
    if (!consumeTrial) return { ok: true, status: 200, grant }

    const supabase = getSupabaseServerClient()
    const next = Math.max(0, left - 1)

    try {
      const { data: updated, error: updErr } = await supabase
        .from(TABLE)
        .update({ trial_questions_left: next, updated_at: new Date().toISOString() })
        .eq("id", grant.id)
        .select("id,device_hash,trial_questions_left,paid_until,promo_until")
        .single()

      if (updErr) throw updErr
      return { ok: true, status: 200, grant: (updated as AccessGrant) ?? grant }
    } catch (e) {
      console.error("[access-control] trial decrement failed, allowing request:", e)
      return { ok: true, status: 200, grant }
    }
  }

  return { ok: false, status: 402, grant, reason: "payment_required" }
}

export async function requireAccess(req: NextRequest, consumeTrial: boolean) {
  const deviceHash = getDeviceHash(req)
  return requireAccessByDeviceHash({ deviceHash, consumeTrial, req })
}
