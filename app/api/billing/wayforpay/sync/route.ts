import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { createHmac, randomUUID } from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const WFP_URL = "https://api.wayforpay.com/api"
const DEVICE_COOKIE = "ta_device_hash"
const LAST_ORDER_COOKIE = "ta_last_order"
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

function hmacMd5(base: string, key: string) {
  return createHmac("md5", key).update(base, "utf8").digest("hex")
}

function mapTxStatus(txStatus: string) {
  const s = String(txStatus || "").toLowerCase()

  if (s === "approved" || s === "paid") return "paid"

  if (
    s === "pending" ||
    s === "inprocessing" ||
    s === "processing" ||
    s === "in_process" ||
    s === "inprogress" ||
    s === "created"
  ) {
    return "pending"
  }

  if (s === "refunded" || s === "voided" || s === "chargeback") return "refunded"

  if (s === "declined" || s === "expired" || s === "refused" || s === "rejected") return "failed"

  return "unknown"
}

function addDays(base: Date, days: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function parseDateOrNull(v: any): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function planDays(planId: string) {
  const p = String(planId || "monthly").toLowerCase()
  if (p === "yearly" || p === "annual" || p === "year") return 365
  return 30
}

function sbAdmin() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL")
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false } })
}

async function getUserIdFromRequest(): Promise<string | null> {
  const url = pickEnv("NEXT_PUBLIC_SUPABASE_URL")
  const anon = pickEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  if (!url || !anon) return null

  const jar = cookies()
  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return jar.getAll()
      },
      setAll() {},
    },
  })

  try {
    const { data } = await sb.auth.getUser()
    return data?.user?.id || null
  } catch {
    return null
  }
}

function getDeviceHashFromCookies(): string | null {
  const jar = cookies()
  const v = jar.get(DEVICE_COOKIE)?.value
  return v && String(v).trim() ? String(v).trim() : null
}

async function fetchWfpCheckStatus(orderReference: string) {
  const merchantAccount = mustEnv("WAYFORPAY_MERCHANT_ACCOUNT")
  const secret = mustEnv("WAYFORPAY_SECRET_KEY")

  const base = [merchantAccount, orderReference].join(";")
  const merchantSignature = hmacMd5(base, secret)

  const payload = {
    transactionType: "CHECK_STATUS",
    merchantAccount,
    orderReference,
    merchantSignature,
    apiVersion: 1,
  }

  const r = await fetch(WFP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  const j = await r.json().catch(() => ({}))
  return { httpOk: r.ok, httpStatus: r.status, body: j }
}

async function upsertPaidGrant(
  sb: ReturnType<typeof sbAdmin>,
  opts: { grantKey: string; userId: string | null; days: number }
) {
  const now = new Date()
  const nowIso = now.toISOString()

  const existing = await sb
    .from("access_grants")
    .select("id, paid_until")
    .eq("device_hash", opts.grantKey)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing.error) throw new Error("access_grants select failed: " + existing.error.message)

  const currentPaid = parseDateOrNull(existing.data?.paid_until)
  const base = currentPaid && currentPaid.getTime() > now.getTime() ? currentPaid : now
  const nextPaidUntil = addDays(base, opts.days).toISOString()

  if (existing.data?.id) {
    const upd = await sb
      .from("access_grants")
      .update({
        paid_until: nextPaidUntil,
        trial_questions_left: 0,
        cancelled_at: null,
        updated_at: nowIso,
        ...(opts.userId ? { user_id: opts.userId } : {}),
      } as any)
      .eq("id", existing.data.id)

    if (upd.error) throw new Error("access_grants update failed: " + upd.error.message)
    return nextPaidUntil
  }

  const ins = await sb.from("access_grants").insert({
    id: randomUUID(),
    user_id: opts.userId,
    device_hash: opts.grantKey,
    trial_questions_left: 0,
    paid_until: nextPaidUntil,
    promo_until: null,
    created_at: nowIso,
    updated_at: nowIso,
    auto_renew: false,
    cancelled_at: null,
  } as any)

  if (ins.error) throw new Error("access_grants insert failed: " + ins.error.message)
  return nextPaidUntil
}

