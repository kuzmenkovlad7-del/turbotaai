import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { makeServiceWebhookSignature, makeServiceResponseSignature } from "@/lib/wayforpay"

export const runtime = "nodejs"

function normalizeStr(x: any) {
  return String(x ?? "").trim()
}

async function readPayload(req: Request) {
  const ct = req.headers.get("content-type") || ""
  try {
    if (ct.includes("application/json")) {
      return await req.json()
    }

    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const fd = await req.formData()
      const obj: Record<string, string> = {}

      // ✅ Никаких iterators / entries() / spread — чтобы TS не падал на Vercel
      fd.forEach((v, k) => {
        if (typeof v === "string") obj[k] = v
        else obj[k] = v?.name ? String(v.name) : String(v)
      })

      return obj
    }

    return await req.json().catch(() => ({}))
  } catch {
    return {}
  }
}

export async function POST(req: Request) {
  const payload = await readPayload(req)

  const secret = process.env.WAYFORPAY_SECRET_KEY || ""
  if (!secret) {
    console.error("WAYFORPAY_SECRET_KEY missing")
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 })
  }

  const orderReference = normalizeStr(payload?.orderReference)
  if (!orderReference) {
    console.error("WayForPay webhook: missing orderReference", payload)
    return NextResponse.json({ ok: false, error: "Bad payload" }, { status: 400 })
  }

  const got = normalizeStr(payload?.merchantSignature).toLowerCase()
  const expected = makeServiceWebhookSignature(secret, payload).toLowerCase()

  if (!got || got !== expected) {
    console.error("WayForPay webhook: INVALID SIGNATURE", {
      orderReference,
      got,
      expected,
      payload,
    })
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 })
  }

  const transactionStatus = normalizeStr(payload?.transactionStatus)
  const isApproved = transactionStatus.toLowerCase() === "approved"

  // 1) Обновляем billing_orders по order_reference
  try {
    await supabaseAdmin
      .from("billing_orders")
      .update({
        status: isApproved ? "approved" : (transactionStatus || "unknown"),
        raw: payload,
      })
      .eq("order_reference", orderReference)
  } catch (e) {
    console.error("WayForPay webhook: billing_orders update failed", e)
  }

  // 2) (опционально) выдаём доступ через access_grants
  if (isApproved) {
    try {
      const { data: orderRow } = await supabaseAdmin
        .from("billing_orders")
        .select("user_id, device_hash, plan_id")
        .eq("order_reference", orderReference)
        .maybeSingle()

      if (orderRow?.user_id) {
        await supabaseAdmin.from("access_grants").insert({
          user_id: orderRow.user_id,
          device_hash: orderRow.device_hash ?? null,
          plan_id: orderRow.plan_id ?? null,
        })
      }
    } catch (e) {
      console.error("WayForPay webhook: access_grants insert skipped/failed", e)
    }
  }

  // WayForPay ждёт ответ accept + signature(orderReference;status;time)
  const status = "accept"
  const time = Math.floor(Date.now() / 1000)
  const signature = makeServiceResponseSignature(secret, orderReference, status, time)

  return NextResponse.json({ orderReference, status, time, signature })
}
