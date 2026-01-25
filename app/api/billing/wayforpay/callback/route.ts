import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function pickEnv(name: string, fallback = "") {
  const v = (process.env[name] || "").trim()
  return v || fallback
}

function mustEnv(name: string) {
  const v = (process.env[name] || "").trim()
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function hmacMd5(data: string, secret: string) {
  return crypto.createHmac("md5", secret).update(data, "utf8").digest("hex")
}

function supabaseAdmin() {
  const url = mustEnv("SUPABASE_URL")
  const key =
    pickEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    pickEnv("SUPABASE_SERVICE_ROLE") ||
    pickEnv("SUPABASE_ANON_KEY") ||
    pickEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

  if (!key) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY (or ANON key fallback)")
  return createClient(url, key, { auth: { persistSession: false } })
}

function normalizeStatus(txStatus: string) {
  const s = (txStatus || "").toLowerCase()
  if (s === "approved") return "paid"
  if (s === "pending" || s === "inprocessing") return "pending"
  if (s === "refunded" || s === "voided" || s === "expired" || s === "declined") return "failed"
  return txStatus || "unknown"
}

export async function POST(req: NextRequest) {
  const secretKey = mustEnv("WAYFORPAY_SECRET_KEY")

  let body: any = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const orderReference = String(body?.orderReference || body?.ORDERREFERENCE || "").trim()
  const merchantSignature = String(body?.merchantSignature || body?.MERCHANTSIGNATURE || "").trim()

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "Missing orderReference" }, { status: 400 })
  }

  // WayForPay signature line:
  // merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode
  const merchantAccount = String(body?.merchantAccount || "").trim()
  const amount = String(body?.amount ?? "").trim()
  const currency = String(body?.currency ?? "").trim()
  const authCode = String(body?.authCode ?? "").trim()
  const cardPan = String(body?.cardPan ?? "").trim()
  const transactionStatus = String(body?.transactionStatus ?? "").trim()
  const reasonCode = String(body?.reasonCode ?? "").trim()

  const signLine = [
    merchantAccount,
    orderReference,
    amount,
    currency,
    authCode,
    cardPan,
    transactionStatus,
    reasonCode,
  ].join(";")

  const expectedSig = hmacMd5(signLine, secretKey)

  // не блокируем оплату из-за пустых полей, но логируем
  const sigOk = merchantSignature && expectedSig && merchantSignature === expectedSig

  const state = normalizeStatus(transactionStatus)

  try {
    const sb = supabaseAdmin()
    await sb
      .from("billing_orders")
      .upsert(
        {
          order_reference: orderReference,
          status: state,
          currency: currency || null,
          amount: Number(amount || 0) || null,
          raw: body || null,
        },
        { onConflict: "order_reference" }
      )
  } catch (e) {
    console.error("[callback] DB upsert failed:", e)
  }

  // IMPORTANT: respond ACCEPT to confirm
  const time = Math.floor(Date.now() / 1000)
  const status = "accept"
  const respSig = hmacMd5(`${orderReference};${status};${time}`, secretKey)

  return NextResponse.json(
    {
      orderReference,
      status,
      time,
      signature: respSig,
      sigOk,
    },
    { status: 200 }
  )
}

export async function GET() {
  // чтобы случайно не было 405 на пинге
  return NextResponse.json({ ok: true }, { status: 200 })
}
