import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"

const DEVICE_COOKIE = "ta_device_hash"
const ACCOUNT_PREFIX = "account:"

export type AccessSummary = {
  ok: true
  isLoggedIn: boolean
  userId: string | null
  email: string | null
  deviceHash: string

  access: "paid" | "promo" | "trial" | "none"
  hasAccess: boolean
  unlimited: boolean

  trial_questions_left: number
  questionsLeft: number

  paid_until: string | null
  paidUntil: string | null
  promo_until: string | null
  promoUntil: string | null
  access_until: string | null
  accessUntil: string | null

  hasPaid: boolean
  hasPromo: boolean

  subscription_status: string
  auto_renew: boolean

  error?: string
}

export type CookieToSet = { name: string; value: string; options: any }

type GrantRow = {
  id?: string
  user_id?: string | null
  device_hash: string
  trial_questions_left?: number | null
  paid_until?: any
  promo_until?: any
  updated_at?: string | null
  created_at?: string | null
}

function env(name: string) {
  return String(process.env[name] || "").trim()
}

function num(v: any, fallback: number) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function trialDefault() {
  const n = num(process.env.TRIAL_QUESTIONS_LIMIT, 5)
  return n > 0 ? Math.floor(n) : 5
}

function toDateOrNull(v: any): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function isFuture(v: any) {
  const d = toDateOrNull(v)
  return !!d && d.getTime() > Date.now()
}

function laterIso(a: any, b: any): string | null {
  const da = toDateOrNull(a)
  const db = toDateOrNull(b)
  if (!da && !db) return null
  if (da && !db) return da.toISOString()
  if (!da && db) return db.toISOString()
  if (da && db) return (da.getTime() >= db.getTime() ? da : db).toISOString()
  return null
}

function cookieDomainFromHost(host: string | null) {
  const h = String(host || "").toLowerCase()
  if (h === "turbotaai.com" || h.endsWith(".turbotaai.com")) return ".turbotaai.com"
  return undefined
}

function makeAdmin() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL")
  const key = env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_KEY")
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function getUserFromCookies(): Promise<{ userId: string | null; email: string | null; pending: CookieToSet[] }> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL")
  const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  const pending: CookieToSet[] = []
  if (!url || !anon) return { userId: null, email: null, pending }

  const jar = cookies()
  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return jar.getAll()
      },
      setAll(list) {
        pending.push(...(list as any))
      },
    },
  })

  try {
    const { data } = await sb.auth.getUser()
    return { userId: data?.user?.id ?? null, email: (data?.user?.email as any) ?? null, pending }
  } catch {
    return { userId: null, email: null, pending }
  }
}

async function findGrant(admin: any, key: string): Promise<GrantRow | null> {
  // ВАЖНО: даже если в БД есть дубли, берём самую свежую запись
  const { data, error } = await admin
    .from("access_grants")
    .select("*")
    .eq("device_hash", key)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) return null
  const row = Array.isArray(data) ? data[0] : null
  return (row ?? null) as GrantRow | null
}

async function ensureGrant(admin: any, key: string, userId: string | null, trial: number, nowIso: string): Promise<GrantRow> {
  let g = await findGrant(admin, key)

  if (!g) {
    // Use upsert to prevent duplicates from concurrent requests
    await admin
      .from("access_grants")
      .upsert(
        {
          device_hash: key,
          user_id: userId,
          trial_questions_left: trial,
          paid_until: null,
          promo_until: null,
          created_at: nowIso,
          updated_at: nowIso,
        } as any,
        { onConflict: "device_hash", ignoreDuplicates: true },
      )
  }

  g = await findGrant(admin, key)

  if (g && userId && !g.user_id) {
    const up = await admin
      .from("access_grants")
      .update({ user_id: userId, updated_at: nowIso } as any)
      .eq("device_hash", key)
      .select("*")
      .limit(1)

    const row = Array.isArray(up?.data) ? up.data[0] : null
    g = (row ?? g) as any
  }

  return (
    g ?? {
      id: randomUUID(),
      user_id: userId,
      device_hash: key,
      trial_questions_left: trial,
      paid_until: null,
      promo_until: null,
      created_at: nowIso,
      updated_at: nowIso,
    }
  )
}

