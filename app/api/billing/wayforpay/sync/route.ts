import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createHash } from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const WFP_URL = "https://api.wayforpay.com/api"
const DEVICE_COOKIE = "ta_device_hash"
const ACCOUNT_PREFIX = "account:"

function pickEnv(name: string) {
  const v = process.env[name]
  return v && String(v).trim() ? String(v).trim() : ""
}

function mustEnv(name: string) {
  const v = pickEnv(name)
  if (!v) throw new Error("Missing env " + name)
  return v
}

function merchantSignature(parts: string[], secret: string) {
  const base = parts.join(";")
  return createHash("md5").update(base + ";" + secret).digest("hex")
}

function mapStatus(txStatus: string) {
  const s = String(txStatus || "").toLowerCase()

  if (s === "approved" || s === "paid") return "paid"

  if (s === "pending" || s === "inprocessing" || s === "processing" || s === "waitings" || s === "waitingauthcomplete")
    return "pending"

  if (s === "refunded" || s === "voided") return "refunded"

  if (s === "declined" || s === "expired" || s === "refused" || s === "rejected") return "failed"

  return "unknown"
}

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

function calcNextPaidUntil(currentPaidUntil: any, days: number) {
  const now = new Date()
  const cur = toDateOrNull(currentPaidUntil)
  const base = cur && cur.getTime() > now.getTime() ? cur : now
  return addDays(base, days).toISOString()
}

function sbAdmin() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL")
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false } })
}

function getAccessTokenFromReqCookies(req: NextRequest): string | null {
  const all = req.cookies.getAll()

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

async function resolveUserIdFromCookies(sb: ReturnType<typeof sbAdmin>, req: NextRequest) {
  try {
    const token = getAccessTokenFromReqCookies(req)
    if (!token) return null
    const { data } = await sb.auth.getUser(token)
    return data?.user?.id || null
  } catch {
    return null
  }
}

async function fetchWfpStatus(orderReference: string) {
  const merchantAccount = mustEnv("WAYFORPAY_MERCHANT_ACCOUNT")
  const secret = mustEnv("WAYFORPAY_SECRET_KEY")

  const signature = merchantSignature([merchantAccount, orderReference], secret)

  const payload = {
    transactionType: "STATUS",
    merchantAccount,
    merchantSignature: signature,
    orderReference,
  }

  const r = await fetch(WFP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  const j = await r.json().catch(() => ({}))
  return { httpOk: r.ok, status: r.status, body: j }
}

async function upsertGrantByDeviceHash(
  sb: ReturnType<typeof sbAdmin>,
  deviceHash: string,
  days: number
) {
  const nowIso = new Date().toISOString()

  const existing = await sb
    .from("access_grants")
    .select("id, paid_until")
    .eq("device_hash", deviceHash)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing.error) throw new Error("access_grants select failed: " + existing.error.message)

  const nextPaid = calcNextPaidUntil(existing.data?.paid_until, days)

  if (existing.data?.id) {
    const upd = await sb
      .from("access_grants")
      .update({
        paid_until: nextPaid,
        trial_questions_left: 0,
        updated_at: nowIso,
      } as any)
      .eq("id", existing.data.id)

    if (upd.error) throw new Error("access_grants update failed: " + upd.error.message)
    return { mode: "update", id: existing.data.id, paid_until: nextPaid }
  }

  const ins = await sb.from("access_grants").insert({
    id: crypto.randomUUID(),
    user_id: null,
    device_hash: deviceHash,
    trial_questions_left: 0,
    paid_until: nextPaid,
    promo_until: null,
    auto_renew: false,
    cancelled_at: null,
    created_at: nowIso,
    updated_at: nowIso,
  } as any)

  if (ins.error) throw new Error("access_grants insert failed: " + ins.error.message)
  return { mode: "insert", paid_until: nextPaid }
}

async function upsertGrantByUserId(
  sb: ReturnType<typeof sbAdmin>,
  userId: string,
  days: number
) {
  const nowIso = new Date().toISOString()

  const existing = await sb
    .from("access_grants")
    .select("id, paid_until")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing.error) throw new Error("access_grants user select failed: " + existing.error.message)

  const nextPaid = calcNextPaidUntil(existing.data?.paid_until, days)

  if (existing.data?.id) {
    const upd = await sb
      .from("access_grants")
      .update({
        paid_until: nextPaid,
        trial_questions_left: 0,
        updated_at: nowIso,
      } as any)
      .eq("id", existing.data.id)

    if (upd.error) throw new Error("access_grants user update failed: " + upd.error.message)
  } else {
    const ins = await sb.from("access_grants").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      device_hash: null,
      trial_questions_left: 0,
      paid_until: nextPaid,
      promo_until: null,
      auto_renew: false,
      cancelled_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    } as any)

    if (ins.error) throw new Error("access_grants user insert failed: " + ins.error.message)
  }

  const accountKey = `${ACCOUNT_PREFIX}${userId}`
  await sb
    .from("access_grants")
    .update({ user_id: userId, updated_at: nowIso } as any)
    .eq("device_hash", accountKey)
    .is("user_id", null)

  return { paid_until: nextPaid }
}