async function activateAccessIfPaid(
  sb: ReturnType<typeof sbAdmin>,
  opts: { orderReference: string; deviceHash: string | null; userId: string | null; planId: string }
) {
  const days = planDays(opts.planId)

  const paidUntilByDevice = opts.deviceHash
    ? await upsertPaidGrant(sb, { grantKey: opts.deviceHash, userId: null, days })
    : null

  const paidUntilByAccount = opts.userId
    ? await upsertPaidGrant(sb, { grantKey: ACCOUNT_PREFIX + opts.userId, userId: opts.userId, days })
    : null

  const paid_until = paidUntilByAccount || paidUntilByDevice

  if (opts.userId && paid_until) {
    try {
      await sb
        .from("profiles")
        .update({
          paid_until,
          subscription_status: "active",
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", opts.userId)
    } catch {}
  }

  return { paid_until }
}

async function handler(req: NextRequest) {
  const url = new URL(req.url)
  const debug = url.searchParams.get("debug") === "1"

  const orderReference =
    String(url.searchParams.get("orderReference") || "").trim() ||
    String(req.cookies.get(LAST_ORDER_COOKIE)?.value || "").trim()

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "Missing orderReference" }, { status: 400 })
  }

  const sb = sbAdmin()
  const userIdFromCookie = await getUserIdFromRequest()

  const ord = await sb
    .from("billing_orders")
    .select("order_reference,user_id,device_hash,plan_id,status,raw,updated_at")
    .eq("order_reference", orderReference)
    .maybeSingle()

  if (ord.error) {
    return NextResponse.json({ ok: false, error: "billing_orders select failed", details: ord.error.message }, { status: 500 })
  }

  if (!ord.data) {
    return NextResponse.json({ ok: false, error: "Order not found", orderReference }, { status: 404 })
  }

  const deviceHash = String(ord.data.device_hash || "").trim() || getDeviceHashFromCookies()
  const planId = String(ord.data.plan_id || "monthly")
  const userId = String(ord.data.user_id || userIdFromCookie || "").trim() || null

  const wfp = await fetchWfpCheckStatus(orderReference)

  const txStatus = String((wfp.body as any)?.transactionStatus || (wfp.body as any)?.status || "")
  const reason = String((wfp.body as any)?.reason || "")
  const reasonCode = (wfp.body as any)?.reasonCode ?? null

  const state = mapTxStatus(txStatus)

  const rawToStore =
    wfp.body && typeof wfp.body === "object" ? JSON.stringify(wfp.body) : JSON.stringify({ body: wfp.body })

  const upd = await sb
    .from("billing_orders")
    .update({
      status: state,
      raw: rawToStore,
      updated_at: new Date().toISOString(),
      ...(userId && !ord.data.user_id ? { user_id: userId } : {}),
    } as any)
    .eq("order_reference", orderReference)

  if (upd.error) {
    return NextResponse.json({ ok: false, error: "billing_orders update failed", details: upd.error.message }, { status: 500 })
  }

  if (state !== "paid") {
    const payload: any = {
      ok: false,
      orderReference,
      state,
      txStatus,
      reason,
      reasonCode,
      retryable: state === "pending" || state === "unknown",
    }
    if (debug) payload.debug = { wfp, order: ord.data, userIdFromCookie, deviceHash }
    return NextResponse.json(payload, { status: 200 })
  }

  const activated = await activateAccessIfPaid(sb, {
    orderReference,
    deviceHash,
    userId,
    planId,
  })

  const payload: any = {
    ok: true,
    orderReference,
    state,
    txStatus,
    reason,
    reasonCode,
    granted: true,
    paid_until: activated.paid_until || null,
  }
  if (debug) payload.debug = { wfp, order: ord.data, userIdFromCookie, deviceHash, planId }
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
