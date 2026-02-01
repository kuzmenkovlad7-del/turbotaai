import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import crypto, { randomUUID } from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const WFP_URL = "https://api.wayforpay.com/api"
const DEVICE_COOKIE = "ta_device_hash"
const LAST_ORDER_COOKIE = "ta_last_order"
const ACCOUNT_PREFIX = "account:"

function env(name: string) {
  return String(process.env[name] || "").trim()
}

function cookieDomainFromHost(host: string | null) {
  const h = String(host || "").toLowerCase()
  if (h === "turbotaai.com" || h.endsWith(".turbotaai.com")) return ".turbotaai.com"
  return undefined
}

function hmacMd5HexLower(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str, "utf8").digest("hex")
}

function mapTxStatus(txStatus: string) {
  const s = String(txStatus || "").toLowerCase()
  if (s === "approved" || s === "paid") return "paid"
  if (s === "pending" || s === "inprocessing" || s === "processing" || s === "created" || s === "in_process" || s === "inprogress") return "pending"
  if (s === "refunded" || s === "voided" || s === "chargeback") return "refunded"
  if (s === "declined" || s === "expired" || s === "refused" || s === "rejected") return "failed"
  return s || "unknown"
}

function planDays(planId: string) {
  const p = String(planId || "monthly").toLowerCase()
  if (p === "yearly" || p === "annual" || p === "year") return 365
  return 30
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

function makeAdmin() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL")
  const key = env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_KEY")
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

async function getUserIdFromCookies(): Promise<{ userId: string | null; pending: any[] }> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL")
  const anon = env("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  const pending: any[] = []
  if (!url || !anon) return { userId: null, pending }

  const jar = cookies()
  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return jar.getAll()
      },
      setAll(list) {
        pending.push(...list)
      },
    },
  })

  try {
    const { data } = await sb.auth.getUser()
    return { userId: data?.user?.id ?? null, pending }
  } catch {
    return { userId: null, pending }
  }
}

async function wfpCheckStatus(orderReference: string) {
  const merchantAccount = env("WAYFORPAY_MERCHANT_ACCOUNT")
  const secret = env("WAYFORPAY_SECRET_KEY") || env("WAYFORPAY_MERCHANT_SECRET_KEY")
  if (!merchantAccount || !secret) throw new Error("Missing WAYFORPAY_MERCHANT_ACCOUNT / WAYFORPAY_SECRET_KEY")

  const signStr = `${merchantAccount};${orderReference}`
  const merchantSignature = hmacMd5HexLower(signStr, secret)

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

  const j = await r.json().catch(() => ({} as any))
  return { ok: r.ok, status: r.status, body: j, merchantAccount, secret }
}

