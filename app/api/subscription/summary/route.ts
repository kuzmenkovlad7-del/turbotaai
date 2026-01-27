import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

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

function num(v: string | undefined, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function getTrialLimit() {
  const raw = process.env.TRIAL_QUESTIONS_LIMIT
  const limit = num(raw, 5)
  return limit > 0 ? Math.floor(limit) : 5
}

function clampTrial(v: any, trialDefault: number) {
  const n = Number(v)
  if (!Number.isFinite(n)) return trialDefault
  if (n < 0) return 0
  return Math.min(Math.floor(n), trialDefault)
}

function isActiveDate(v: any) {
  if (!v) return false
  const t = new Date(v).getTime()
  if (!Number.isFinite(t)) return false
  return t > Date.now()
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

async function createGrant(
  sb: any,
  opts: { userId: string | null; deviceHash: string; trialLeft: number; nowIso: string }
): Promise<GrantRow | null> {
  const { data } = await sb
    .from("access_grants")
    .insert({
      id: crypto.randomUUID(),
      user_id: opts.userId,
      device_hash: opts.deviceHash,
      trial_questions_left: opts.trialLeft,
      paid_until: null,
      promo_until: null,
      created_at: opts.nowIso,
      updated_at: opts.nowIso,
    })
    .select("*")
    .single()

  return (data ?? null) as GrantRow | null
}

async function updateGrant(sb: any, id: string, patch: Partial<GrantRow> & { updated_at?: string }) {
  const { data } = await sb.from("access_grants").update(patch).eq("id", id).select("*").maybeSingle()
  return (data ?? null) as GrantRow | null
}

async function ensureGrant(sb: any, deviceHash: string, userId: string | null, trialDefault: number, nowIso: string) {
  let g = await findGrantByDevice(sb, deviceHash)
  if (!g) {
    g = (await createGrant(sb, { userId, deviceHash, trialLeft: trialDefault, nowIso })) ?? null
  }

  // если нашли строку и юзер залогинен, а user_id пустой -> привязываем
  if (g?.id && userId && !g.user_id) {
    g = (await updateGrant(sb, g.id, { user_id: userId, updated_at: nowIso })) ?? g
  }

  return g
}

export async function GET(_req: NextRequest) {
  try {
    const trialDefault = getTrialLimit()
    const nowIso = new Date().toISOString()

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

    // guest grant всегда есть
    const guestHash = deviceUuid
    let guestGrant = await ensureGrant(adminSb, guestHash, null, trialDefault, nowIso)
    if (!guestGrant) {
      return NextResponse.json({ ok: false, errorCode: "GRANT_CREATE_FAILED" }, { status: 200 })
    }

    // если гость — возвращаем как есть
    if (!isLoggedIn || !userId) {
      const trialLeft = clampTrial(guestGrant.trial_questions_left ?? trialDefault, trialDefault)
      const paidActive = isActiveDate(guestGrant.paid_until)
      const promoActive = isActiveDate(guestGrant.promo_until)

      const access = paidActive ? "Paid" : promoActive ? "Promo" : "Limited"
      const hasAccess = paidActive || promoActive || trialLeft > 0

      const res = NextResponse.json(
        {
          ok: true,
          isLoggedIn: false,
          userId: null,
          deviceHash: guestHash,
          access,
          hasAccess,
          trial_questions_left: trialLeft,
          paid_until: guestGrant.paid_until ?? null,
          promo_until: guestGrant.promo_until ?? null,
        },
        { status: 200 }
      )

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
    }

    // logged in: account key
    const accountHash = `${ACCOUNT_PREFIX}${userId}`

    let accountGrant = await ensureGrant(adminSb, accountHash, userId, trialDefault, nowIso)
    if (!accountGrant) {
      // legacy миграция: если существует строка по user_id но с другим device_hash — переносим на account:<userId>
      const { data: legacy } = await adminSb
        .from("access_grants")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (legacy?.id) {
        accountGrant = (await updateGrant(adminSb, legacy.id, { device_hash: accountHash, updated_at: nowIso })) ?? null
      }

      if (!accountGrant) {
        accountGrant = await ensureGrant(adminSb, accountHash, userId, trialDefault, nowIso)
      }
    }

    if (!accountGrant) {
      return NextResponse.json({ ok: false, errorCode: "ACCOUNT_GRANT_FAILED" }, { status: 200 })
    }

    // MERGE: trial = min, paid/promo = later
    const gLeft = clampTrial(guestGrant.trial_questions_left ?? trialDefault, trialDefault)
    const aLeft = clampTrial(accountGrant.trial_questions_left ?? trialDefault, trialDefault)
    const effLeft = Math.min(gLeft, aLeft)

    const mergedPaid = laterDate(guestGrant.paid_until ?? null, accountGrant.paid_until ?? null)
    const mergedPromo = laterDate(guestGrant.promo_until ?? null, accountGrant.promo_until ?? null)

    // обновляем ОБЕ строки чтобы нигде не расходилось
    if (guestGrant.id) {
      await updateGrant(adminSb, guestGrant.id, {
        trial_questions_left: effLeft,
        paid_until: mergedPaid,
        promo_until: mergedPromo,
        updated_at: nowIso,
      }).catch(() => null)
    }

    if (accountGrant.id) {
      accountGrant =
        (await updateGrant(adminSb, accountGrant.id, {
          trial_questions_left: effLeft,
          paid_until: mergedPaid,
          promo_until: mergedPromo,
          updated_at: nowIso,
        })) ?? accountGrant
    }

    const paidActive = isActiveDate(mergedPaid)
    const promoActive = isActiveDate(mergedPromo)

    const access = paidActive ? "Paid" : promoActive ? "Promo" : "Limited"
    const hasAccess = paidActive || promoActive || effLeft > 0

    const res = NextResponse.json(
      {
        ok: true,
        isLoggedIn: true,
        userId,
        deviceHash: accountHash,
        access,
        hasAccess,
        trial_questions_left: effLeft,
        paid_until: mergedPaid,
        promo_until: mergedPromo,
      },
      { status: 200 }
    )

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
    return NextResponse.json({ ok: false, errorCode: "SUMMARY_FAILED" }, { status: 200 })
  }
}
