import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function mapWfpStatus(transactionStatus?: string) {
  const s = (transactionStatus || "").toLowerCase()
  if (s === "approved") return "paid"
  if (s === "declined") return "failed"
  if (s === "expired") return "expired"
  if (s === "refunded") return "refunded"
  if (s === "inprocessing" || s === "pending") return "pending"
  return s || "unknown"
}

async function readBodySmart(req: Request): Promise<any> {
  const ct = (req.headers.get("content-type") || "").toLowerCase()

  // 1) JSON
  if (ct.includes("application/json")) {
    try {
      return await req.json()
    } catch {
      return {}
    }
  }

  // 2) multipart/form-data (без итераторов)
  if (ct.includes("multipart/form-data")) {
    try {
      const fd = await req.formData()
      const obj: Record<string, string> = {}
      fd.forEach((v, k) => {
        obj[k] = String(v)
      })

      // Частый кейс: JSON лежит внутри одного поля
      const keys = Object.keys(obj)
      if (keys.length === 1) {
        const onlyKey = keys[0]
        const onlyVal = obj[onlyKey]

        if (onlyKey.trim().startsWith("{")) {
          try { return JSON.parse(onlyKey) } catch {}
        }
        if ((onlyVal || "").trim().startsWith("{")) {
          try { return JSON.parse(onlyVal) } catch {}
        }
      }

      for (const k of ["payment", "data", "payload", "json"]) {
        const v = obj[k]
        if ((v || "").trim().startsWith("{")) {
          try { return JSON.parse(v) } catch {}
        }
      }

      return obj
    } catch {
      return {}
    }
  }

  // 3) x-www-form-urlencoded / text fallback
  let raw = ""
  try {
    raw = await req.text()
  } catch {
    return {}
  }

  const text = (raw || "").trim()
  if (!text) return {}

  // Иногда WayForPay присылает JSON строкой даже без JSON content-type
  if (text.startsWith("{")) {
    try {
      return JSON.parse(text)
    } catch {}
  }

  // URL encoded
  try {
    const params = new URLSearchParams(text)
    const obj = Object.fromEntries(params.entries()) as Record<string, string>

    // ВАЖНО: твой кейс из логов — JSON пришёл как "ключ" и пустое значение
    const keys = Object.keys(obj)
    if (keys.length === 1) {
      const onlyKey = keys[0]
      const onlyVal = obj[onlyKey]

      if (onlyKey.trim().startsWith("{")) {
        try { return JSON.parse(onlyKey) } catch {}
      }
      if ((onlyVal || "").trim().startsWith("{")) {
        try { return JSON.parse(onlyVal) } catch {}
      }
    }

    for (const k of ["payment", "data", "payload", "json"]) {
      const v = obj[k]
      if ((v || "").trim().startsWith("{")) {
        try { return JSON.parse(v) } catch {}
      }
    }

    return obj
  } catch {
    return { raw: text }
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "wayforpay-webhook" })
}

export async function POST(req: Request) {
  const payload = await readBodySmart(req)

  const orderReference =
    payload?.orderReference ||
    payload?.order_reference ||
    payload?.orderref ||
    ""

  const transactionStatus =
    payload?.transactionStatus ||
    payload?.transaction_status ||
    ""

  const amount = payload?.amount
  const currency = payload?.currency
  const reason = payload?.reason
  const reasonCode = payload?.reasonCode

  console.log("✅ WFP webhook in:", {
    orderReference,
    transactionStatus,
    reason,
    reasonCode,
    amount,
    currency,
  })

  // ВАЖНО: чтобы WayForPay не ретраил бесконечно — лучше отвечать 200 даже на кривой payload
  if (!orderReference) {
    console.error("❌ Missing orderReference in webhook payload", payload)
    return NextResponse.json({ ok: false, error: "missing orderReference" }, { status: 200 })
  }

  const newStatus = mapWfpStatus(transactionStatus)

  const { error: updErr } = await supabaseAdmin
    .from("billing_orders")
    .update({
      status: newStatus,
      raw: payload,
      updated_at: new Date().toISOString(),
    })
    .eq("order_reference", orderReference)

  if (updErr) {
    console.error("❌ Supabase update failed:", updErr)
    return NextResponse.json({ ok: false, error: "supabase update failed" }, { status: 200 })
  }

  console.log("✅ Billing order updated:", { orderReference, status: newStatus })
  return NextResponse.json({ ok: true })
}
