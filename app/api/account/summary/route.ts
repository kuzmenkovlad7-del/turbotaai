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
  device_hash: string | null
  trial_questions_left: number | null
  paid_until: any
  promo_until: any
  auto_renew: boolean | null
  cancelled_at: any
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
  if (da && db) return (da.getTime() >= db.getTime() ? da : db).toISOString()
  return null
}

function isFuture(iso: string | null) {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() > Date.now()
}

function cookieDomainFromHost(host: string | null) {
  const h = String(host || "").toLowerCase()
  if (h.endsWith(".turbotaai.com") || h === "turbotaai.com") return ".turbotaai.com"
  return undefined
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

  const json = (
    body: any,
    status = 200,
    extra?: { setDeviceCookie?: { value: string; host?: string | null } }
  ) => {
    const res = NextResponse.json(body, { status })
    for (const c of pendingCookies) res.cookies.set(c.name, c.value, c.options)

    if (extra?.setDeviceCookie?.value) {
      const domain = cookieDomainFromHost(extra.setDeviceCookie.host || null)
      res.cookies.set(DEVICE_COOKIE, extra.setDeviceCookie.value, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
        ...(domain ? { domain } : {}),
      })
    }

    res.headers.set("cache-control", "no-store, max-age=0")
    return res
  }

  return { sb, cookieStore, json }
}

async function findGrantByKey(admin: any, key: string): Promise<GrantRow | null> {
  const { data } = await admin
    .from("access_grants")
    .select("*")
    .eq("device_hash", key)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data ?? null) as GrantRow | null
}

async function createGrant(admin: any, opts: { userId: string | null; key: string; trialLeft: number; nowIso: string }) {
  const { data } = await admin
    .from("access_grants")
    .insert({
      id: randomUUID(),
      user_id: opts.userId,
      device_hash: opts.key,
      trial_questions_left: opts.trialLeft,
      paid_until: null,
      promo_until: null,
      auto_renew: false,
      cancelled_at: null,
      created_at: opts.nowIso,
      updated_at: opts.nowIso,
    } as any)
    .select("*")
    .single()

  return (data ?? null) as GrantRow | null
}

async function updateGrant(admin: any, id: string, patch: any) {
  const { data } = await admin.from("access_grants").update(patch).eq("id", id).select("*").maybeSingle()
  return (data ?? null) as GrantRow | null
}

async function ensureGrant(
  admin: any,
  key: string,
  userId: string | null,
  trialDefault: number,
  nowIso: string
): Promise<GrantRow> {
  let g = await findGrantByKey(admin, key)

  if (!g) g = await createGrant(admin, { userId, key, trialLeft: trialDefault, nowIso })
  if (!g) g = await findGrantByKey(admin, key)
  if (!g) throw new Error("GRANT_CREATE_FAILED")

  if (userId && !g.user_id) {
    const upd = await updateGrant(admin, g.id, { user_id: userId, updated_at: nowIso })
    if (upd) g = upd
  }

  return g
}

