import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { cookies } from "next/headers"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "ta_device_hash"

function toDateOrNull(v: any): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function addDays(base: Date, days: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function getAccessTokenFromCookies(): string | null {
  const jar = cookies()
  const all = jar.getAll()

  for (const c of all) {
    if (!c.name.includes("auth-token")) continue
    try {
      const j: any = JSON.parse(c.value)
      if (j?.access_token) return String(j.access_token)
      if (Array.isArray(j) && j[0]?.access_token) return String(j[0].access_token)
    } catch {}
  }

  for (const c of all) {
    if (c.name === "sb-access-token" || c.name.endsWith("access-token")) return String(c.value)
  }

  return null
}

async function resolveUserId(admin: any) {
  try {
    const token = getAccessTokenFromCookies()
    if (!token) return null
    const { data } = await admin.auth.getUser(token)
    return data?.user?.id || null
  } catch {
    return null
  }
}

function getDeviceHashFromCookies() {
  const jar = cookies()
  return String(jar.get(DEVICE_COOKIE)?.value || "").trim() || null
}

async function activatePaid(admin: any, opts: { userId?: string | null; deviceHash?: string | null; days: number }) {
  const now = new Date()
  const nowIso = now.toISOString()

  const userId = opts.userId || null
  const deviceHash = opts.deviceHash || null

  const calcNext = (current: any) => {
    const currentPaid = toDateOrNull(current?.paid_until)
    const base = currentPaid && currentPaid.getTime() > now.getTime() ? currentPaid : now
    return addDays(base, opts.days).toISOString()
  }

  let nextPaidUntil: string | null = null

  // 1) активируем по user_id
  if (userId) {
    const { data: existing } = await admin
      .from("access_grants")
      .select("id, paid_until")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle()

    const paidUntil = calcNext(existing)
    nextPaidUntil = paidUntil

    if (existing?.id) {
      await admin
        .from("access_grants")
        .update({
          paid_until: paidUntil,
          trial_questions_left: 0,
          updated_at: nowIso,
        } as any)
        .eq("id", existing.id)
    } else {
      await admin.from("access_grants").insert({
        id: crypto.randomUUID(),
        user_id: userId,
        device_hash: null,
        trial_questions_left: 0,
        paid_until: paidUntil,
        promo_until: null,
        created_at: nowIso,
        updated_at: nowIso,
      } as any)
    }

    // profiles тоже обновим
    try {
      await admin
        .from("profiles")
        .update({
          paid_until: paidUntil,
          subscription_status: "active",
          updated_at: nowIso,
        } as any)
        .eq("id", userId)
    } catch {}
  }

  // 2) активируем по device_hash (на случай гостевого сценария)
  if (deviceHash) {
    const { data: existingDev } = await admin
      .from("access_grants")
      .select("id, paid_until")
      .eq("device_hash", deviceHash)
      .limit(1)
      .maybeSingle()

    const paidUntilDev = calcNext(existingDev)
    if (!nextPaidUntil) nextPaidUntil = paidUntilDev

    if (existingDev?.id) {
      await admin
        .from("access_grants")
        .update({
          paid_until: paidUntilDev,
          trial_questions_left: 0,
          updated_at: nowIso,
        } as any)
        .eq("id", existingDev.id)
    } else {
      await admin.from("access_grants").insert({
        id: crypto.randomUUID(),
        user_id: null,
        device_hash: deviceHash,
        trial_questions_left: 0,
        paid_until: paidUntilDev,
        promo_until: null,
        created_at: nowIso,
        updated_at: nowIso,
      } as any)
    }
  }

  return { paid_until: nextPaidUntil }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const orderReference = String(sp.get("orderReference") || "").trim()
  const debug = sp.get("debug") === "1"
  const sync = sp.get("sync") === "1"

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "orderReference required" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: rows } = await admin
    .from("billing_orders")
    .select("order_reference,user_id,status,raw,updated_at,created_at,plan_id,amount,currency,device_hash")
    .eq("order_reference", orderReference)
    .order("updated_at", { ascending: false })
    .limit(10)

  const list = rows || []
  const last = list[0] as any

  if (!last) {
    return NextResponse.json({ ok: false, orderReference, status: "not_found" }, { status: 200 })
  }

  const statuses = list.map((r: any) => String(r?.status || "")).filter(Boolean)
  const best = statuses.includes("paid") ? "paid" : String(last.status || "unknown")

  const userIdCookie = await resolveUserId(admin)
  const deviceCookie = getDeviceHashFromCookies()

  const userId = String(last?.user_id || userIdCookie || "").trim() || null
  const deviceHash = String(last?.device_hash || last?.raw?.deviceHash || deviceCookie || "").trim() || null

  let activated: any = null

  if (sync && best === "paid") {
    // если заказ был без user_id, а пользователь залогинен, привяжем
    try {
      if (!last?.user_id && userIdCookie) {
        await admin
          .from("billing_orders")
          .update({ user_id: userIdCookie, updated_at: new Date().toISOString() } as any)
          .eq("order_reference", orderReference)
      }
    } catch {}

    activated = await activatePaid(admin, { userId, deviceHash, days: 30 })
  }

  const payload: any = {
    ok: true,
    orderReference,
    status: best,
  }

  if (activated?.paid_until) payload.paid_until = activated.paid_until

  if (debug) {
    payload.debug = {
      statuses,
      rows: list.length,
      lastUpdatedAt: last?.updated_at || null,
      userIdFromCookie: userIdCookie || null,
      orderUserId: last?.user_id || null,
      deviceHash,
      synced: sync,
    }
  }

  return NextResponse.json(payload)
}
