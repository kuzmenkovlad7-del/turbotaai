import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

export const dynamic = "force-dynamic"

type AccessRow = {
  id?: string
  user_id?: string | null
  device_hash?: string | null
  trial_questions_left?: number | null
  paid_until?: string | null
  promo_until?: string | null
  auto_renew?: boolean | null
  cancelled_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

function envFirst(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k]
    if (v && String(v).trim()) return v
  }
  return ""
}

function isTableMissingError(e: any) {
  const msg = String(e?.message || "")
  return (
    msg.includes("Could not find the table") ||
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    msg.includes("Schema cache") ||
    msg.includes("PGRST")
  )
}

function parseDateOrNull(v: any) {
  if (!v) return null
  const d = new Date(v)
  return Number.isFinite(d.getTime()) ? d : null
}

function maxDate(a: Date | null, b: Date | null) {
  if (!a) return b
  if (!b) return a
  return a.getTime() >= b.getTime() ? a : b
}

function toIsoOrNull(d: Date | null) {
  return d ? d.toISOString() : null
}

const TABLE_CANDIDATES = [
  "account_access",
  "account_sessions",
  "user_access",
  "access",
  "subscriptions",
]

async function pickTable(admin: any) {
  for (const t of TABLE_CANDIDATES) {
    const { error } = await admin.from(t).select("id").limit(1)
    if (!error) return t
    if (isTableMissingError(error)) continue
  }
  return ""
}

export async function GET(req: Request) {
  const c = cookies()

  let deviceHash = c.get("device_hash")?.value?.trim() || ""
  if (!deviceHash) deviceHash = crypto.randomUUID()

  const url = envFirst("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL")
  const key = envFirst(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_ANON_KEY"
  )

  if (!url || !key) {
    const res = NextResponse.json(
      {
        ok: true,
        isLoggedIn: false,
        email: null,
        device_hash: deviceHash,
        trial_questions_left: 5,
        paid_until: null,
        promo_until: null,
        auto_renew: false,
        cancelled: false,
        hasPaid: false,
        hasPromo: false,
        access: "trial",
        error: "Supabase env is missing",
      },
      { status: 200 }
    )
    res.headers.set("cache-control", "no-store")
    res.cookies.set("device_hash", deviceHash, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 365,
    })
    return res
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let userId: string | null = null
  let email: string | null = null
  try {
    const supaAuth = createRouteHandlerClient({ cookies })
    const r = await supaAuth.auth.getUser()
    userId = r?.data?.user?.id || null
    email = r?.data?.user?.email || null
  } catch {
    userId = null
    email = null
  }

  let table = ""
  try {
    table = await pickTable(admin)
  } catch {
    table = ""
  }

  if (!table) {
    const res = NextResponse.json(
      {
        ok: true,
        isLoggedIn: !!userId,
        email,
        device_hash: deviceHash,
        trial_questions_left: 5,
        paid_until: null,
        promo_until: null,
        auto_renew: false,
        cancelled: false,
        hasPaid: false,
        hasPromo: false,
        access: "trial",
        error: "Access table not found",
      },
      { status: 200 }
    )
    res.headers.set("cache-control", "no-store")
    res.cookies.set("device_hash", deviceHash, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 365,
    })
    return res
  }

  const now = new Date()

  async function getByDevice(): Promise<AccessRow | null> {
    const r = await admin.from(table).select("*").eq("device_hash", deviceHash).maybeSingle()
    if (r.error) return null
    return (r.data || null) as any
  }

  async function ensureDeviceRow(): Promise<AccessRow> {
    const existing = await getByDevice()
    if (existing) return existing

    const ins = await admin.from(table).insert({
      device_hash: deviceHash,
      user_id: null,
      trial_questions_left: 5,
      paid_until: null,
      promo_until: null,
      auto_renew: false,
      cancelled_at: null,
    }).select("*").maybeSingle()

    if (!ins.error && ins.data) return ins.data as any

    // если insert не прошел, пробуем еще раз select
    const again = await getByDevice()
    if (again) return again

    // крайний фоллбек без 500
    return {
      device_hash: deviceHash,
      user_id: null,
      trial_questions_left: 5,
      paid_until: null,
      promo_until: null,
      auto_renew: false,
      cancelled_at: null,
    }
  }

  async function getByUser(): Promise<AccessRow | null> {
    if (!userId) return null
    const r = await admin.from(table).select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle()
    if (r.error) return null
    return (r.data || null) as any
  }

  let deviceRow = await ensureDeviceRow()

  // если есть логин, привязываем текущий deviceHash к userId, не создавая отдельный account: хеш
  if (userId && deviceRow?.user_id !== userId) {
    await admin.from(table).update({ user_id: userId }).eq("device_hash", deviceHash)
    deviceRow = (await getByDevice()) || deviceRow
  }

  const userRow = await getByUser()

  const dPaid = parseDateOrNull(deviceRow?.paid_until)
  const uPaid = parseDateOrNull(userRow?.paid_until)
  const dPromo = parseDateOrNull(deviceRow?.promo_until)
  const uPromo = parseDateOrNull(userRow?.promo_until)

  const paidUntil = maxDate(dPaid, uPaid)
  const promoUntil = maxDate(dPromo, uPromo)

  // если у userRow даты больше, синхронизируем в текущий deviceRow, чтобы интерфейс был стабилен на этом устройстве
  const needSync =
    (paidUntil && paidUntil.toISOString() !== String(deviceRow?.paid_until || "")) ||
    (promoUntil && promoUntil.toISOString() !== String(deviceRow?.promo_until || ""))

  if (needSync) {
    await admin
      .from(table)
      .update({
        paid_until: toIsoOrNull(paidUntil),
        promo_until: toIsoOrNull(promoUntil),
      })
      .eq("device_hash", deviceHash)
  }

  const cancelled = !!deviceRow?.cancelled_at
  const hasPaid = !!(paidUntil && paidUntil.getTime() > now.getTime() && !cancelled)
  const hasPromo = !!(promoUntil && promoUntil.getTime() > now.getTime())
  const trialLeft = Number(deviceRow?.trial_questions_left ?? 0)

  const access =
    hasPaid || hasPromo ? "paid" : trialLeft > 0 ? "trial" : "none"

  const res = NextResponse.json(
    {
      ok: true,
      isLoggedIn: !!userId,
      email,
      device_hash: deviceHash,
      trial_questions_left: trialLeft,
      paid_until: toIsoOrNull(paidUntil),
      promo_until: toIsoOrNull(promoUntil),
      auto_renew: !!deviceRow?.auto_renew,
      cancelled,
      hasPaid,
      hasPromo,
      access,
    },
    { status: 200 }
  )

  res.headers.set("cache-control", "no-store")
  res.cookies.set("device_hash", deviceHash, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 60 * 60 * 24 * 365,
  })
  return res
}
