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
  return (da.getTime() >= db.getTime() ? da : db).toISOString()
}

function isFuture(iso: string | null) {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() > Date.now()
}

function pickEnv(name: string) {
  const v = process.env[name]
  return v && String(v).trim() ? String(v).trim() : ""
}

function mustEnv(name: string) {
  const v = pickEnv(name)
  if (!v) throw new Error("Missing env " + name)
  return v
}

function routeSupabaseSession() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL")
  const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

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

  const json = (body: any, status = 200, extra?: { deviceHash?: string; needSetDeviceCookie?: boolean }) => {
    const res = NextResponse.json(body, { status })

    for (const c of pendingCookies) res.cookies.set(c.name, c.value, c.options)

    if (extra?.needSetDeviceCookie && extra.deviceHash) {
      res.cookies.set({
        name: DEVICE_COOKIE,
        value: extra.deviceHash,
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      })
    }

    res.headers.set("cache-control", "no-store, max-age=0")
    return res
  }

  return { sb, cookieStore, json }
}

async function findGrantByDeviceHash(admin: any, deviceHash: string): Promise<GrantRow | null> {
  const { data } = await admin
    .from("access_grants")
    .select("*")
    .eq("device_hash", deviceHash)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data ?? null) as GrantRow | null
}

async function findGrantByUserId(admin: any, userId: string): Promise<GrantRow | null> {
  const { data } = await admin
    .from("access_grants")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data ?? null) as GrantRow | null
}

async function createGrant(admin: any, patch: Partial<GrantRow> & { trial_questions_left: number; nowIso: string }) {
  const { data } = await admin
    .from("access_grants")
    .insert({
      id: randomUUID(),
      user_id: patch.user_id ?? null,
      device_hash: patch.device_hash ?? null,
      trial_questions_left: patch.trial_questions_left,
      paid_until: patch.paid_until ?? null,
      promo_until: patch.promo_until ?? null,
      auto_renew: false,
      cancelled_at: null,
      created_at: patch.nowIso,
      updated_at: patch.nowIso,
    } as any)
    .select("*")
    .single()

  return (data ?? null) as GrantRow | null
}

async function updateGrant(admin: any, id: string, patch: any) {
  const { data } = await admin.from("access_grants").update(patch).eq("id", id).select("*").maybeSingle()
  return (data ?? null) as GrantRow | null
}

async function ensureGuestGrant(admin: any, deviceHash: string, trialDefault: number, nowIso: string): Promise<GrantRow> {
  let g = await findGrantByDeviceHash(admin, deviceHash)
  if (!g) g = await createGrant(admin, { user_id: null, device_hash: deviceHash, trial_questions_left: trialDefault, nowIso })
  if (!g) g = await findGrantByDeviceHash(admin, deviceHash)
  if (!g) throw new Error("GRANT_CREATE_FAILED_GUEST")
  return g
}

async function ensureAccountGrant(admin: any, userId: string, trialDefault: number, nowIso: string): Promise<GrantRow> {
  let g = await findGrantByUserId(admin, userId)

  if (!g) {
    const accountKey = `${ACCOUNT_PREFIX}${userId}`
    g = await findGrantByDeviceHash(admin, accountKey)
    if (g?.id && !g.user_id) {
      const upd = await updateGrant(admin, g.id, { user_id: userId, updated_at: nowIso })
      if (upd) g = upd
    }
  }

  if (!g) g = await createGrant(admin, { user_id: userId, device_hash: null, trial_questions_left: trialDefault, nowIso })
  if (!g) g = await findGrantByUserId(admin, userId)
  if (!g) throw new Error("GRANT_CREATE_FAILED_ACCOUNT")

  return g
}

