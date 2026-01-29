import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type BillingStatus = "paid" | "failed" | "processing"

function hmacMd5(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str, "utf8").digest("hex")
}

function safeLower(v: any) {
  return String(v || "").trim().toLowerCase()
}

function mapWayforpayStatus(txStatus?: string | null): BillingStatus {
  const s = safeLower(txStatus)
  if (["approved", "paid", "successful", "success"].includes(s)) return "paid"
  if (
    [
      "inprocessing",
      "processing",
      "pending",
      "created",
      "wait",
      "waiting",
      "hold",
      "auth",
      "authorized",
      "review",
    ].includes(s)
  ) return "processing"
  return "failed"
}

function normalizeDbStatus(s: any): BillingStatus {
  const v = safeLower(s)
  if (v === "paid") return "paid"
  if (v === "processing") return "processing"
  if (v === "created" || v === "invoice_created" || v === "pending") return "processing"
  return "failed"
}

function pickBestStatus(statuses: string[]): BillingStatus {
  const norm = statuses.map(normalizeDbStatus)
  if (norm.includes("paid")) return "paid"
  if (norm.includes("processing")) return "processing"
  return "failed"
}

function toDateOrNull(v: any) {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function isFutureIso(v: any) {
  const d = toDateOrNull(v)
  if (!d) return false
  return d.getTime() > Date.now()
}

function addDaysFrom(base: Date, days: number) {
  const x = new Date(base)
  x.setUTCDate(x.getUTCDate() + days)
  return x
}

function planDays(planId: string) {
  const p = safeLower(planId)
  if (p === "yearly" || p === "annual" || p === "year") return 365
  return 30
}

function parseMaybeJson(raw: any) {
  if (!raw) return null
  if (typeof raw === "object") return raw
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return null
}

async function calcNextPaidUntil(admin: any, opts: { userId?: string | null; deviceHash?: string | null; days: number }) {
  const now = new Date()
  const nowIso = now.toISOString()

  let base = now

  if (opts.userId) {
    const { data: p } = await admin
      .from("profiles")
      .select("paid_until")
      .eq("id", opts.userId)
      .maybeSingle()

    if (p?.paid_until && isFutureIso(p.paid_until)) {
      const d = toDateOrNull(p.paid_until)
      if (d) base = d
    }
  }

  if (opts.deviceHash) {
    const { data: g } = await admin
      .from("access_grants")
      .select("paid_until")
      .eq("device_hash", opts.deviceHash)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (g?.paid_until && isFutureIso(g.paid_until)) {
      const d = toDateOrNull(g.paid_until)
      if (d && d.getTime() > base.getTime()) base = d
    }
  }

  const nextIso = addDaysFrom(base, opts.days).toISOString()
  return { nextIso, nowIso }
}

async function activatePaid(admin: any, opts: { userId?: string | null; deviceHash?: string | null; days: number }) {
  const { nextIso, nowIso } = await calcNextPaidUntil(admin, opts)

  if (opts.userId) {
    const accountKey = `account:${opts.userId}`

    await admin
      .from("access_grants")
      .upsert(
        {
          user_id: opts.userId,
          device_hash: accountKey,
          trial_questions_left: 0,
          paid_until: nextIso,
          updated_at: nowIso,
          created_at: nowIso,
        } as any,
        { onConflict: "device_hash" }
      )

    await admin
      .from("profiles")
      .update({
        paid_until: nextIso,
        subscription_status: "active",
        auto_renew: true,
        updated_at: nowIso,
      } as any)
      .eq("id", opts.userId)
  }

  if (opts.deviceHash) {
    await admin
      .from("access_grants")
      .upsert(
        {
          user_id: null,
          device_hash: opts.deviceHash,
          trial_questions_left: 0,
          paid_until: nextIso,
          updated_at: nowIso,
          created_at: nowIso,
        } as any,
        { onConflict: "device_hash" }
      )
  }

  return nextIso
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const orderReference = url.searchParams.get("orderReference")?.trim() || ""

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "missing_orderReference" }, { status: 400 })
  }

  const merchantAccount =
    process.env.WAYFORPAY_MERCHANT_ACCOUNT ||
    process.env.WFP_MERCHANT_ACCOUNT ||
    ""

  const secretKey =
    process.env.WAYFORPAY_SECRET_KEY ||
    process.env.WFP_SECRET_KEY ||
    ""

  if (!merchantAccount || !secretKey) {
    return NextResponse.json({ ok: false, error: "missing_wayforpay_env" }, { status: 500 })
  }

  const signStr = `${merchantAccount};${orderReference}`
  const merchantSignature = hmacMd5(signStr, secretKey)

  const requestBody = {
    transactionType: "CHECK_STATUS",
    merchantAccount,
    orderReference,
    apiVersion: 1,
    merchantSignature,
  }

  let wfpJson: any = null
  try {
    const r = await fetch("https://api.wayforpay.com/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    })

    wfpJson = await r.json().catch(() => null)

    if (!r.ok || !wfpJson) {
      return NextResponse.json({ ok: false, error: "wayforpay_check_failed", httpStatus: r.status }, { status: 502 })
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "wayforpay_fetch_error", details: String(e?.message || e) }, { status: 502 })
  }

  const txStatus: string | null = wfpJson.transactionStatus || wfpJson.status || null
  if (!txStatus) {
    return NextResponse.json({ ok: false, error: "missing_transactionStatus" }, { status: 502 })
  }

  const nextStatus = mapWayforpayStatus(txStatus)
  const admin = getSupabaseAdmin()

  const existing = await admin
    .from("billing_orders")
    .select("status, raw, updated_at, user_id, device_hash, plan_id")
    .eq("order_reference", orderReference)
    .order("updated_at", { ascending: false })
    .limit(10)

  if (existing.error) {
    return NextResponse.json({ ok: false, error: "db_read_failed" }, { status: 500 })
  }

  const existingStatuses = (existing.data || []).map((r: any) => String(r.status || ""))
  const bestExisting = pickBestStatus(existingStatuses)

  if (bestExisting === "paid" && nextStatus !== "paid") {
    return NextResponse.json({
      ok: true,
      orderReference,
      status: "paid",
      protected: true,
      transactionStatus: txStatus,
    })
  }

  const latest = (existing.data?.[0] as any) || null
  const latestRaw = parseMaybeJson(latest?.raw) || {}
  const mergedRaw = {
    ...latestRaw,
    check: wfpJson,
    check_received_at: new Date().toISOString(),
  }

  await admin
    .from("billing_orders")
    .update({
      status: nextStatus,
      raw: mergedRaw,
      updated_at: new Date().toISOString(),
    })
    .eq("order_reference", orderReference)

  let activatedPaidUntil: string | null = null
  if (nextStatus === "paid") {
    const userId = String(latest?.user_id || "").trim() || null
    const deviceHash = String(latest?.device_hash || "").trim() || null
    const planId = String(latest?.plan_id || "monthly").trim() || "monthly"
    const days = planDays(planId)

    try {
      activatedPaidUntil = await activatePaid(admin, { userId, deviceHash, days })
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    orderReference,
    status: nextStatus,
    transactionStatus: txStatus,
    activatedPaidUntil,
  })
}