export async function GET(req: NextRequest) {
  const { sb, cookieStore, json } = routeSessionSupabase()
  const admin = getSupabaseAdmin()

  const debug = new URL(req.url).searchParams.get("debug") === "1"
  const host = req.headers.get("host")

  const trialDefault = getTrialLimit()
  const nowIso = new Date().toISOString()

  let deviceHash = cookieStore.get(DEVICE_COOKIE)?.value ?? null
  let needSetDeviceCookie = false
  if (!deviceHash) {
    deviceHash = randomUUID()
    needSetDeviceCookie = true
  }

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user ?? null
  const isLoggedIn = Boolean(user?.id)

  const guestKey = deviceHash!
  const guestGrant = await ensureGrant(admin, guestKey, null, trialDefault, nowIso)

  let accountGrant: GrantRow | null = null
  let accountKey: string | null = null

  if (isLoggedIn) {
    accountKey = `${ACCOUNT_PREFIX}${user!.id}`
    accountGrant = await ensureGrant(admin, accountKey, user!.id, trialDefault, nowIso)

    const gLeft = clampTrial(guestGrant?.trial_questions_left ?? trialDefault, trialDefault)
    const aLeft = clampTrial(accountGrant?.trial_questions_left ?? trialDefault, trialDefault)
    const effTrial = Math.min(gLeft, aLeft)

    const gPaid = guestGrant?.paid_until ? String(guestGrant.paid_until) : null
    const aPaid = accountGrant?.paid_until ? String(accountGrant.paid_until) : null
    const effPaid = laterDateIso(gPaid, aPaid)

    const gPromo = guestGrant?.promo_until ? String(guestGrant.promo_until) : null
    const aPromo = accountGrant?.promo_until ? String(accountGrant.promo_until) : null
    const effPromo = laterDateIso(gPromo, aPromo)

    if (gLeft !== effTrial) {
      await updateGrant(admin, guestGrant.id, { trial_questions_left: effTrial, updated_at: nowIso })
    }
    if (accountGrant && aLeft !== effTrial) {
      const upd = await updateGrant(admin, accountGrant.id, { trial_questions_left: effTrial, updated_at: nowIso })
      if (upd) accountGrant = upd
    }

    if (effPaid && effPaid !== aPaid && accountGrant) {
      const upd = await updateGrant(admin, accountGrant.id, { paid_until: effPaid, updated_at: nowIso })
      if (upd) accountGrant = upd
    }

    if (effPromo && effPromo !== aPromo && accountGrant) {
      const upd = await updateGrant(admin, accountGrant.id, { promo_until: effPromo, updated_at: nowIso })
      if (upd) accountGrant = upd
    }
  }

  const guestPaid = guestGrant?.paid_until ? String(guestGrant.paid_until) : null
  const guestPromo = guestGrant?.promo_until ? String(guestGrant.promo_until) : null
  const guestTrial = clampTrial(guestGrant?.trial_questions_left ?? trialDefault, trialDefault)

  const accPaid = accountGrant?.paid_until ? String(accountGrant.paid_until) : null
  const accPromo = accountGrant?.promo_until ? String(accountGrant.promo_until) : null
  const accTrial = clampTrial(accountGrant?.trial_questions_left ?? trialDefault, trialDefault)

  const paidUntil = isLoggedIn ? laterDateIso(guestPaid, accPaid) : guestPaid
  const promoUntil = isLoggedIn ? laterDateIso(guestPromo, accPromo) : guestPromo

  const hasPaid = isFuture(paidUntil)
  const hasPromo = isFuture(promoUntil)
  const unlimited = hasPaid || hasPromo

  const questionsLeft = unlimited ? 0 : isLoggedIn ? Math.min(guestTrial, accTrial) : guestTrial
  const hasAccess = unlimited || questionsLeft > 0

  const access =
    hasPaid ? "paid" : hasPromo ? "promo" : questionsLeft > 0 ? "trial" : "noaccess"

  const subscriptionStatus = hasPaid ? "active" : "inactive"

  const autoRenewRaw = (isLoggedIn ? accountGrant?.auto_renew : guestGrant?.auto_renew) ?? false
  const autoRenew = hasPaid ? Boolean(autoRenewRaw) : false

  const body: any = {
    ok: true,
    isLoggedIn,
    user: user ? { id: user.id, email: user.email || null } : null,

    access,
    hasAccess,
    unlimited,

    questionsLeft,
    paidUntil,
    promoUntil,

    subscription_status: subscriptionStatus,
    auto_renew: autoRenew,
  }

  if (debug) {
    body.debug = { deviceHash, needSetDeviceCookie, guestGrant, accountGrant, accountKey }
  }

  return json(body, 200, needSetDeviceCookie ? { setDeviceCookie: { value: deviceHash!, host } } : undefined)
}
