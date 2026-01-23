import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "turbotaai_device"
const ACCOUNT_PREFIX = "account:"

type GrantRow = {
  id: string
  user_id: string | null
  device_hash: string
  trial_questions_left: number | null
  paid_until: any
  promo_until: any
  created_at?: string | null
  updated_at?: string | null
}

function addDays(days: number) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

function laterDate(a: any, b: any) {
  if (!a && !b) return null
  if (!a) return b
  if (!b) return a
  const ta = new Date(a).getTime()
  const tb = new Date(b).getTime()
  if (!Number.isFinite(ta)) return b
  if (!Number.isFinite(tb)) return a
  return ta >= tb ? a : b
}

/**
 * PROMO CODES:
 * - TEST (dev)
 * - DOCTOR12FREE (prod)
 * + ENV PROMO_CODES_JSON: {"SOME2026":30,"VIPYEAR":365}
 */
function getPromoMap() {
  const base: Record<string, number> = {
    TEST: 365,
    DOCTOR12FREE: 365,
  }

  const raw = process.env.PROMO_CODES_JSON
  if (raw) {
    try {
      const extra = JSON.parse(raw)
      if (extra && typeof extra === "object") {
        for (const [k, v] of Object.entries(extra)) {
          const key = String(k || "").toUpperCase().trim()
          const days = Number(v)
          if (key && Number.isFinite(days) && days > 0) base[key] = days
        }
      }
    } catch {}
  }

  return base
}

function routeSessionSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")

  const cookieStore = cookies()
  const pendingCookies: any[] = []

  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        pendingCookies.push(...cookiesToSet)
      },
    },
  })

  const applyPendingCookies = (res: NextResponse) => {
    for (const c of pendingCookies) res.cookies.set(c.name, c.value, c.options)
  }

  return { sb, applyPendingCookies }
}

function routeAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !(service || anon)) {
    throw new Error("Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and (SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY)")
  }

  const sb = createClient(url, service || anon!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  return sb
}

async function findGrantByDevice(sb: any, deviceHash: string): Promise<GrantRow | null> {
  const { data } = await sb
    .from("access_grants")
    .select("*")
    .eq("device_hash", deviceHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data ?? null) as GrantRow | null
}

async function createGrant(sb: any, userId: string | null, deviceHash: string, trialLeft: number, nowIso: string) {
  const { data } = await sb
    .from("access_grants")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      device_hash: deviceHash,
      trial_questions_left: trialLeft,
      paid_until: null,
      promo_until: null,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("*")
    .single()

  return (data ?? null) as GrantRow | null
}

async function updateGrant(sb: any, id: string, patch: Partial<GrantRow> & { updated_at?: string }) {
  const { data } = await sb.from("access_grants").update(patch).eq("id", id).select("*").maybeSingle()
  return (data ?? null) as GrantRow | null
}

async function ensureGrant(sb: any, userId: string | null, deviceHash: string, nowIso: string, trialDefault: number) {
  let g = await findGrantByDevice(sb, deviceHash)
  if (!g) g = (await createGrant(sb, userId, deviceHash, trialDefault, nowIso)) ?? null
  if (g?.id && userId && !g.user_id) {
    g = (await updateGrant(sb, g.id, { user_id: userId, updated_at: nowIso })) ?? g
  }
  return g
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const raw = String(body?.code || "").trim()
    const code = raw.toUpperCase()

    if (!code) {
      return NextResponse.json({ ok: false, errorCode: "EMPTY_CODE" }, { status: 200 })
    }

    const PROMO_MAP = getPromoMap()
    const days = PROMO_MAP[code]
    if (!days) {
      return NextResponse.json({ ok: false, errorCode: "INVALID_PROMO" }, { status: 200 })
    }

    const nowIso = new Date().toISOString()
    const trialDefault = Number(process.env.TRIAL_QUESTIONS_LIMIT ?? "5") || 5

    const cookieStore = cookies()
    let deviceUuid = cookieStore.get(DEVICE_COOKIE)?.value ?? null
    let needSetDeviceCookie = false
    if (!deviceUuid) {
      deviceUuid = crypto.randomUUID()
      needSetDeviceCookie = true
    }

    const { sb: sessionSb, applyPendingCookies } = routeSessionSupabase()
    const adminSb = routeAdminSupabase()

    const { data: userData } = await sessionSb.auth.getUser()
    const user = userData?.user ?? null
    const userId = user?.id ?? null
    const isLoggedIn = Boolean(userId)

    const guestHash = deviceUuid
    const accountHash = userId ? `${ACCOUNT_PREFIX}${userId}` : null

    // всегда обновляем гостевую строку
    const guestGrant = await ensureGrant(adminSb, null, guestHash, nowIso, trialDefault)
    if (!guestGrant) {
      return NextResponse.json({ ok: false, errorCode: "GRANT_NOT_FOUND" }, { status: 200 })
    }

    const promoUntil = addDays(days)
    const mergedPromoGuest = laterDate(guestGrant.promo_until ?? null, promoUntil)

    await updateGrant(adminSb, guestGrant.id, {
      promo_until: mergedPromoGuest,
      trial_questions_left: 0,
      updated_at: nowIso,
    }).catch(() => null)

    // если залогинен — обновляем account строку тоже
    if (isLoggedIn && accountHash) {
      const accGrant = await ensureGrant(adminSb, userId!, accountHash, nowIso, trialDefault)
      if (accGrant?.id) {
        const mergedPromoAcc = laterDate(accGrant.promo_until ?? null, promoUntil)
        await updateGrant(adminSb, accGrant.id, {
          promo_until: mergedPromoAcc,
          trial_questions_left: 0,
          updated_at: nowIso,
        }).catch(() => null)
      }
    }

    const res = NextResponse.json({ ok: true, promo_until: promoUntil }, { status: 200 })

    if (needSetDeviceCookie) {
      res.cookies.set(DEVICE_COOKIE, deviceUuid, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      })
    }

    applyPendingCookies(res)
    res.headers.set("cache-control", "no-store, max-age=0")
    return res
  } catch (_e: any) {
    return NextResponse.json({ ok: false, errorCode: "REDEEM_FAILED" }, { status: 200 })
  }
}