async function readProfile(admin: any, userId: string) {
  // В Вашей схеме profiles нет user_id. Используем только id.
  // paid_until добавили миграцией, но делаем fallback на случай старой схемы.
  const cols1 = "paid_until,promo_until,auto_renew,subscription_status"
  const r1 = await admin.from("profiles").select(cols1).eq("id", userId).maybeSingle()
  if (!r1?.error && r1?.data) return r1.data

  const cols2 = "promo_until,auto_renew,subscription_status"
  const r2 = await admin.from("profiles").select(cols2).eq("id", userId).maybeSingle()
  if (!r2?.error && r2?.data) return r2.data

  return null
}

export async function buildAccessSummary(req: NextRequest): Promise<{
  summary: AccessSummary
  pendingCookies: CookieToSet[]
  needSetDeviceCookie: boolean
  deviceHash: string
  cookieDomain: string | undefined
}> {
  const nowIso = new Date().toISOString()
  const trial = trialDefault()

  const jar = cookies()
  const host = req.headers.get("host")
  const cookieDomain = cookieDomainFromHost(host)

  let deviceHash = String(jar.get(DEVICE_COOKIE)?.value || "").trim()
  let needSetDeviceCookie = false
  if (!deviceHash) {
    deviceHash = randomUUID()
    needSetDeviceCookie = true
  }

  const { userId, email, pending } = await getUserFromCookies()
  const isLoggedIn = Boolean(userId)
  const accountKey = isLoggedIn && userId ? `${ACCOUNT_PREFIX}${userId}` : null

  const admin = makeAdmin()
  if (!admin) {
    const s: AccessSummary = {
      ok: true,
      isLoggedIn,
      userId,
      email,
      deviceHash,
      access: "trial",
      hasAccess: true,
      unlimited: false,
      trial_questions_left: trial,
      questionsLeft: trial,
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
    }
    return { summary: s, pendingCookies: pending, needSetDeviceCookie, deviceHash, cookieDomain }
  }

  let guest = await ensureGrant(admin, deviceHash, null, trial, nowIso)
  let account = accountKey ? await ensureGrant(admin, accountKey, userId!, 0, nowIso) : null

  // ── Self-healing: check billing_orders for paid orders not yet synced to grants ──
  {
    // Check by device_hash
    const keysToCheck = [deviceHash]
    if (accountKey) keysToCheck.push(accountKey)

    const { data: paidByDevice } = await admin
      .from("billing_orders")
      .select("device_hash,user_id,plan_id,status,updated_at")
      .in("device_hash", keysToCheck)
      .eq("status", "paid")
      .order("updated_at", { ascending: false })
      .limit(5)

    // Also check by user_id (catches orders from other devices/sessions)
    let paidByUser: any[] = []
    if (userId) {
      const { data } = await admin
        .from("billing_orders")
        .select("device_hash,user_id,plan_id,status,updated_at")
        .eq("user_id", userId)
        .eq("status", "paid")
        .order("updated_at", { ascending: false })
        .limit(5)
      paidByUser = data || []
    }

    // Merge and deduplicate
    const allPaidOrders = [...(paidByDevice || []), ...paidByUser]
    const seen = new Set<string>()
    const uniqueOrders = allPaidOrders.filter((o) => {
      const key = `${o.device_hash}:${o.updated_at}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    for (const ord of uniqueOrders) {
      const ordDh = String(ord.device_hash || "")
      const planId = String(ord.plan_id || "monthly").toLowerCase()
      const days = (planId === "yearly" || planId === "annual" || planId === "year") ? 365 : 30

      // Determine which grant to extend
      let target: typeof guest | null = null
      let targetKey: string | null = null
      if (ordDh === deviceHash) {
        target = guest
        targetKey = "guest"
      } else if (ordDh === accountKey) {
        target = account
        targetKey = "account"
      } else if (userId && accountKey && account) {
        // Order from a different device but same user — extend account grant
        target = account
        targetKey = "account"
      }
      if (!target || !targetKey) continue

      const grantPaid = toDateOrNull(target.paid_until)

      // IDEMPOTENT: target paid_until = now + days (same as what webhook/callback would set)
      const targetDate = new Date()
      targetDate.setUTCDate(targetDate.getUTCDate() + days)

      // Only heal if grant doesn't already have sufficient paid_until
      if (!grantPaid || grantPaid.getTime() < targetDate.getTime()) {
        const nextPaidIso = targetDate.toISOString()

        const updateKey = targetKey === "guest" ? deviceHash : accountKey!
        await admin
          .from("access_grants")
          .update({ paid_until: nextPaidIso, trial_questions_left: 0, updated_at: nowIso } as any)
          .eq("device_hash", updateKey)

        if (targetKey === "guest") {
          guest = { ...guest, paid_until: nextPaidIso }
        } else if (account) {
          account = { ...account, paid_until: nextPaidIso }
        }
      }
    }
  }

  // ── Auto-claim: persist guest dates into account grant ───────────
  if (userId && account) {
    const gPaid = guest.paid_until || null
    const gPromo = guest.promo_until || null
    const aPaid = account.paid_until || null
    const aPromo = account.promo_until || null

    const bestPaid = laterIso(gPaid, aPaid)
    const bestPromo = laterIso(gPromo, aPromo)

    const needClaim =
      (bestPaid && bestPaid !== aPaid) ||
      (bestPromo && bestPromo !== aPromo)

    if (needClaim && accountKey) {
      const patch: Record<string, any> = { updated_at: nowIso }
      if (bestPaid && bestPaid !== aPaid) patch.paid_until = bestPaid
      if (bestPromo && bestPromo !== aPromo) patch.promo_until = bestPromo

      await admin
        .from("access_grants")
        .update(patch)
        .eq("device_hash", accountKey)

      account = {
        ...account,
        paid_until: bestPaid || account.paid_until,
        promo_until: bestPromo || account.promo_until,
      }
    }
  }

  const guestTrialLeft = Math.max(0, Math.min(trial, Number(guest.trial_questions_left ?? trial)))

  const mergedPaid = laterIso(guest.paid_until, account?.paid_until)
  const mergedPromo = laterIso(guest.promo_until, account?.promo_until)
  const accessUntil = laterIso(mergedPaid, mergedPromo)

  const hasPaid = isFuture(mergedPaid)
  const hasPromo = isFuture(mergedPromo)
  const unlimited = hasPaid || hasPromo
  const hasAccess = unlimited || guestTrialLeft > 0

  const access: AccessSummary["access"] =
    hasPaid ? "paid" : hasPromo ? "promo" : guestTrialLeft > 0 ? "trial" : "none"

  const prof = isLoggedIn && userId ? await readProfile(admin, userId) : null

  // Sync profiles metadata from grants if needed
  if (prof && userId) {
    const profPaid = (prof as any)?.paid_until || null
    const profPromo = (prof as any)?.promo_until || null
    const needSync =
      (mergedPaid && mergedPaid !== profPaid) ||
      (mergedPromo && mergedPromo !== profPromo)
    if (needSync) {
      const sp: Record<string, any> = { updated_at: nowIso }
      if (mergedPaid && mergedPaid !== profPaid) sp.paid_until = mergedPaid
      if (mergedPromo && mergedPromo !== profPromo) sp.promo_until = mergedPromo
      await admin.from("profiles").update(sp).eq("id", userId)
    }
  }
  const auto_renew = Boolean((prof as any)?.auto_renew ?? false)
  const subscription_status = String((prof as any)?.subscription_status || (hasPaid || hasPromo ? "active" : "inactive"))

  const s: AccessSummary = {
    ok: true,
    isLoggedIn,
    userId,
    email,
    deviceHash,

    access,
    hasAccess,
    unlimited,

    trial_questions_left: guestTrialLeft,
    questionsLeft: guestTrialLeft,

    paid_until: mergedPaid,
    paidUntil: mergedPaid,
    promo_until: mergedPromo,
    promoUntil: mergedPromo,
    access_until: accessUntil,
    accessUntil: accessUntil,

    hasPaid,
    hasPromo,

    subscription_status,
    auto_renew,
  }

  return { summary: s, pendingCookies: pending, needSetDeviceCookie, deviceHash, cookieDomain }
}