async function handler(req: NextRequest) {
  const url = new URL(req.url)
  const debug = url.searchParams.get("debug") === "1"

  const orderReference =
    String(url.searchParams.get("orderReference") || "").trim() ||
    String(req.cookies.get("ta_last_order")?.value || "").trim()

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "Missing orderReference" }, { status: 400 })
  }

  const sb = sbAdmin()

  const ord = await sb
    .from("billing_orders")
    .select("order_reference, user_id, device_hash, plan_id, status, raw, updated_at")
    .eq("order_reference", orderReference)
    .maybeSingle()

  if (ord.error) {
    return NextResponse.json({ ok: false, error: "billing_orders select failed", details: ord.error.message }, { status: 500 })
  }
  if (!ord.data) {
    return NextResponse.json({ ok: false, error: "Order not found", orderReference }, { status: 200 })
  }

  const wfp = await fetchWfpStatus(orderReference)
  const txStatus = String((wfp.body as any)?.transactionStatus || (wfp.body as any)?.status || "")
  const state = mapStatus(txStatus)

  const raw = (wfp.body && typeof wfp.body === "object" ? wfp.body : {}) as any
  const nowIso = new Date().toISOString()

  const upd = await sb
    .from("billing_orders")
    .update({
      status: state,
      raw,
      updated_at: nowIso,
    } as any)
    .eq("order_reference", orderReference)

  const planId = String(ord.data.plan_id || "monthly")
  const days = planId === "yearly" ? 366 : 31

  const userIdFromCookie = await resolveUserIdFromCookies(sb, req)
  const deviceFromCookie = String(req.cookies.get(DEVICE_COOKIE)?.value || "").trim() || null

  const deviceHash = String(ord.data.device_hash || "").trim() || deviceFromCookie
  let userId = String(ord.data.user_id || "").trim() || null

  if (!userId && userIdFromCookie) {
    userId = userIdFromCookie
    await sb
      .from("billing_orders")
      .update({ user_id: userIdFromCookie, updated_at: nowIso } as any)
      .eq("order_reference", orderReference)
  }

  const final = state === "paid" || state === "failed" || state === "refunded"

  if (state !== "paid") {
    const message =
      state === "pending"
        ? "Платіж обробляється. Спробуйте перевірити ще раз через хвилину."
        : state === "failed"
          ? "Оплата не пройшла. Спробуйте іншу картку або повторіть оплату."
          : state === "refunded"
            ? "Оплату було повернено платіжною системою."
            : "Статус поки невідомий. Спробуйте перевірити ще раз через хвилину."

    const payload: any = {
      ok: false,
      final,
      state,
      txStatus,
      orderReference,
      billingUpdated: !upd.error,
      billingUpdateError: upd.error?.message || null,
      message,
    }

    if (debug) {
      payload.debug = {
        userIdFromCookie,
        orderUserId: ord.data.user_id,
        userIdUsed: userId,
        deviceHash,
        deviceFromCookie,
        planId,
        days,
        wfp,
      }
    }

    return NextResponse.json(payload, { status: 200 })
  }

  if (!deviceHash && !userId) {
    return NextResponse.json(
      { ok: false, final: true, state, txStatus, orderReference, error: "Order has no device_hash and no user_id" },
      { status: 200 }
    )
  }

  const ops: any[] = []

  if (deviceHash) ops.push({ scope: "device", ...(await upsertGrantByDeviceHash(sb, deviceHash, days)) })
  if (userId) ops.push({ scope: "user", ...(await upsertGrantByUserId(sb, userId, days)) })

  const paidUntil = ops.find((x) => x.scope === "user")?.paid_until || ops.find((x) => x.scope === "device")?.paid_until || null

  const payload: any = {
    ok: true,
    final: true,
    state,
    txStatus,
    orderReference,
    paidUntil,
    ops,
  }

  if (debug) {
    payload.debug = {
      userIdFromCookie,
      orderUserId: ord.data.user_id,
      userIdUsed: userId,
      deviceHash,
      deviceFromCookie,
      planId,
      days,
      wfp,
    }
  }

  return NextResponse.json(payload, { status: 200 })
}

export async function GET(req: NextRequest) {
  try {
    return await handler(req)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "Sync failed", details: String(e?.message || e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handler(req)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "Sync failed", details: String(e?.message || e) }, { status: 500 })
  }
}
