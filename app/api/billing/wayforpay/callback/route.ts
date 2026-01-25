import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"

function mustEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function getAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE

  if (!url || !key) throw new Error("Missing Supabase admin env")

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function hmacMd5(str: string, secret: string) {
  return crypto.createHmac("md5", secret).update(str, "utf8").digest("hex")
}

export async function POST(req: NextRequest) {
  const secretKey =
    process.env.WAYFORPAY_SECRET_KEY ||
    process.env.WFP_SECRET_KEY ||
    process.env.WAYFORPAY_SECRET

  if (!secretKey) {
    return NextResponse.json({ ok: false, error: "Missing WAYFORPAY_SECRET_KEY" }, { status: 500 })
  }

  let payload: any = null

  try {
    const ct = req.headers.get("content-type") ?? ""
    if (ct.includes("application/json")) {
      payload = await req.json()
    } else {
      const form = await req.formData()
      payload = Object.fromEntries(form.entries())
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Bad payload" }, { status: 400 })
  }

  const merchantAccount = String(payload?.merchantAccount ?? "")
  const orderReference = String(payload?.orderReference ?? "")
  const amount = String(payload?.amount ?? "")
  const currency = String(payload?.currency ?? "")
  const authCode = String(payload?.authCode ?? "")
  const cardPan = String(payload?.cardPan ?? "")
  const transactionStatus = String(payload?.transactionStatus ?? "")
  const reasonCode = String(payload?.reasonCode ?? "")
  const sig = String(payload?.merchantSignature ?? "")

  if (!orderReference) {
    return NextResponse.json({ ok: false, error: "orderReference required" }, { status: 400 })
  }

  // Signature for serviceUrl:
  // merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode  (HMAC_MD5)
  const signStr = [merchantAccount, orderReference, amount, currency, authCode, cardPan, transactionStatus, reasonCode].join(";")
  const expected = hmacMd5(signStr, secretKey)

  if (!sig || expected !== sig) {
    return NextResponse.json({ ok: false, error: "Bad signature" }, { status: 400 })
  }

  // Update DB best-effort
  try {
    const admin = getAdmin()

    await admin
      .from("payment_orders")
      .update({
        status: transactionStatus.toLowerCase(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq("order_reference", orderReference)

    if (transactionStatus === "Approved") {
      // extend paid_until for device or user linked to this order
      const { data: po } = await admin
        .from("payment_orders")
        .select("device_hash,user_id,plan_id")
        .eq("order_reference", orderReference)
        .maybeSingle()

      const deviceHash = (po as any)?.device_hash ?? null
      const userId = (po as any)?.user_id ?? null

      const now = new Date()
      const addDays = 30
      const addMs = addDays * 24 * 60 * 60 * 1000

      let grantQuery = admin.from("grants").select("id,paid_until").limit(1)

      if (userId) grantQuery = grantQuery.eq("user_id", userId)
      else if (deviceHash) grantQuery = grantQuery.eq("device_hash", deviceHash)
      else grantQuery = grantQuery.eq("order_reference", orderReference) as any

      const { data: g } = await grantQuery.maybeSingle()

      if ((g as any)?.id) {
        const cur = (g as any)?.paid_until ? new Date((g as any).paid_until) : null
        const base = cur && cur.getTime() > now.getTime() ? cur : now
        const nextPaid = new Date(base.getTime() + addMs).toISOString()

        await admin
          .from("grants")
          .update({ paid_until: nextPaid, updated_at: new Date().toISOString() } as any)
          .eq("id", (g as any).id)
      }
    }
  } catch (e) {
    console.error("wayforpay callback db update failed", e)
  }

  // Merchant must respond with accept:
  // signature = HMAC_MD5(orderReference;status;time)
  const time = Math.floor(Date.now() / 1000)
  const status = "accept"
  const acceptSig = hmacMd5([orderReference, status, String(time)].join(";"), secretKey)

  return NextResponse.json({
    orderReference,
    status,
    time,
    signature: acceptSig,
  })
}
