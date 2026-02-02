import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { randomUUID } from "crypto"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "ta_device_hash"
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

function num(v: any, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function getTrialLimit() {
  const limit = num(process.env.TRIAL_QUESTIONS_LIMIT, 5)
  return limit > 0 ? Math.floor(limit) : 5
}

function addDaysIso(days: number) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

function toDateOrNull(v: any): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function laterDateIso(a: any, b: any): string | null {
  const da = toDateOrNull(a)
  const db = toDateOrNull(b)
  if (!da && !db) return null
  if (da && !db) return da.toISOString()
  if (!da && db) return db.toISOString()
  return (da!.getTime() >= db!.getTime() ? da! : db!).toISOString()
}

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

  return { sb, cookieStore, applyPendingCookies }
}

async function findGrantByDevice(admin: any, deviceHash: string): Promise<GrantRow | null> {
  const { data } = await admin
    .from("access_grants")
    .select("*")
    .eq("device_hash", deviceHash)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data ?? null) as GrantRow | null
}

async function ensureGrant(
  admin: any,
  deviceHash: string,
  userId: string | null,
  trialDefault: number,
  nowIso: string
): Promise<GrantRow> {
  let g = await findGrantByDevice(admin, deviceHash)

  if (!g) {
    const { data } = await admin
      .from("access_grants")
      .insert({
        id: randomUUID(),
        user_id: userId,
        device_hash: deviceHash,
        trial_questions_left: trialDefault,
        paid_until: null,
        promo_until: null,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single()

    g = (data ?? null) as GrantRow | null
  }

  if (!g) g = await findGrantByDevice(admin, deviceHash)
  if (!g) throw new Error("GRANT_CREATE_FAILED")

  if (userId && !g.user_id) {
    const { data } = await admin
      .from("access_grants")
      .update({ user_id: userId, updated_at: nowIso })
      .eq("id", g.id)
      .select("*")
      .maybeSingle()

    g = ((data ?? g) as any) as GrantRow
  }

  return g
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const raw = String(body?.code || "").trim()
    const code = raw.toUpperCase()

    if (!code) {
      return NextResponse.json({ ok: false, errorCode: "EMPTY_CODE" }, { status: 400 })
    }

    const PROMO_MAP = getPromoMap()
    const days = PROMO_MAP[code]
    if (!days) {
      return NextResponse.json({ ok: false, errorCode: "INVALID_PROMO" }, { status: 400 })
    }

    const trialDefault = getTrialLimit()
    const nowIso = new Date().toISOString()
    const promoUntil = addDaysIso(days)

    const { sb: sessionSb, cookieStore, applyPendingCookies } = routeSessionSupabase()

    let deviceUuid = cookieStore.get(DEVICE_COOKIE)?.value ?? null
    let needSetDeviceCookie = false
    if (!deviceUuid) {
      deviceUuid = randomUUID()
      needSetDeviceCookie = true
    }

    const { data: userData } = await sessionSb.auth.getUser()
    const userId = userData?.user?.id ?? null

    const admin = getSupabaseAdmin()

    const guestHash = deviceUuid
    const accountHash = userId ? `${ACCOUNT_PREFIX}${userId}` : null

    const guestGrant = await ensureGrant(admin, guestHash, userId ?? null, trialDefault, nowIso)
    const mergedGuest = laterDateIso(guestGrant.promo_until ?? null, promoUntil) ?? promoUntil

    await admin
      .from("access_grants")
      .update({ promo_until: mergedGuest, trial_questions_left: 0, updated_at: nowIso })
      .eq("id", guestGrant.id)

    let mergedAcc: string | null = null

    if (userId && accountHash) {
      const accGrant = await ensureGrant(admin, accountHash, userId, trialDefault, nowIso)
      mergedAcc = laterDateIso(accGrant.promo_until ?? null, mergedGuest) ?? mergedGuest

      await admin
        .from("access_grants")
        .update({ promo_until: mergedAcc, trial_questions_left: 0, updated_at: nowIso })
        .eq("id", accGrant.id)

      try {
        await admin
          .from("profiles")
          .update({ promo_until: mergedAcc, subscription_status: "active", updated_at: nowIso } as any)
          .eq("id", userId)
      } catch {}
    }

    const res = NextResponse.json(
      {
        ok: true,
        promo_until: mergedAcc ?? mergedGuest,
        promoUntil: mergedAcc ?? mergedGuest,
        guest: !userId,
      },
      { status: 200 }
    )

    if (needSetDeviceCookie) {
      const host = req.headers.get("host")
      const h = String(host || "").toLowerCase()
      const ckDomain = (h === "turbotaai.com" || h.endsWith(".turbotaai.com")) ? ".turbotaai.com" : undefined
      res.cookies.set(DEVICE_COOKIE, deviceUuid, {
        path: "/",
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
        domain: ckDomain,
      })
    }

    applyPendingCookies(res)
    res.headers.set("cache-control", "no-store, max-age=0")
    return res
  } catch (_e: any) {
    return NextResponse.json({ ok: false, errorCode: "REDEEM_FAILED" }, { status: 500 })
  }
}
