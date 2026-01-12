import { NextRequest, NextResponse } from "next/server"
import { verifyCallbackSignature, signAcceptResponse } from "@/lib/wayforpay"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function addMonths(d: Date, months: number) {
  const x = new Date(d)
  x.setMonth(x.getMonth() + months)
  return x
}

function planMonths(planId: string) {
  if (planId === "yearly") return 12
  if (planId === "monthly") return 1
  return 1
}

export async function POST(req: NextRequest) {
  const secret = String(process.env.WAYFORPAY_SECRET_KEY || "").trim()
  const merchantAccount = String(process.env.WAYFORPAY_MERCHANT_ACCOUNT || "").trim()

  if (!secret || !merchantAccount || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))

  const orderReference = String(body?.orderReference || "").trim()
  const amount = String(body?.amount || "").trim()
  const currency = String(body?.currency || "").trim()
  const authCode = String(body?.authCode || "").trim()
  const cardPan = String(body?.cardPan || "").trim()
  const transactionStatus = String(body?.transactionStatus || "").trim()
  const reasonCode = String(body?.reasonCode || body?.reason || "").trim()
  const merchantSignature = String(body?.merchantSignature || "").trim()

  // verify signature
  const okSig = verifyCallbackSignature({
    secret,
    merchantAccount: String(body?.merchantAccount || merchantAccount).trim(),
    orderReference,
    amount,
    currency,
    authCode,
    cardPan,
    transactionStatus,
    reasonCode,
    merchantSignature,
  })

  if (!okSig || !orderReference) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  const ord = await supabase
    .from("billing_orders")
    .select("order_reference,status,plan_id,user_id,device_hash")
    .eq("order_reference", orderReference)
    .maybeSingle()

  const status = transactionStatus.toLowerCase() === "approved" ? "approved" : "declined"

  await supabase
    .from("billing_orders")
    .update({ status, updated_at: new Date().toISOString(), raw: body })
    .eq("order_reference", orderReference)

  // grant subscription only if approved
  if (status === "approved") {
    const months = planMonths(ord.data?.plan_id || "monthly")
    const userId = ord.data?.user_id as string | null
    const deviceHash = ord.data?.device_hash as string | null

    // ensure grant row
    if (userId) {
      await supabase.from("access_grants").upsert({ user_id: userId, trial_questions_left: 5 }, { onConflict: "user_id" })
      const { data } = await supabase.from("access_grants").select("paid_until").eq("user_id", userId).maybeSingle()
      const base = data?.paid_until && new Date(data.paid_until).getTime() > Date.now() ? new Date(data.paid_until) : new Date()
      const paidUntil = addMonths(base, months).toISOString()
      await supabase.from("access_grants").update({ paid_until: paidUntil, updated_at: new Date().toISOString() }).eq("user_id", userId)
    } else if (deviceHash) {
      await supabase.from("access_grants").upsert({ device_hash: deviceHash, trial_questions_left: 5 }, { onConflict: "device_hash" })
      const { data } = await supabase.from("access_grants").select("paid_until").eq("device_hash", deviceHash).maybeSingle()
      const base = data?.paid_until && new Date(data.paid_until).getTime() > Date.now() ? new Date(data.paid_until) : new Date()
      const paidUntil = addMonths(base, months).toISOString()
      await supabase.from("access_grants").update({ paid_until: paidUntil, updated_at: new Date().toISOString() }).eq("device_hash", deviceHash)
    }
  }

  // accept response required by WayForPay
  const time = Math.floor(Date.now() / 1000)
  const acceptStatus = "accept"
  const signature = signAcceptResponse({ secret, orderReference, status: acceptStatus, time })

  return NextResponse.json({ orderReference, status: acceptStatus, time, signature })
}
