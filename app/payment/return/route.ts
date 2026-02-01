import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

async function readAnyBody(req: NextRequest): Promise<any> {
  const ct = (req.headers.get("content-type") || "").toLowerCase()

  if (ct.includes("application/json")) {
    try {
      return await req.json()
    } catch {
      return {}
    }
  }

  const text = await req.text()

  const j = safeJsonParse(text)
  if (j) return j

  const params = new URLSearchParams(text)
  const out: any = {}
  params.forEach((v, k) => {
    out[k] = v
  })

  if (typeof out.response === "string") {
    const jr = safeJsonParse(out.response)
    if (jr) return jr
  }

  return out
}

async function triggerSync(origin: string, orderReference: string) {
  // Try sync endpoint (GET with orderReference param)
  try {
    const url = new URL("/api/billing/wayforpay/sync", origin)
    url.searchParams.set("orderReference", orderReference)
    const r = await fetch(url.toString(), { method: "GET", cache: "no-store" })
    console.log("[PAYMENT RETURN] sync GET status:", r.status)
    return
  } catch (e: any) {
    console.log("[PAYMENT RETURN] sync GET failed:", String(e?.message || e))
  }

  // Fallback: orders/status (also does self-healing)
  try {
    const url = new URL("/api/billing/orders/status", origin)
    url.searchParams.set("orderReference", orderReference)
    const r = await fetch(url.toString(), { method: "GET", cache: "no-store" })
    console.log("[PAYMENT RETURN] orders/status GET status:", r.status)
  } catch (e: any) {
    console.log("[PAYMENT RETURN] orders/status GET failed:", String(e?.message || e))
  }
}

function redirectToResult(req: NextRequest, payload: any) {
  const origin = req.nextUrl.origin

  const q = req.nextUrl.searchParams
  const orderReference =
    String(
      q.get("orderReference") ||
      payload?.orderReference ||
      payload?.order_reference ||
      payload?.invoice?.orderReference ||
      ""
    ) || ""

  const status =
    String(q.get("status") || payload?.transactionStatus || payload?.status || "") || ""

  console.log("[PAYMENT RETURN] incoming:", { orderReference, status })

  const url = new URL("/payment/result", origin)
  if (orderReference) url.searchParams.set("orderReference", orderReference)
  if (status) url.searchParams.set("status", status)

  // запускаем проверку статуса (не ломает редирект)
  if (orderReference) {
    triggerSync(origin, orderReference).catch(() => {})
  }

  return NextResponse.redirect(url, 303)
}

export async function POST(req: NextRequest) {
  const payload = await readAnyBody(req)
  return redirectToResult(req, payload)
}

export async function GET(req: NextRequest) {
  return redirectToResult(req, null)
}