async function extendPaidUntil(admin: any, key: string, days: number, userId: string | null) {
  const now = new Date()
  const nowIso = now.toISOString()

  // ВАЖНО: берём самую свежую запись по key
  const { data: rows, error } = await admin
    .from("access_grants")
    .select("id,paid_until,device_hash,created_at,updated_at")
    .eq("device_hash", key)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) throw new Error("access_grants select failed: " + error.message)

  const existing = Array.isArray(rows) ? rows[0] : null

  const current = toDateOrNull((existing as any)?.paid_until)
  // IDEMPOTENT: target = now + days; skip if current >= target
  const target = addDays(now, days)
  const nextPaid = (current && current.getTime() >= target.getTime()) ? current.toISOString() : target.toISOString()

  // Skip DB write if grant already has sufficient paid_until
  if (current && current.getTime() >= target.getTime() && (existing as any)?.id) {
    return nextPaid
  }

  if ((existing as any)?.id) {
    const up = await admin
      .from("access_grants")
      .update({
        paid_until: nextPaid,
        trial_questions_left: 0,
        cancelled_at: null,
        updated_at: nowIso,
        ...(userId ? { user_id: userId } : {}),
      } as any)
      .eq("id", (existing as any).id)

    if (up.error) throw new Error("access_grants update failed: " + up.error.message)
    return nextPaid
  }

  const ins = await admin.from("access_grants").insert({
    id: randomUUID(),
    user_id: userId,
    device_hash: key,
    trial_questions_left: 0,
    paid_until: nextPaid,
    promo_until: null,
    created_at: nowIso,
    updated_at: nowIso,
    cancelled_at: null,
    auto_renew: false,
  } as any)

  if (ins.error) throw new Error("access_grants insert failed: " + ins.error.message)
  return nextPaid
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const host = req.headers.get("host")
  const domain = cookieDomainFromHost(host)

  const sp = url.searchParams
  let orderReference = String(sp.get("orderReference") || "").trim()
  const jar = cookies()
  if (!orderReference) orderReference = String(jar.get(LAST_ORDER_COOKIE)?.value || "").trim()

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "Missing orderReference" }, { status: 400 })
  }

  // ensure device cookie
  let deviceHash = String(jar.get(DEVICE_COOKIE)?.value || "").trim()
  let needSetDeviceCookie = false
  if (!deviceHash) {
    deviceHash = randomUUID()
    needSetDeviceCookie = true
  }

  const { userId: sessionUserId, pending } = await getUserIdFromCookies()
  const admin = makeAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 })
  }

  // read order
  const { data: ord, error: ordErr } = await admin
    .from("billing_orders")
    .select("order_reference,status,plan_id,amount,currency,user_id,device_hash,updated_at,created_at")
    .eq("order_reference", orderReference)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ordErr) {
    return NextResponse.json({ ok: false, error: "billing_orders read failed", details: ordErr.message }, { status: 500 })
  }

  const planId = String((ord as any)?.plan_id || "monthly")
  const orderDeviceHash = String((ord as any)?.device_hash || "").trim() || null
  const orderUserId = String((ord as any)?.user_id || "").trim() || null
  const effectiveUserId = sessionUserId || orderUserId

  // check status at WFP
  const w = await wfpCheckStatus(orderReference)
  const body: any = w.body || {}
  const tx = String(body.transactionStatus || body.transaction_status || body.status || "").trim()
  const normalized = mapTxStatus(tx)

  // optional: verify response signature if all fields exist
  const respSig = String(body.merchantSignature || body.merchant_signature || "").trim()
  let sigOk: boolean | null = null
  if (respSig) {
    const signString = [
      w.merchantAccount,
      String(body.orderReference || orderReference),
      String(body.amount || ""),
      String(body.currency || ""),
      String(body.authCode || ""),
      String(body.cardPan || ""),
      String(body.transactionStatus || ""),
      String(body.reasonCode || ""),
    ].join(";")

    const our = hmacMd5HexLower(signString, w.secret)
    sigOk = our.toUpperCase() === respSig.toUpperCase()
  }

  // update order status + raw
  const up = await admin
    .from("billing_orders")
    .update({
      status: normalized,
      raw: { ...body, __event: "wayforpay_check_status", _sigOk: sigOk },
      updated_at: new Date().toISOString(),
    } as any)
    .eq("order_reference", orderReference)

  if (up.error) {
    return NextResponse.json({ ok: false, error: "billing_orders update failed", details: up.error.message }, { status: 500 })
  }

  let paidUntil: string | null = null
  let keysUpdated: string[] = []

  if (normalized === "paid") {
    const days = planDays(planId)

    const keys: Array<{ key: string; userId: string | null }> = []
    if (orderDeviceHash) keys.push({ key: orderDeviceHash, userId: null })
    // NOTE: Do NOT create grants for deviceHash if different from orderDeviceHash — avoid orphan rows.
    // The cookie will be set to orderDeviceHash below.
    if (effectiveUserId) keys.push({ key: `${ACCOUNT_PREFIX}${effectiveUserId}`, userId: effectiveUserId })

    for (const k of keys) {
      const pu = await extendPaidUntil(admin, k.key, days, k.userId)
      keysUpdated.push(k.key)
      if (!paidUntil) paidUntil = pu
      else {
        const a = toDateOrNull(paidUntil)
        const b = toDateOrNull(pu)
        if (a && b && b.getTime() > a.getTime()) paidUntil = pu
      }
    }

    // profile best-effort (только по id)
    if (effectiveUserId && paidUntil) {
      try {
        await admin
          .from("profiles")
          .update({ paid_until: paidUntil, subscription_status: "active", updated_at: new Date().toISOString() } as any)
          .eq("id", effectiveUserId)
      } catch {}
    }
  }

  const res = NextResponse.json(
    {
      ok: true,
      orderReference,
      planId,
      status: normalized,
      paidUntil,
      keysUpdated,
      sigOk,
    },
    { status: 200 }
  )

  // set cookies
  res.cookies.set(LAST_ORDER_COOKIE, orderReference, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    domain,
  })

  if (needSetDeviceCookie) {
    res.cookies.set(DEVICE_COOKIE, deviceHash, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      domain,
    })
  }

  for (const c of pending) res.cookies.set(c.name, c.value, c.options)
  res.headers.set("cache-control", "no-store, max-age=0")
  return res
}
