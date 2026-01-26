import { NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

function env(name: string) {
  return String(process.env[name] || "").trim()
}

function hmacMd5HexUpper(str: string, key: string) {
  return crypto.createHmac("md5", key).update(str, "utf8").digest("hex").toUpperCase()
}

async function readBody(req: Request) {
  const ct = (req.headers.get("content-type") || "").toLowerCase()

  // JSON
  if (ct.includes("application/json")) {
    return await req.json().catch(() => ({}))
  }

  // text / form-urlencoded
  const txt = await req.text().catch(() => "")
  if (!txt) return {}

  // иногда может прилететь как JSON строкой
  try {
    return JSON.parse(txt)
  } catch {}

  // form-urlencoded
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
  const body: any = await readBody(req)

  const merchantAccount = String(pick(body, "merchantAccount") || env("WAYFORPAY_MERCHANT_ACCOUNT"))
  const orderReference = String(pick(body, "orderReference"))
  const amount = String(pick(body, "amount"))
  const currency = String(pick(body, "currency"))
  const authCode = String(pick(body, "authCode"))
  const cardPan = String(pick(body, "cardPan"))
  const transactionStatus = String(pick(body, "transactionStatus"))
  const reasonCode = String(pick(body, "reasonCode"))
  const theirSignature = String(pick(body, "merchantSignature"))

  const secretKey = env("WAYFORPAY_SECRET_KEY") || env("WAYFORPAY_MERCHANT_SECRET_KEY")

  if (!orderReference || !theirSignature || !secretKey) {
    return NextResponse.json(
      { ok: false, error: "Bad webhook payload", hasOrderReference: !!orderReference, hasSignature: !!theirSignature },
      { status: 400 }
    )
  }

  // Проверяем подпись входящего webhook
  // merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode
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

  const ourSignature = hmacMd5HexUpper(signString, secretKey)
  if (ourSignature !== String(theirSignature).toUpperCase()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid webhook signature",
        ourSignature,
        theirSignature,
      },
      { status: 400 }
    )
  }

  // Обновляем заказ в БД
  const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL")
  const SERVICE_ROLE = env("SUPABASE_SERVICE_ROLE_KEY")

  if (SUPABASE_URL && SERVICE_ROLE) {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const ordersTable = env("TA_ORDERS_TABLE") || "billing_orders"
    const norm = String(transactionStatus || "").toLowerCase()

    const status =
      norm === "approved"
        ? "paid"
        : norm === "refunded"
          ? "refunded"
          : norm === "declined"
            ? "failed"
            : norm || "unknown"

    // обновляем + сохраняем raw
    await supabase
      .from(ordersTable)
      .update({
        status,
        raw: JSON.stringify({ ...body, __event: "wayforpay_webhook" }),
        updated_at: new Date().toISOString(),
      })
      .eq("order_reference", orderReference)
  }

  // WayForPay ждёт accept-ответ
  // signature = HMAC_MD5(orderReference;status;time)
  const statusResp = "accept"
  const time = Math.floor(Date.now() / 1000).toString()
  const respSignString = [orderReference, statusResp, time].join(";")
  const signature = hmacMd5HexUpper(respSignString, secretKey)

  return NextResponse.json({
    orderReference,
    status: statusResp,
    time: Number(time),
    signature,
  })
}
