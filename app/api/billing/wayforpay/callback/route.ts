import { NextResponse } from "next/server"
import crypto, { createHmac } from "crypto"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function hmacMd5HexUpper(str: string, key: string) {
  return createHmac("md5", key).update(str, "utf8").digest("hex").toUpperCase()
}

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_PROJECT_URL

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) return null

  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function addMonthsIso(months: number) {
  const d = new Date()
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  if (d.getDate() !== day) d.setDate(0)
  return d.toISOString()
}

function parsePlanIdFromOrderReference(orderReference: string) {
  // ожидаем ta_{planId}_{ts}_{rand}
  const m = String(orderReference || "").match(/^ta_([^_]+)_/)
  const plan = (m?.[1] || "monthly").toLowerCase()
  return plan || "monthly"
}

async function readBody(req: Request) {
  const ct = (req.headers.get("content-type") || "").toLowerCase()

  if (ct.includes("application/json")) {
    const j = await req.json().catch(() => null)
    return j && typeof j === "object" ? j : null
  }

  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    const fd = await req.formData().catch(() => null)
    if (!fd) return null
    const obj: any = {}
    fd.forEach((v, k) => {
      const value = typeof v === "string" ? v : String(v)
      if (obj[k] === undefined) obj[k] = value
      else if (Array.isArray(obj[k])) obj[k].push(value)
      else obj[k] = [obj[k], value]
    })
    return obj
  }

  const txt = await req.text().catch(() => "")
  if (!txt) return null
  return { rawText: txt }
}

export async function POST(req: Request) {
  const secret = String(process.env.WAYFORPAY_SECRET_KEY || process.env.WFP_SECRET_KEY || "").trim()
  const body = await readBody(req)

  console.log("[WFP CALLBACK] incoming:", body)

  const merchantAccount = String((body as any)?.merchantAccount || "")
  const orderReference = String((body as any)?.orderReference || "")
  const amountRaw = (body as any)?.amount
  const currency = String((body as any)?.currency || "")
  const authCode = String((body as any)?.authCode || "")
  const cardPan = String((body as any)?.cardPan || "")
  const transactionStatus = String((body as any)?.transactionStatus || "")
  const reasonCode = String((body as any)?.reasonCode || "")
  const incomingSignature = String((body as any)?.merchantSignature || "")

  const sb = getSupabaseAdmin()

  const planId = parsePlanIdFromOrderReference(orderReference)
  const nowIso = new Date().toISOString()

  // 1) проверка подписи
  let signatureOk = false
  if (secret && merchantAccount && orderReference) {
    const signString = [
      merchantAccount,
      orderReference,
      String(amountRaw ?? ""),
      currency,
      authCode,
      cardPan,
      transactionStatus,
      reasonCode,
    ].join(";")

    const expected = hmacMd5HexUpper(signString, secret)
    signatureOk = expected === String(incomingSignature || "").toUpperCase()
    console.log("[WFP CALLBACK] signature:", signatureOk ? "OK" : "BAD")
    if (!signatureOk) console.log("[WFP CALLBACK] expected vs incoming:", { expected, incoming: incomingSignature })
  } else {
    console.log("[WFP CALLBACK] signature check skipped: missing secret or required fields", {
      hasSecret: !!secret,
      hasMerchantAccount: !!merchantAccount,
      hasOrderReference: !!orderReference,
    })
  }

  // 2) нормализуем статус
  const tx = String(transactionStatus || "").trim()
  const finalStatus =
    tx === "Approved"
      ? "paid"
      : tx
        ? tx.toLowerCase()
        : "callback_received"

  const storedStatus = signatureOk ? finalStatus : secret ? "callback_signature_invalid" : "callback_secret_missing"

  // 3) upsert billing_orders
  if (sb && orderReference) {
    const amountNum = typeof amountRaw === "number" ? amountRaw : Number(amountRaw || 0) || null

    const up = await sb
      .from("billing_orders")
      .upsert(
        {
          order_reference: orderReference,
          plan_id: planId,
          amount: amountNum,
          currency: currency || "UAH",
          status: storedStatus,
          raw: body,
          updated_at: nowIso,
        } as any,
        { onConflict: "order_reference" }
      )

    if (up.error) {
      console.log("[WFP CALLBACK] billing_orders upsert error:", up.error)
    }
  }

  // 4) если Approved и подпись ок, выдаём доступ по device_hash из billing_orders
  if (sb && signatureOk && transactionStatus === "Approved" && orderReference) {
    try {
      const { data: ord, error: ordErr } = await sb
        .from("billing_orders")
        .select("device_hash,plan_id")
        .eq("order_reference", orderReference)
        .maybeSingle()

      if (ordErr) console.log("[WFP CALLBACK] billing_orders select error:", ordErr)

      const deviceHash = String((ord as any)?.device_hash || "")
      const effectivePlan = String((ord as any)?.plan_id || planId || "monthly").toLowerCase()

      if (!deviceHash) {
        console.log("[WFP CALLBACK] no device_hash for orderReference", orderReference)
      } else {
        const paidUntil = effectivePlan === "monthly" ? addMonthsIso(1) : addMonthsIso(1)

        const { data: existing } = await sb
          .from("access_grants")
          .select("id")
          .eq("device_hash", deviceHash)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if ((existing as any)?.id) {
          const upd = await sb
            .from("access_grants")
            .update({ paid_until: paidUntil, trial_questions_left: 0, updated_at: nowIso } as any)
            .eq("id", (existing as any).id)

          if (upd.error) console.log("[WFP CALLBACK] access_grants update error:", upd.error)
        } else {
          const ins = await sb.from("access_grants").insert({
            id: crypto.randomUUID(),
            user_id: null,
            device_hash: deviceHash,
            trial_questions_left: 0,
            paid_until: paidUntil,
            promo_until: null,
            created_at: nowIso,
            updated_at: nowIso,
          } as any)

          if (ins.error) console.log("[WFP CALLBACK] access_grants insert error:", ins.error)
        }

        console.log("[WFP CALLBACK] access_grants updated:", { deviceHash, paidUntil, planId: effectivePlan })
      }
    } catch (e: any) {
      console.log("[WFP CALLBACK] access_grants update failed:", String(e?.message || e))
    }
  }

  // 5) WayForPay ждёт accept-ответ
  const time = Math.floor(Date.now() / 1000)
  const status = "accept"
  const respString = `${orderReference};${status};${time}`
  const signature = secret ? hmacMd5HexUpper(respString, secret) : ""

  return NextResponse.json({
    orderReference,
    status,
    time,
    signature,
  })
}

export async function GET() {
  return NextResponse.json({ ok: true })
}
