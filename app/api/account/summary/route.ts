import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"

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

function pickEnv(name: string) {
  const v = process.env[name]
  return v && String(v).trim() ? String(v).trim() : ""
}

function num(v: any, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function getTrialLimit() {
  const limit = num(process.env.TRIAL_QUESTIONS_LIMIT, 5)
  return limit > 0 ? Math.floor(limit) : 5
}

function clampTrial(v: any, trialDefault: number) {
  const n = Number(v)
  if (!Number.isFinite(n)) return trialDefault
  if (n < 0) return 0
  return Math.min(Math.floor(n), trialDefault)
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

function isFutureIso(v: any) {
  const d = toDateOrNull(v)
  if (!d) return false
  return d.getTime() > Date.now()
}

function routeSessionSupabase() {
  const url = pickEnv("NEXT_PUBLIC_SUPABASE_URL")
  const anon = pickEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  if (!url || !anon) return null

  const jar = cookies()
  const pending: any[] = []

  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return jar.getAll()
      },
      setAll(cookiesToSet) {
        pending.push(...cookiesToSet)
      },
    },
  })

  const applyPendingCookies = (res: NextResponse) => {
    for (const c of pending) res.cookies.set(c.name, c.value, c.options)
  }

  return { sb, applyPendingCookies }
}

