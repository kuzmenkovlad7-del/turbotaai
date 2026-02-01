import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createHmac } from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function env(name: string) {
  return String(process.env[name] || "").trim()
}
function mustEnv(name: string) {
  const v = env(name)
  if (!v) throw new Error("Missing env " + name)
  return v
}

function hmacMd5Hex(str: string, key: string) {
  return createHmac("md5", key).update(str, "utf8").digest("hex")
}

function safeLower(v: any) {
  return String(v || "").trim().toLowerCase()
}

function mapTxToStatus(tx: string) {
  const s = safeLower(tx)
  if (s === "approved" || s === "paid" || s === "success" || s === "accept") return "paid"
  if (s === "refunded" || s === "voided" || s === "chargeback") return "refunded"
  if (s === "declined" || s === "expired" || s === "refused" || s === "rejected") return "failed"
  if (s === "pending" || s === "inprocessing" || s === "processing" || s === "created") return "pending"
  return s || "unknown"
}

function planDays(planId: string) {
  const p = safeLower(planId)
  if (p === "yearly" || p === "annual" || p === "year") return 365
  return 30
}

function toDateOrNull(v: any): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

async function extendPaidUntil(sb: any, key: string, days: number, userId: string | null) {
  const now = new Date()
  const nowIso = now.toISOString()

  // Find existing grant by device_hash
  const { data: rows } = await sb
    .from("access_grants")
    .select("id,paid_until,user_id")
    .eq("device_hash", key)
    .order("updated_at", { ascending: false })
    .limit(1)

  const existing = Array.isArray(rows) ? rows[0] : null
  const cur = toDateOrNull(existing?.paid_until)

  // IDEMPOTENT: target = now + days; only update if current < target
  const target = new Date(now)
  target.setUTCDate(target.getUTCDate() + days)
  const paid_until = (cur && cur.getTime() >= target.getTime()) ? cur.toISOString() : target.toISOString()

  // Skip DB write if grant already has sufficient paid_until
  if (cur && cur.getTime() >= target.getTime() && existing?.id) {
    return paid_until
  }

  if (existing?.id) {
    // Update existing row by ID (most reliable)
    const patch: Record<string, any> = {
      paid_until,
      trial_questions_left: 0,
      updated_at: nowIso,
    }
    if (userId && !existing.user_id) patch.user_id = userId
    await sb.from("access_grants").update(patch).eq("id", existing.id)
  } else {
    // No row exists — insert with all fields
    const { randomUUID } = await import("crypto")
    await sb.from("access_grants").insert({
      id: randomUUID(),
      device_hash: key,
      user_id: userId,
      paid_until,
      promo_until: null,
      trial_questions_left: 0,
      created_at: nowIso,
      updated_at: nowIso,
    } as any)
  }

  return paid_until
}

async function readBodyAny(req: NextRequest) {
  const ct = (req.headers.get("content-type") || "").toLowerCase()

  if (ct.includes("application/json")) {
    return await req.json().catch(() => ({}))
  }

  const text = await req.text().catch(() => "")
  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {}

  const params = new URLSearchParams(text)
  const obj: any = {}
  params.forEach((v, k) => {
    if (k.endsWith("[]")) {
      const kk = k.slice(0, -2)
      if (!Array.isArray(obj[kk])) obj[kk] = []
      obj[kk].push(v)
      return
    }
    if (obj[k] === undefined) obj[k] = v
    else if (Array.isArray(obj[k])) obj[k].push(v)
    else obj[k] = [obj[k], v]
  })
  return obj
}

function pick(body: any, key: string) {
  return body?.[key] ?? body?.[key.toUpperCase()] ?? ""
}

export async function POST(req: NextRequest) {
  try {
    const body: any = await readBodyAny(req)

    const merchantAccount = String(pick(body, "merchantAccount") || env("WAYFORPAY_MERCHANT_ACCOUNT")).trim()
    const orderReference = String(pick(body, "orderReference")).trim()
    const amount = String(pick(body, "amount")).trim()
    const currency = String(pick(body, "currency")).trim()
    const authCode = String(pick(body, "authCode")).trim()
    const cardPan = String(pick(body, "cardPan")).trim()
    const transactionStatus = String(pick(body, "transactionStatus")).trim()
    const reasonCode = String(pick(body, "reasonCode")).trim()
    const theirSignature = String(pick(body, "merchantSignature")).trim()

    if (!orderReference) {
      return NextResponse.json({ ok: false, error: "missing_orderReference" }, { status: 400 })
    }

    const secretKey = mustEnv("WAYFORPAY_SECRET_KEY")

    if (theirSignature) {
      const signString = [
        merchantAccount,
        orderReference,
        amount,
        currency,
        authCode,
        cardPan,
        transactionStatus,
        reasonCode,
      ].join(";")
      const our = hmacMd5Hex(signString, secretKey)

      if (our.toLowerCase() !== theirSignature.toLowerCase()) {
        return NextResponse.json(
          { ok: false, error: "invalid_signature", orderReference },
          { status: 400, headers: { "cache-control": "no-store" } }
        )
      }
    }

    const sb = createClient(mustEnv("NEXT_PUBLIC_SUPABASE_URL"), mustEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const ord = await sb
      .from("billing_orders")
      .select("plan_id, device_hash, user_id")
      .eq("order_reference", orderReference)
      .maybeSingle()

    const planId = String((ord.data as any)?.plan_id || "monthly")
    const deviceHash = String((ord.data as any)?.device_hash || "")
    const userId = String((ord.data as any)?.user_id || "").trim() || null

    const status = mapTxToStatus(transactionStatus)

    await sb
      .from("billing_orders")
      .update({
        status,
        raw: { ...body, __event: "wayforpay_callback" },
        updated_at: new Date().toISOString(),
      } as any)
      .eq("order_reference", orderReference)

    let paidUntil: string | null = null
    if (status === "paid") {
      const days = planDays(planId)

      if (deviceHash) {
        paidUntil = await extendPaidUntil(sb, deviceHash, days, null)
      }

      if (userId) {
        const accountKey = `account:${userId}`
        const pu2 = await extendPaidUntil(sb, accountKey, days, userId)

        const a = toDateOrNull(paidUntil)
        const b = toDateOrNull(pu2)
        paidUntil = a && b && b.getTime() > a.getTime() ? pu2 : (paidUntil || pu2)

        try {
          await sb
            .from("profiles")
            .update({
              paid_until: paidUntil,
              subscription_status: "active",
              auto_renew: true,
              updated_at: new Date().toISOString(),
            } as any)
            .eq("id", userId)
        } catch {}
      }
    }

    const respStatus = "accept"
    const time = Math.floor(Date.now() / 1000)
    const respSignString = [orderReference, respStatus, String(time)].join(";")
    const signature = hmacMd5Hex(respSignString, secretKey)

    return NextResponse.json(
      { orderReference, status: respStatus, time, signature, updated: true, paidUntil },
      { status: 200, headers: { "cache-control": "no-store" } }
    )
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "callback_failed", details: String(e?.message || e) },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}

export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200, headers: { "cache-control": "no-store" } })
}
