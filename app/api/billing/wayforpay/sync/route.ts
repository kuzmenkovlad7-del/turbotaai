import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { cookies } from "next/headers"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const DEVICE_COOKIE = "turbotaai_device"

function hmacMd5(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str).digest("hex")
}

function envAny(...keys: string[]) {
  for (const k of keys) {
    const v = String(process.env[k] || "").trim()
    if (v) return v
  }
  return ""
}

function getDeviceFromCookie() {
  const jar = cookies()
  return String(jar.get(DEVICE_COOKIE)?.value || "").trim()
}

function setDeviceCookie(res: NextResponse, deviceHash: string) {
  res.cookies.set(DEVICE_COOKIE, deviceHash, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  })
}

function toDateOrNull(v: any) {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

async function extendDeviceGrant(admin: any, deviceHash: string, days: number) {
  const now = new Date()
  const nowIso = now.toISOString()

  const { data: existing } = await admin
    .from("access_grants")
    .select("id, paid_until")
    .eq("device_hash", deviceHash)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const currentPaid = toDateOrNull(existing?.paid_until)
  const base = currentPaid && currentPaid.getTime() > now.getTime() ? currentPaid : now
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString()

  if (existing?.id) {
    await admin
      .from("access_grants")
      .update({ paid_until: next, trial_questions_left: 0, updated_at: nowIso })
      .eq("id", existing.id)
  } else {
    await admin.from("access_grants").insert({
      id: crypto.randomUUID(),
      user_id: null,
      device_hash: deviceHash,
      trial_questions_left: 0,
      paid_until: next,
      promo_until: null,
      created_at: nowIso,
      updated_at: nowIso,
    } as any)
  }

  return next
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as any
  const orderReference = String(body?.orderReference ?? "").trim()

  if (!orderReference) {
    return NextResponse.json({ ok: false, message: "orderReference is required" }, { status: 200 })
  }

  const merchantAccount = envAny("WAYFORPAY_MERCHANT_ACCOUNT", "WFP_MERCHANT_ACCOUNT")
  const secretKey = envAny("WAYFORPAY_SECRET_KEY", "WFP_SECRET_KEY")

  if (!merchantAccount || !secretKey) {
    return NextResponse.json({ ok: false, message: "WayForPay env is missing" }, { status: 200 })
  }

  const signStr = [merchantAccount, orderReference].join(";")
  const merchantSignature = hmacMd5(signStr, secretKey)

  const wfpBody = {
    transactionType: "CHECK_STATUS",
    merchantAccount,
    orderReference,
    merchantSignature,
    apiVersion: 1,
  }

  const r = await fetch("https://api.wayforpay.com/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(wfpBody),
    cache: "no-store",
  }).catch(() => null)

  const json: any = await r?.json().catch(() => null)
  const status = String(json?.transactionStatus ?? json?.status ?? "").trim()

  if (!status) {
    return NextResponse.json({ ok: false, message: "No status from WayForPay", debug: json ?? null }, { status: 200 })
  }

  // ✅ Только Approved активирует доступ
  if (String(status || "").toLowerCase() === "approved") {
    const admin = getSupabaseAdmin()
    const nowIso = new Date().toISOString()

    // пытаемся взять deviceHash из billing_orders.raw (самое надежное)
    let deviceHash = ""

    try {
      const { data: rows } = await admin
        .from("billing_orders")
        .select("raw, user_id")
        .eq("order_reference", orderReference)
        .order("updated_at", { ascending: false })
        .limit(1)

      const row: any = (rows || [])[0]
      deviceHash = String(row?.raw?.deviceHash || "").trim()
    } catch {}

    if (!deviceHash) deviceHash = getDeviceFromCookie()
    if (!deviceHash) deviceHash = crypto.randomUUID()

    const paidUntil = await extendDeviceGrant(admin, deviceHash, 30)

    // обновляем billing_orders статус
    try {
      await admin
        .from("billing_orders")
        .update({
          status: "paid",
          raw: { sync_status: json, paidUntil, last_event: "sync", updated_at: nowIso },
          updated_at: nowIso,
        } as any)
        .eq("order_reference", orderReference)
    } catch {}

    const res = NextResponse.json({ ok: true, status, paid_until: paidUntil, device_hash: deviceHash }, { status: 200 })

    // ✅ ВАЖНО: ставим правильную cookie, иначе summary не увидит доступ
    setDeviceCookie(res, deviceHash)

    return res
  }

  return NextResponse.json({ ok: false, status, message: `Статус: ${status}` }, { status: 200 })
}