function routeAdminSupabase() {
  const url = pickEnv("NEXT_PUBLIC_SUPABASE_URL")
  const service = pickEnv("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !service) return null

  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function findGrantByKey(admin: any, deviceHash: string): Promise<GrantRow | null> {
  const { data } = await admin.from("access_grants").select("*").eq("device_hash", deviceHash).maybeSingle()
  return (data ?? null) as GrantRow | null
}

async function ensureGrant(
  admin: any,
  deviceHash: string,
  userId: string | null,
  trialDefault: number,
  nowIso: string
): Promise<GrantRow> {
  let g = await findGrantByKey(admin, deviceHash)

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

  if (!g) g = await findGrantByKey(admin, deviceHash)
  if (!g) {
    return {
      id: randomUUID(),
      user_id: userId,
      device_hash: deviceHash,
      trial_questions_left: trialDefault,
      paid_until: null,
      promo_until: null,
      created_at: nowIso,
      updated_at: nowIso,
    }
  }

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

async function readProfile(admin: any, userId: string) {
  const cols = "paid_until,promo_until,auto_renew,autorenew,subscription_status"
  const r1 = await admin.from("profiles").select(cols).eq("id", userId).maybeSingle()
  if (!r1?.error && r1?.data) return r1.data

  const r2 = await admin.from("profiles").select(cols).eq("user_id", userId).maybeSingle()
  if (!r2?.error && r2?.data) return r2.data

  return null
}

export async function GET(_req: NextRequest) {
  const trialDefault = getTrialLimit()
  const nowIso = new Date().toISOString()

  const jar = cookies()

  let deviceUuid = jar.get(DEVICE_COOKIE)?.value ?? null
  let needSetDeviceCookie = false
  if (!deviceUuid) {
    deviceUuid = randomUUID()
    needSetDeviceCookie = true
  }

  const session = routeSessionSupabase()
  const admin = routeAdminSupabase()

  let userId: string | null = null
  let email: string | null = null

  if (session) {
    try {
      const { data } = await session.sb.auth.getUser()
      userId = data?.user?.id ?? null
      email = (data?.user?.email ?? null) as any
    } catch {
      userId = null
      email = null
    }
  }

  const isLoggedIn = Boolean(userId)
  const guestHash = deviceUuid
  const accountHash = isLoggedIn && userId ? `${ACCOUNT_PREFIX}${userId}` : null

  // если нет admin ключа, возвращаем стабильный дефолт, но cookie для устройства ставим
  if (!admin) {
    const access = "trial"
    const hasAccess = true

    const res = NextResponse.json(
      {
        ok: true,
        isLoggedIn,
        userId,
        email,
        deviceHash: guestHash,
        access,
        hasAccess,
        unlimited: false,
        trial_questions_left: trialDefault,
        questionsLeft: trialDefault,
        paid_until: null,
        paidUntil: null,
        promo_until: null,
        promoUntil: null,
        access_until: null,
        accessUntil: null,
        hasPaid: false,
        hasPromo: false,
        subscription_status: "inactive",
        auto_renew: false,
        error: "Missing SUPABASE_SERVICE_ROLE_KEY",
      },
      { status: 200 }
    )

    if (needSetDeviceCookie) {
      res.cookies.set(DEVICE_COOKIE, deviceUuid, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
      })
    }

    session?.applyPendingCookies(res)
    res.headers.set("cache-control", "no-store, max-age=0")
    return res
  }

  // ensure guest grant
  const guestGrant = await ensureGrant(admin, guestHash, null, trialDefault, nowIso)

  // logged out summary
  if (!isLoggedIn || !userId || !accountHash) {
    const left = clampTrial(guestGrant.trial_questions_left ?? trialDefault, trialDefault)
    const paidUntil = guestGrant.paid_until ?? null
    const promoUntil = guestGrant.promo_until ?? null

    const hasPaid = isFutureIso(paidUntil)
    const hasPromo = isFutureIso(promoUntil)
    const unlimited = hasPaid || hasPromo
    const access = hasPaid ? "paid" : hasPromo ? "promo" : left > 0 ? "trial" : "none"
    const hasAccess = unlimited || left > 0
    const accessUntil = laterDateIso(paidUntil, promoUntil)

    const res = NextResponse.json(
      {
        ok: true,
        isLoggedIn: false,
        userId: null,
        email: null,
        deviceHash: guestHash,
        access,
        hasAccess,
        unlimited,
        trial_questions_left: left,
        questionsLeft: left,
        paid_until: paidUntil,
        paidUntil,
        promo_until: promoUntil,
        promoUntil,
        access_until: accessUntil,
        accessUntil,
        hasPaid,
        hasPromo,
        subscription_status: unlimited ? "active" : "inactive",
        auto_renew: false,
      },
      { status: 200 }
    )

    if (needSetDeviceCookie) {
      res.cookies.set(DEVICE_COOKIE, deviceUuid, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
      })
    }

    session?.applyPendingCookies(res)
    res.headers.set("cache-control", "no-store, max-age=0")
    return res
  }

  // ensure account grant
  let accGrant = await ensureGrant(admin, accountHash, userId, trialDefault, nowIso)

  // legacy миграция: если есть строка по user_id, но device_hash не account:<userId>, переносим на account:<userId>
  if (!accGrant?.id) {
    const { data: legacy } = await admin
      .from("access_grants")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle()

    if (legacy?.id && legacy.device_hash !== accountHash) {
      const { data: moved } = await admin
        .from("access_grants")
        .update({ device_hash: accountHash, updated_at: nowIso })
        .eq("id", legacy.id)
        .select("*")
        .maybeSingle()

      if (moved?.id) accGrant = moved as any
    }
  }

  // merge grants + profile (если профиль хранит более поздние until)
  const gLeft = clampTrial(guestGrant.trial_questions_left ?? trialDefault, trialDefault)
  const aLeft = clampTrial(accGrant.trial_questions_left ?? trialDefault, trialDefault)
  const effLeft = Math.min(gLeft, aLeft)

  const mergedPaid0 = laterDateIso(guestGrant.paid_until ?? null, accGrant.paid_until ?? null)
  const mergedPromo0 = laterDateIso(guestGrant.promo_until ?? null, accGrant.promo_until ?? null)

  let profPaid: any = null
  let profPromo: any = null
  let autoRenew = false
  let subscriptionStatus: string | null = null

  try {
    const p = await readProfile(admin, userId)
    profPaid = p?.paid_until ?? null
    profPromo = p?.promo_until ?? null
    autoRenew = Boolean(p?.auto_renew ?? p?.autorenew ?? false)
    subscriptionStatus = p?.subscription_status ? String(p.subscription_status) : null
  } catch {
    profPaid = null
    profPromo = null
    autoRenew = false
    subscriptionStatus = null
  }

  const mergedPaid = laterDateIso(mergedPaid0, profPaid)
  const mergedPromo = laterDateIso(mergedPromo0, profPromo)

  // обновляем обе строки, чтобы на устройстве и в аккаунте было одинаково
  const patch = {
    trial_questions_left: effLeft,
    paid_until: mergedPaid,
    promo_until: mergedPromo,
    updated_at: nowIso,
  }

  if (guestGrant?.id) {
    await admin.from("access_grants").update(patch).eq("id", guestGrant.id).catch(() => null)
  }
  if (accGrant?.id) {
    await admin.from("access_grants").update({ ...patch, user_id: userId }).eq("id", accGrant.id).catch(() => null)
  }

  const hasPaid = isFutureIso(mergedPaid)
  const hasPromo = isFutureIso(mergedPromo)
  const unlimited = hasPaid || hasPromo
  const access = hasPaid ? "paid" : hasPromo ? "promo" : effLeft > 0 ? "trial" : "none"
  const hasAccess = unlimited || effLeft > 0
  const accessUntil = laterDateIso(mergedPaid, mergedPromo)

  if (!subscriptionStatus) subscriptionStatus = unlimited ? "active" : "inactive"

  const res = NextResponse.json(
    {
      ok: true,
      isLoggedIn: true,
      userId,
      email,
      deviceHash: guestHash,
      accountHash,
      access,
      hasAccess,
      unlimited,
      trial_questions_left: effLeft,
      questionsLeft: effLeft,
      paid_until: mergedPaid,
      paidUntil: mergedPaid,
      promo_until: mergedPromo,
      promoUntil: mergedPromo,
      access_until: accessUntil,
      accessUntil,
      hasPaid,
      hasPromo,
      subscription_status: subscriptionStatus,
      auto_renew: autoRenew,
    },
    { status: 200 }
  )

  if (needSetDeviceCookie) {
    res.cookies.set(DEVICE_COOKIE, deviceUuid, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  session?.applyPendingCookies(res)
  res.headers.set("cache-control", "no-store, max-age=0")
  return res
}
