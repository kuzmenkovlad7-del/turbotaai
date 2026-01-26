import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { randomUUID } from "crypto"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "turbotaai_device"
const ACCOUNT_PREFIX = "account:"

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

function isFuture(iso: string | null) {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() > Date.now()
}

function routeSupabase() {
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

  const json = (body: any, status = 200) => {
    const res = NextResponse.json(body, { status })
    for (const c of pendingCookies) res.cookies.set(c.name, c.value, c.options)
    res.headers.set("cache-control", "no-store, max-age=0")
    return res
  }

  return { sb, cookieStore, json }
}

async function findGrantByDevice(admin: any, deviceHash: string) {
  const { data } = await admin
    .from("access_grants")
    .select("*")
    .eq("device_hash", deviceHash)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ?? null
}

async function createGrant(admin: any, opts: { userId: string | null; deviceHash: string; trialLeft: number; nowIso: string }) {
  const { data } = await admin
    .from("access_grants")
    .insert({
      id: randomUUID(),
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

  return data ?? null
}

async function updateGrant(admin: any, id: string, patch: any) {
  const { data } = await admin.from("access_grants").update(patch).eq("id", id).select("*").maybeSingle()
  return data ?? null
}

export async function GET() {
  const { sb, cookieStore, json } = routeSupabase()
  const admin = getSupabaseAdmin()

  const trialDefault = getTrialLimit()
  const nowIso = new Date().toISOString()

  // device cookie
  let deviceHash = cookieStore.get(DEVICE_COOKIE)?.value ?? null
  let needSetDeviceCookie = false
  if (!deviceHash) {
    deviceHash = randomUUID()
    needSetDeviceCookie = true
  }

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user ?? null
  const isLoggedIn = Boolean(user?.id)

  // guest grant
  let guestGrant = await findGrantByDevice(admin, deviceHash!)
  if (!guestGrant) {
    guestGrant = await createGrant(admin, { userId: null, deviceHash: deviceHash!, trialLeft: trialDefault, nowIso })
  }

  // account grant
  let accountGrant: any = null
  if (isLoggedIn) {
    const accountKey = ACCOUNT_PREFIX + user!.id
    accountGrant = await findGrantByDevice(admin, accountKey)

    // legacy migration: есть запись по user_id → переносим на accountKey
    if (!accountGrant) {
      const { data: legacy } = await admin
        .from("access_grants")
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (legacy?.id) {
        accountGrant = await updateGrant(admin, legacy.id, { device_hash: accountKey, updated_at: nowIso })
      }
    }

    if (!accountGrant) {
      accountGrant = await createGrant(admin, { userId: user!.id, deviceHash: accountKey, trialLeft: trialDefault, nowIso })
    }

    // sync trial: min(guest, account)
    const gLeft = clampTrial(guestGrant?.trial_questions_left ?? trialDefault, trialDefault)
    const aLeft = clampTrial(accountGrant?.trial_questions_left ?? trialDefault, trialDefault)
    const eff = Math.min(gLeft, aLeft)

    if (guestGrant && gLeft !== eff) {
      guestGrant = (await updateGrant(admin, guestGrant.id, { trial_questions_left: eff, updated_at: nowIso })) ?? guestGrant
    }
    if (accountGrant && aLeft !== eff) {
      accountGrant = (await updateGrant(admin, accountGrant.id, { trial_questions_left: eff, updated_at: nowIso })) ?? accountGrant
    }
  }

  // entitlements: profiles source of truth when logged in
  let paidUntil: string | null = null
  let promoUntil: string | null = null
  let autoRenew = false
  let subscriptionStatus = ""

  if (isLoggedIn) {
    const { data: p } = await admin
      .from("profiles")
      .select("paid_until,promo_until,auto_renew,autorenew,subscription_status")
      .eq("id", user!.id)
      .maybeSingle()

    paidUntil = p?.paid_until ? String(p.paid_until) : null
    promoUntil = p?.promo_until ? String(p.promo_until) : null
    autoRenew = Boolean(p?.auto_renew ?? p?.autorenew ?? false)
    subscriptionStatus = String(p?.subscription_status ?? "")
  }

  // fallback: если профиля нет, берем из grants
  if (!paidUntil && accountGrant?.paid_until) paidUntil = String(accountGrant.paid_until)
  if (!promoUntil && accountGrant?.promo_until) promoUntil = String(accountGrant.promo_until)

  // ✅ ВАЖНО: если оплатил как гость, а потом вошёл — закрепляем доступ за аккаунтом
  if (isLoggedIn) {
    const gPaid = guestGrant?.paid_until ? String(guestGrant.paid_until) : null
    const gPromo = guestGrant?.promo_until ? String(guestGrant.promo_until) : null

    const mergedPaid = laterDateIso(paidUntil, gPaid)
    const mergedPromo = laterDateIso(promoUntil, gPromo)

    const needMerge = mergedPaid !== paidUntil || mergedPromo !== promoUntil

    if (needMerge) {
      paidUntil = mergedPaid
      promoUntil = mergedPromo

      try {
        await admin
          .from("profiles")
          .update({
            paid_until: paidUntil,
            promo_until: promoUntil,
            subscription_status: isFuture(paidUntil) || isFuture(promoUntil) ? "active" : "inactive",
            updated_at: nowIso,
          } as any)
          .eq("id", user!.id)
      } catch {}

      try {
        if (accountGrant?.id) {
          await updateGrant(admin, accountGrant.id, {
            paid_until: paidUntil,
            promo_until: promoUntil,
            updated_at: nowIso,
          })
        }
      } catch {}
    }
  }

  const accessUntil = laterDateIso(paidUntil, promoUntil)
  const paidActive = isFuture(paidUntil)
  const promoActive = isFuture(promoUntil)
  const unlimited = paidActive || promoActive

  const trialLeft = clampTrial(
    (isLoggedIn ? accountGrant?.trial_questions_left : guestGrant?.trial_questions_left) ?? trialDefault,
    trialDefault
  )

  const access = paidActive ? "Paid" : promoActive ? "Promo" : "Trial"

  const payload = {
    ok: true,
    isLoggedIn,
    user: isLoggedIn ? { id: user!.id, email: user!.email } : null,
    access,
    unlimited,
    hasAccess: unlimited,
    trial_questions_left: trialLeft,
    trial_left: trialLeft,
    trialLeft,
    paidUntil,
    promoUntil,
    accessUntil,
    autoRenew,
    subscriptionStatus: subscriptionStatus || (unlimited ? "active" : "inactive"),
  }

  const res = json(payload)

  if (needSetDeviceCookie) {
    res.cookies.set(DEVICE_COOKIE, deviceHash!, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  return res
}
