import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * WayForPay serviceUrl callback:
 * Входящая подпись (merchantSignature) считается так:
 * merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode
 *
 * Ответ магазина ОБЯЗАТЕЛЬНО:
 * { orderReference, status:"accept", time, signature }
 * signature = HMAC_MD5(secretKey, "orderReference;status;time")
 */

function envFirst(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k]
    if (v && String(v).trim()) return String(v).trim()
  }
  return ""
}

const MERCHANT_SECRET_KEY = envFirst(
  "WAYFORPAY_MERCHANT_SECRET_KEY",
  "WAYFORPAY_SECRET_KEY",
  "WFP_SECRET_KEY",
  "MERCHANT_SECRET_KEY"
)

function hmacMd5(secret: string, str: string) {
  return crypto.createHmac("md5", secret).update(str, "utf8").digest("hex")
}

function s(v: any) {
  return v === undefined || v === null ? "" : String(v)
}

export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin()
  const nowIso = new Date().toISOString()

  let body: any = null
  try {
    body = await req.json()
  } catch {
    // даже если тело кривое — отвечаем accept, чтобы WayForPay не делал лишних действий
    return NextResponse.json({ status: "accept" }, { status: 200 })
  }

  const merchantAccount = s(body.merchantAccount).trim()
  const orderReference = s(body.orderReference).trim()
  const amount = s(body.amount).trim()
  const currency = s(body.currency).trim()
  const authCode = s(body.authCode).trim()
  const cardPan = s(body.cardPan).trim()
  const transactionStatus = s(body.transactionStatus).trim()
  const reasonCode = s(body.reasonCode || body.reason || "").trim()

  const incomingSignature = s(body.merchantSignature).trim().toLowerCase()

  // проверка подписи входящего callback
  let signatureOk = false
  if (MERCHANT_SECRET_KEY) {
    const signStr = [merchantAccount, orderReference, amount, currency, authCode, cardPan, transactionStatus, reasonCode].join(";")
    const expected = hmacMd5(MERCHANT_SECRET_KEY, signStr).toLowerCase()
    signatureOk = expected === incomingSignature
  }

  // статус в нашу БД
  let status = "pending"
  if (transactionStatus.toLowerCase() === "approved" || transactionStatus.toLowerCase() === "successful") status = "paid"
  if (transactionStatus.toLowerCase() === "declined") status = "failed"
  if (transactionStatus.toLowerCase() === "refunded") status = "refunded"

  // апдейт/инсерт заказа
  try {
    const { data: existing } = await admin
      .from("billing_orders")
      .select("order_reference")
      .eq("order_reference", orderReference)
      .limit(1)
      .maybeSingle()

    if (existing?.order_reference) {
      await admin
        .from("billing_orders")
        .update({
          status,
          raw: body,
          amount: Number(amount || 0) || null,
          currency: currency || null,
          updated_at: nowIso,
        } as any)
        .eq("order_reference", orderReference)
    } else {
      await admin.from("billing_orders").insert({
        order_reference: orderReference,
        status,
        raw: body,
        amount: Number(amount || 0) || null,
        currency: currency || null,
        created_at: nowIso,
        updated_at: nowIso,
      } as any)
    }
  } catch {
    // ничего
  }

  // ОТВЕТ WAYFORPAY: accept + signature(orderReference;status;time)
  const time = Math.floor(Date.now() / 1000)
  const respStatus = "accept"
  const respSignStr = `${orderReference};${respStatus};${time}`
  const respSignature = MERCHANT_SECRET_KEY ? hmacMd5(MERCHANT_SECRET_KEY, respSignStr) : ""

  return NextResponse.json(
    {
      orderReference,
      status: respStatus,
      time,
      signature: respSignature,
      // только для отладки (WayForPay это игнорит)
      debug: { signatureOk, transactionStatus, mappedStatus: status },
    },
    { status: 200 }
  )
}
