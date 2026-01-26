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

function normalizeStatus(txStatus: string) {
  const s = (txStatus || "").toLowerCase()
  if (s === "approved") return "paid"
  if (s === "pending" || s === "inprocessing") return "processing"
  if (s === "refunded" || s === "voided" || s === "expired" || s === "declined") return "failed"
  return "unknown"
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

async function wayforpayCheckStatus(orderReference: string) {
  const merchantAccount = mustEnv("WAYFORPAY_MERCHANT_ACCOUNT")
  const secretKey = mustEnv("WAYFORPAY_SECRET_KEY")
  const apiUrl = pickEnv("WAYFORPAY_API_URL", "https://api.wayforpay.com/api")

  const signature = hmacMd5(`${merchantAccount};${orderReference}`, secretKey)

  const payload: any = {
    transactionType: "CHECK_STATUS",
    merchantAccount,
    orderReference,
    merchantSignature: signature,
    apiVersion: 1,
  }

  const r = await fetch(apiUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  const json = await r.json().catch(() => ({}))
  return { httpOk: r.ok, httpStatus: r.status, json }
}

async function upsertBillingOrder(orderReference: string, patch: any) {
  try {
    const sb = supabaseAdmin()
    await sb
      .from("billing_orders")
      .upsert(
        {
          order_reference: orderReference,
          ...patch,
        },
        { onConflict: "order_reference" }
      )
  } catch (e) {
    console.error("[sync] billing_orders upsert failed:", e)
  }
}

async function handler(req: NextRequest) {
  const url = new URL(req.url)

  const orderReference =
    (url.searchParams.get("orderReference") || "").trim() ||
    (req.cookies.get("ta_last_order")?.value || "").trim()

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "orderReference is required" }, { status: 400 })
  }

  const { httpOk, httpStatus, json } = await wayforpayCheckStatus(orderReference)

  const txStatus = String(json?.transactionStatus || json?.status || "").trim()
  const state = normalizeStatus(txStatus)

  await upsertBillingOrder(orderReference, {
    status: state,
    currency: json?.currency || null,
    amount: typeof json?.amount === "number" ? json.amount : Number(json?.amount || 0) || null,
    raw: json || null,
    updated_at: new Date().toISOString(),
  })

  return NextResponse.json(
    {
      ok: state === "paid",
      orderReference,
      state,
      transactionStatus: txStatus || null,
      httpOk,
      httpStatus,
      wayforpay: json || null,
    },
    { status: 200, headers: { "cache-control": "no-store" } }
  )
}

export async function GET(req: NextRequest) {
  return handler(req)
}

export async function POST(req: NextRequest) {
  return handler(req)
}
