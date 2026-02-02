import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { createHmac, randomUUID } from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const WFP_API = "https://api.wayforpay.com/api"
const DEVICE_COOKIE = "ta_device_hash"
const ACCOUNT_PREFIX = "account:"

function env(name: string) {
  return String(process.env[name] || "").trim()
}

function mustEnv(name: string) {
  const v = env(name)
  if (!v) throw new Error("Missing env " + name)
  return v
}

function hmacMd5(secret: string, msg: string) {
  return createHmac("md5", secret).update(msg).digest("hex")
}

function sbAdmin() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL")
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function noStore() {
  return { "cache-control": "no-store, max-age=0" }
}

function normalizeStatus(v: any) {
  return String(v || "").trim().toLowerCase()
}

function parseRaw(raw: any): any {
  if (!raw) return null
  try {
    let v: any = raw
    if (typeof v === "string") v = JSON.parse(v)
    if (typeof v === "string") v = JSON.parse(v)
    return v
  } catch {
    return null
  }
}

function toDateOrNull(v: any): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function planDays(planId: string) {
  const p = String(planId || "").toLowerCase()
  if (p.includes("year")) return 365
  return 30
}

function addDaysISO(fromISO: string, days: number) {
  const d = new Date(fromISO)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

function cookieDomainFromHost(host: string | null) {
  const h = String(host || "").toLowerCase()
  if (h === "turbotaai.com" || h.endsWith(".turbotaai.com")) return ".turbotaai.com"
  return undefined
}

async function wfpCheckStatus(orderReference: string) {
  const merchantAccount =
    env("WAYFORPAY_MERCHANT_ACCOUNT") || env("WFP_MERCHANT_ACCOUNT")
  const secret =
    env("WAYFORPAY_SECRET_KEY") || env("WFP_SECRET_KEY") ||
    env("WAYFORPAY_MERCHANT_SECRET_KEY") || env("WFP_MERCHANT_SECRET_KEY")

  if (!merchantAccount || !secret) return { ok: false, error: "WAYFORPAY_NOT_CONFIGURED" }

  const signString = [merchantAccount, orderReference].join(";")
  const merchantSignature = hmacMd5(secret, signString)

  const r = await fetch(WFP_API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      transactionType: "CHECK_STATUS",
      merchantAccount,
      orderReference,
      merchantSignature,
      apiVersion: 1,
    }),
    cache: "no-store",
  })

  const data = await r.json().catch(() => null as any)
  return { ok: r.ok, httpStatus: r.status, data }
}

/**
 * Robust grant extension: find existing row by device_hash, update by ID.
 * Falls back to insert if no row exists.
 */
async function extendGrantForDevice(admin: any, deviceHash: string, planId: string, userId: string | null) {
  if (!deviceHash) return null

  const now = new Date()
  const nowIso = now.toISOString()
  const days = planDays(planId)

  // Find existing grant by device_hash
  const { data: rows } = await admin
    .from("access_grants")
    .select("id,paid_until,user_id,device_hash")
    .eq("device_hash", deviceHash)
    .order("updated_at", { ascending: false })
    .limit(1)

  const existing = Array.isArray(rows) ? rows[0] : null

  const curPaid = toDateOrNull(existing?.paid_until)
  // IDEMPOTENT: target = now + days; skip if current >= target
  const target = new Date(now)
  target.setUTCDate(target.getUTCDate() + days)
  const nextIso = (curPaid && curPaid.getTime() >= target.getTime()) ? curPaid.toISOString() : target.toISOString()

  // Skip DB write if grant already has sufficient paid_until
  if (curPaid && curPaid.getTime() >= target.getTime() && existing?.id) {
    return nextIso
  }

  if (existing?.id) {
    // Update existing row by ID (most reliable)
    const patch: Record<string, any> = {
      paid_until: nextIso,
      trial_questions_left: 0,
      updated_at: nowIso,
    }
    if (userId && !existing.user_id) patch.user_id = userId

    await admin
      .from("access_grants")
      .update(patch as any)
      .eq("id", existing.id)
  } else {
    // No row exists — insert with all required fields
    await admin
      .from("access_grants")
      .insert({
        id: randomUUID(),
        device_hash: deviceHash,
        user_id: userId,
        paid_until: nextIso,
        promo_until: null,
        trial_questions_left: 0,
        created_at: nowIso,
        updated_at: nowIso,
      } as any)
  }

  return nextIso
}