export async function GET(req: NextRequest) {
  const { sb, cookieStore, json } = routeSupabaseSession()
  const admin = getSupabaseAdmin()

  const trialDefault = getTrialLimit()
  const nowIso = new Date().toISOString()

  const debug = req.nextUrl.searchParams.get("debug") === "1"

  let deviceHash = String(cookieStore.get(DEVICE_COOKIE)?.value || "").trim() || null
  let needSetDeviceCookie = false
  if (!deviceHash) {
    deviceHash = randomUUID()
    needSetDeviceCookie = true
  }

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user ?? null
  const isLoggedIn = Boolean(user?.id)

  const guestGrant = await ensureGuestGrant(admin, deviceHash!, trialDefault, nowIso)

  let accountGrant: GrantRow | null = null
  if (isLoggedIn) {
    accountGrant = await ensureAccountGrant(admin, user!.id, trialDefault, nowIso)

    const gLeft = clampTrial(guestGrant?.trial_questions_left ?? trialDefault, trialDefault)
    const aLeft = clampTrial(accountGrant?.trial_questions_left ?? trialDefault, trialDefault)
    const eff = Math.min(gLeft, aLeft)

    if (gLeft !== eff) {
      await updateGrant(admin, guestGrant.id, { trial_questions_left: eff, updated_at: nowIso })
    }
    if (aLeft !== eff) {
      await updateGrant(admin, accountGrant.id, { trial_questions_left: eff, updated_at: nowIso })
    }
  }

  const guestPaid = guestGrant?.paid_until ? String(guestGrant.paid_until) : null
  const guestPromo = guestGrant?.promo_until ? String(guestGrant.promo_until) : null

  const accPaid = accountGrant?.paid_until ? String(accountGrant.paid_until) : null
  const accPromo = accountGrant?.promo_until ? String(accountGrant.promo_until) : null

  const paidUntil = isLoggedIn ? laterDateIso(guestPaid, accPaid) : guestPaid
  const promoUntil = isLoggedIn ? laterDateIso(guestPromo, accPromo) : guestPromo
  const accessUntil = laterDateIso(paidUntil, promoUntil)

  const paidActive = isFuture(paidUntil)
  const promoActive = isFuture(promoUntil)

  const trialLeftRaw = clampTrial(
    isLoggedIn
      ? Math.min(
          clampTrial(guestGrant?.trial_questions_left ?? trialDefault, trialDefault),
          clampTrial(accountGrant?.trial_questions_left ?? trialDefault, trialDefault)
        )
      : guestGrant?.trial_questions_left ?? trialDefault,
    trialDefault
  )

  const hasAccess = paidActive || promoActive || trialLeftRaw > 0
  const access = paidActive ? "Paid" : promoActive ? "Promo" : "Trial"
  const subscriptionStatus = paidActive ? "active" : "inactive"

  const autoRenew =
    (isLoggedIn ? accountGrant?.auto_renew : guestGrant?.auto_renew) === true

  const body: any = {
    ok: true,
    isLoggedIn,
    user: user?.email ? { id: user.id, email: user.email } : null,

    access,
    unlimited: paidActive || promoActive,
    hasAccess,

    trial_questions_left: trialLeftRaw,
    trial_left: trialLeftRaw,
    trialLeft: trialLeftRaw,

    paidUntil: paidUntil,
    promoUntil: promoUntil,
    accessUntil: accessUntil,

    autoRenew,
    subscriptionStatus,
  }

  if (debug) {
    body.debug = {
      deviceHash,
      needSetDeviceCookie,
      guestGrant: {
        id: guestGrant.id,
        user_id: guestGrant.user_id,
        device_hash: guestGrant.device_hash,
        trial_questions_left: guestGrant.trial_questions_left,
        paid_until: guestGrant.paid_until,
        promo_until: guestGrant.promo_until,
        updated_at: guestGrant.updated_at,
      },
      accountGrant: accountGrant
        ? {
            id: accountGrant.id,
            user_id: accountGrant.user_id,
            device_hash: accountGrant.device_hash,
            trial_questions_left: accountGrant.trial_questions_left,
            paid_until: accountGrant.paid_until,
            promo_until: accountGrant.promo_until,
            updated_at: accountGrant.updated_at,
          }
        : null,
    }
  }

  return json(body, 200, { deviceHash: deviceHash!, needSetDeviceCookie })
}
