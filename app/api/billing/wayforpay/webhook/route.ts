import { NextResponse } from "next/server"
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

  let base = now

  const existing = await sb.from("access_grants").select("paid_until").eq("device_hash", key).maybeSingle()
  const cur = toDateOrNull(existing?.data?.paid_until)
  if (cur && cur.getTime() > base.getTime()) base = cur

  if (userId) {
    const p = await sb.from("profiles").select("paid_until").eq("id", userId).maybeSingle()
    const pu = toDateOrNull(p?.data?.paid_until)
    if (pu && pu.getTime() > base.getTime()) base = pu
  }

  const next = new Date(base)
  next.setUTCDate(next.getUTCDate() + days)
  const paid_until = next.toISOString()

  const payload: any = {
    device_hash: key,
    paid_until,
    trial_questions_left: 0,
    updated_at: nowIso,
  }
  if (userId) payload.user_id = userId

  await sb.from("access_grants").upsert(payload, { onConflict: "device_hash" })
  return paid_until
}

async function readBody(req: Request) {
  const ct = (req.headers.get("content-type") || "").toLowerCase()
  if (ct.includes("application/json")) return await req.json().catch(() => ({}))
  const txt = await req.text().catch(() => "")
  if (!txt) return {}
  try {
    return JSON.parse(txt)
  } catch {}
  const params = new URLSearchParams(txt)
  const obj: any = {}
  params.forEach((value, key) => {
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2)
      if (!Array.isArray(obj[k])) obj[k] = []
      obj[k].push(value)
      return
    }
    if (obj[key] === undefined) obj[key] = value
    else if (Array.isArray(obj[key])) obj[key].push(value)
    else obj[key] = [obj[key], value]
  })
  return obj
}
function pick(body: any, key: string) {
  return body?.[key] ?? body?.[key.toUpperCase()] ?? ""
}

export async function POST(req: Request) {
  try {
    const body: any = await readBody(req)

    const merchantAccount = String(pick(body, "merchantAccount") || env("WAYFORPAY_MERCHANT_ACCOUNT")).trim()
    const orderReference = String(pick(body, "orderReference")).trim()
    const amount = String(pick(body, "amount")).trim()
    const currency = String(pick(body, "currency")).trim()
    const authCode = String(pick(body, "authCode")).trim()
    const cardPan = String(pick(body, "cardPan")).trim()
    const transactionStatus = String(pick(body, "transactionStatus")).trim()
    const reasonCode = String(pick(body, "reasonCode")).trim()
    const theirSignature = String(pick(body, "merchantSignature")).trim()

    if (!orderReference || !theirSignature) {
      return NextResponse.json({ ok: false, error: "bad_payload" }, { status: 400 })
    }

    const secretKey = mustEnv("WAYFORPAY_SECRET_KEY")

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

    const ourSignature = hmacMd5Hex(signString, secretKey)
    if (ourSignature.toLowerCase() !== theirSignature.toLowerCase()) {
      return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 400 })
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
        raw: { ...body, __event: "wayforpay_webhook" },
        updated_at: new Date().toISOString(),
      } as any)
      .eq("order_reference", orderReference)

    let paidUntil: string | null = null
    if (status === "paid") {
      const days = planDays(planId)

      if (deviceHash) paidUntil = await extendPaidUntil(sb, deviceHash, days, null)

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

    return NextResponse.json({ orderReference, status: respStatus, time, signature, updated: true, paidUntil })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "webhook_failed", details: String(e?.message || e) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 })
}