async function handle(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const orderReference =
    (sp.get("orderReference") || sp.get("order_reference") || sp.get("order") || "").trim()

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "Missing orderReference" }, { status: 400, headers: noStore() })
  }

  const host = req.headers.get("host")
  const domain = cookieDomainFromHost(host)

  // Read current device cookie
  const jar = cookies()
  let currentDeviceHash = String(jar.get(DEVICE_COOKIE)?.value || "").trim()

  try {
    const admin = sbAdmin()
    const { data, error } = await admin
      .from("billing_orders")
      .select("order_reference,status,plan_id,amount,currency,device_hash,user_id,updated_at,raw")
      .eq("order_reference", orderReference)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: noStore() })
    }

    if (!data) {
      return NextResponse.json(
        { ok: true, found: false, orderReference, status: "not_found" },
        { status: 200, headers: noStore() }
      )
    }

    let status = normalizeStatus((data as any).status)
    let wfp: any = null

    // Self-healing: if order is pending/created, check WFP for real status
    if (status === "created" || status === "invoice_created" || status === "pending" || status === "processing") {
      wfp = await wfpCheckStatus(orderReference)

      const txStatus = wfp?.data?.transactionStatus || wfp?.data?.status || null
      const reasonCode = wfp?.data?.reasonCode || null

      const isPaid =
        txStatus === "Approved" ||
        txStatus === "approved" ||
        reasonCode === 1100 ||
        reasonCode === "1100"

      const isFailed =
        txStatus === "Declined" ||
        txStatus === "declined" ||
        txStatus === "Expired" ||
        txStatus === "expired" ||
        txStatus === "Refunded" ||
        txStatus === "refunded"

      if (isPaid) {
        status = "paid"
        await admin
          .from("billing_orders")
          .update({
            status: "paid",
            raw: { __event: "check_status_paid", wfp: wfp.data, prev: (data as any).status },
            updated_at: new Date().toISOString(),
          } as any)
          .eq("order_reference", orderReference)
      } else if (isFailed) {
        status = "failed"
        await admin
          .from("billing_orders")
          .update({
            status: "failed",
            raw: { __event: "check_status_failed", wfp: wfp.data, prev: (data as any).status },
            updated_at: new Date().toISOString(),
          } as any)
          .eq("order_reference", orderReference)
      }
    }

    // If paid, ensure access grants are extended
    let ensuredPaidUntil: string | null = null
    const orderDeviceHash = String((data as any).device_hash || "").trim()
    const orderUserId = String((data as any).user_id || "").trim() || null

    if (status === "paid") {
      const planId = String((data as any).plan_id || "monthly")

      // Extend grant for the order's device_hash (primary)
      if (orderDeviceHash) {
        ensuredPaidUntil = await extendGrantForDevice(admin, orderDeviceHash, planId, null)
      }

      // NOTE: Do NOT create grants for currentDeviceHash if it differs from orderDeviceHash.
      // The cookie will be set to orderDeviceHash below, avoiding orphan rows.

      // Extend for account key if user is logged in
      if (orderUserId) {
        const accountKey = `${ACCOUNT_PREFIX}${orderUserId}`
        const pu3 = await extendGrantForDevice(admin, accountKey, planId, orderUserId)
        if (pu3) {
          const a = toDateOrNull(ensuredPaidUntil)
          const b = toDateOrNull(pu3)
          if (a && b && b.getTime() > a.getTime()) ensuredPaidUntil = pu3
        }

        // Sync profiles metadata
        if (ensuredPaidUntil) {
          try {
            await admin
              .from("profiles")
              .update({
                paid_until: ensuredPaidUntil,
                subscription_status: "active",
                auto_renew: true,
                cancel_at_period_end: false,
                canceled_at: null,
                updated_at: new Date().toISOString(),
              } as any)
              .eq("id", orderUserId)
          } catch {}
        }
      }
    }

    const rawObj = parseRaw((data as any).raw)
    const transactionStatus = rawObj?.transactionStatus ?? rawObj?.transaction_status ?? null
    const reason = rawObj?.reason ?? rawObj?.message ?? null
    const reasonCode = rawObj?.reasonCode ?? rawObj?.reason_code ?? null

    const res = NextResponse.json(
      {
        ok: true,
        found: true,
        orderReference: (data as any).order_reference,
        planId: (data as any).plan_id ?? null,
        amount: (data as any).amount ?? null,
        currency: (data as any).currency ?? null,
        status,
        transactionStatus,
        reason,
        reasonCode,
        ensuredPaidUntil,
        updatedAt: (data as any).updated_at ?? null,
      },
      { status: 200, headers: noStore() }
    )

    // Set device cookie to match order's device_hash (ensures consistency)
    if (orderDeviceHash && status === "paid") {
      res.cookies.set(DEVICE_COOKIE, orderDeviceHash, {
        path: "/",
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
        domain,
      })
    }

    return res
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "status failed", details: String(e?.message || e) },
      { status: 500, headers: noStore() }
    )
  }
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
