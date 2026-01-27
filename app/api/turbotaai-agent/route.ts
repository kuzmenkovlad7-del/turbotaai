import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "ta_device_hash"
const LAST_USER_COOKIE = "turbotaai_last_user"
const ACCOUNT_PREFIX = "account:"

type GrantRow = {
  id: string
  user_id: string | null
  device_hash: string
  trial_questions_left: number | null
  paid_until: any
  promo_until: any
  created_at: string | null
  updated_at: string | null
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
  // ВАЖНО: никогда не даем "поднять" выше дефолта
  return Math.min(Math.floor(n), trialDefault)
}

function isActiveDate(v: any) {
  if (!v) return false
  const t = new Date(v).getTime()
  if (!Number.isFinite(t)) return false
  return t > Date.now()
}

function routeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }

  const cookieStore = cookies()
  const pendingCookies: any[] = []
  const extraCookies: Array<{ name: string; value: string; options?: any }> = []

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
    for (const c of pendingCookies) {
      res.cookies.set(c.name, c.value, c.options)
    }
  }

  return { sb, cookieStore, extraCookies, applyPendingCookies }
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

// legacy bug: sometimes you had user_id but device_hash was device uuid
async function findGrantByUserAndDevice(sb: any, userId: string, deviceHash: string): Promise<GrantRow | null> {
  const { data } = await sb
    .from("access_grants")
    .select("*")
    .eq("user_id", userId)
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

async function updateGrant(
  sb: any,
  id: string,
  patch: Partial<GrantRow> & { updated_at?: string }
): Promise<GrantRow | null> {
  const { data, error } = await sb.from("access_grants").update(patch).eq("id", id).select("*").maybeSingle()
  if (error) console.error("[grant] update failed", error)
  return (data ?? null) as GrantRow | null
}

/**
 * ЕДИНАЯ логика:
 * - guest: grant по device_hash
 * - account: grant по device_hash = account:<userId>
 * - при логине seed = текущий guestLeft
 * - никогда не даем увеличить trial: effective = min(guestLeft, accountLeft)
 * - при работе в account синхроним оба, чтобы logout не обходил лимит
 */


/**
 * ЕДИНАЯ логика:
 * - guest: grant по device_hash = device uuid cookie
 * - account: grant по device_hash = account:<userId>
 * - при логине никогда не даем поднять trial: effective = min(guestLeft, accountLeft)
 * - paid/promo берем как max-date из обоих
 */
async function ensureGrant(sb: any, deviceHash: string, userId: string | null, trialDefault: number, nowIso: string) {
  const laterDate = (a: any, b: any) => {
    if (!a && !b) return null
    if (!a) return b
    if (!b) return a
    const ta = new Date(a).getTime()
    const tb = new Date(b).getTime()
    if (!Number.isFinite(ta)) return b
    if (!Number.isFinite(tb)) return a
    return ta >= tb ? a : b
  }

  // 1) guest grant
  let guestGrant = await findGrantByDevice(sb, deviceHash)
  if (!guestGrant) {
    const created = await createGrant(sb, { userId: null, deviceHash, trialLeft: trialDefault, nowIso })
    guestGrant = created ?? (await findGrantByDevice(sb, deviceHash))
  }
  if (!guestGrant) throw new Error("Failed to create guest grant")

  // guest only
  if (!userId) {
    return { grant: guestGrant, scope: "guest", guestGrant }
  }

  // 2) account grant by stable key
  const accountKey = ACCOUNT_PREFIX + userId
  let accountGrant = await findGrantByDevice(sb, accountKey)

  // legacy: if there is any row by user_id with wrong device_hash -> migrate to stable key
  if (!accountGrant) {
    const { data: legacy } = await sb
      .from("access_grants")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (legacy) {
      const migrated = await updateGrant(sb, legacy.id, { device_hash: accountKey, updated_at: nowIso })
      accountGrant = migrated ?? (await findGrantByDevice(sb, accountKey))
    }
  }

  if (!accountGrant) {
    const created = await createGrant(sb, { userId, deviceHash: accountKey, trialLeft: trialDefault, nowIso })
    accountGrant = created ?? (await findGrantByDevice(sb, accountKey))
  }
  if (!accountGrant) throw new Error("Failed to create account grant")

  // 3) never increase trial after login
  const gLeft = clampTrial(guestGrant.trial_questions_left ?? trialDefault, trialDefault)
  const aLeft = clampTrial(accountGrant.trial_questions_left ?? trialDefault, trialDefault)
  const eff = Math.min(gLeft, aLeft)

  if (gLeft !== eff) {
    guestGrant = (await updateGrant(sb, guestGrant.id, { trial_questions_left: eff, updated_at: nowIso })) ?? guestGrant
  }
  if (aLeft !== eff) {
    accountGrant = (await updateGrant(sb, accountGrant.id, { trial_questions_left: eff, updated_at: nowIso })) ?? accountGrant
  }

  // 4) merge paid/promo from both (take later)
  const paidUntil = laterDate(guestGrant?.paid_until ?? null, accountGrant?.paid_until ?? null)
  const promoUntil = laterDate(guestGrant?.promo_until ?? null, accountGrant?.promo_until ?? null)

  const grant = { ...accountGrant, paid_until: paidUntil, promo_until: promoUntil }

  return { grant, scope: "account", guestGrant }
}


export async function POST(req: NextRequest) {
  const { sb, cookieStore, extraCookies, applyPendingCookies } = routeSupabase()

  // device cookie
  let deviceHash = cookieStore.get(DEVICE_COOKIE)?.value ?? null
  if (!deviceHash) {
    deviceHash = crypto.randomUUID()
    extraCookies.push({
      name: DEVICE_COOKIE,
      value: deviceHash,
      options: { path: "/", sameSite: "lax", httpOnly: false, maxAge: 60 * 60 * 24 * 365 },
    })
  }

  const trialDefault = getTrialLimit()
  const nowIso = new Date().toISOString()

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user ?? null
  const isLoggedIn = Boolean(user?.id)

  // remember last logged-in user (for trial sync after logout)
  if (isLoggedIn && user?.id) {
    extraCookies.push({
      name: LAST_USER_COOKIE,
      value: user.id,
      options: { path: "/", sameSite: "lax", httpOnly: false, maxAge: 60 * 60 * 24 * 365 },
    })
  }

  const { grant, scope, guestGrant } = await ensureGrant(sb, deviceHash, user?.id ?? null, trialDefault, nowIso)

  const trialLeft = clampTrial(grant?.trial_questions_left ?? trialDefault, trialDefault)
  const paidUntil = grant?.paid_until ?? null
  const promoUntil = grant?.promo_until ?? null

  const paidActive = isActiveDate(paidUntil)
  const promoActive = isActiveDate(promoUntil)
  const unlimited = paidActive || promoActive

  // block only when Trial and 0
  if (!unlimited && trialLeft <= 0) {
    const res = NextResponse.json(
      { ok: false, error: "PAYMENT_REQUIRED", reason: "trial_limit_reached", trialLeft, scope, isLoggedIn },
      { status: 402 }
    )
    for (const c of extraCookies) res.cookies.set(c.name, c.value, c.options)
    applyPendingCookies(res)
    res.headers.set("x-access", "Trial")
    res.headers.set("x-trial-left", String(trialLeft))
    res.headers.set("x-scope", scope)
    res.headers.set("cache-control", "no-store, max-age=0")
    return res
  }

  // proxy to n8n
  const upstream = String(process.env.N8N_TURBOTA_AGENT_WEBHOOK_URL || "").trim()
  if (!upstream) {
    const res = NextResponse.json({ ok: false, error: "Missing N8N_TURBOTA_AGENT_WEBHOOK_URL" }, { status: 500 })
    for (const c of extraCookies) res.cookies.set(c.name, c.value, c.options)
    applyPendingCookies(res)
    return res
  }

  const contentType = req.headers.get("content-type") || "application/json"
  const bodyText = await req.text()

  const upstreamRes = await fetch(upstream, {
    method: "POST",
    headers: { "content-type": contentType },
    body: bodyText,
    cache: "no-store",
  })

  const text = await upstreamRes.text()

  // decrement only after success and only if NOT unlimited
  let nextTrialLeft = trialLeft
  if (upstreamRes.ok && !unlimited) {
    nextTrialLeft = Math.max(0, trialLeft - 1)

    // update active grant
    await updateGrant(sb, grant.id, { trial_questions_left: nextTrialLeft, updated_at: nowIso })

    // IMPORTANT: if account -> sync guest too (logout can't bypass)
    if (scope === "account" && guestGrant?.id) {
      await updateGrant(sb, guestGrant.id, { trial_questions_left: nextTrialLeft, updated_at: nowIso })
    }
  }

  const res = new NextResponse(text, {
    status: upstreamRes.status,
    headers: {
      "content-type": upstreamRes.headers.get("content-type") || "application/json",
    },
  })

  for (const c of extraCookies) res.cookies.set(c.name, c.value, c.options)
  applyPendingCookies(res)

  res.headers.set("x-access", paidActive ? "Paid" : promoActive ? "Promo" : "Trial")
  res.headers.set("x-trial-left", String(nextTrialLeft))
  res.headers.set("x-scope", scope)
  res.headers.set("cache-control", "no-store, max-age=0")

  return res
}
