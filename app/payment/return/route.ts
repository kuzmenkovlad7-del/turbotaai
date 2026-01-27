import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

async function readAnyBody(req: NextRequest): Promise<any> {
  const ct = (req.headers.get("content-type") || "").toLowerCase()
  const text = await req.text()
  if (!text) return {}

  if (ct.includes("application/json")) {
    const j = safeJsonParse(text)
    return j ?? {}
  }

  if (ct.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(text)
    const out: any = {}
    for (const [k, v] of params.entries()) out[k] = v
    if (typeof out.response === "string") {
      const j = safeJsonParse(out.response)
      if (j) return j
    }
    if (typeof out.data === "string") {
      const j = safeJsonParse(out.data)
      if (j) return j
    }
    return out
  }

  const j = safeJsonParse(text)
  return j ?? { raw: text }
}

function redirectToResult(req: NextRequest, payload: any) {
  const orderReference =
    payload?.orderReference ||
    payload?.order_reference ||
    req.nextUrl.searchParams.get("orderReference") ||
    ""

  const status =
    payload?.transactionStatus ||
    payload?.status ||
    req.nextUrl.searchParams.get("status") ||
    ""

  const url = new URL("/payment/result", req.nextUrl.origin)
  if (orderReference) url.searchParams.set("orderReference", String(orderReference))
  if (status) url.searchParams.set("status", String(status))
  return NextResponse.redirect(url, 303)
}

export async function POST(req: NextRequest) {
  const payload = await readAnyBody(req)
  return redirectToResult(req, payload)
}

export async function GET(req: NextRequest) {
  return redirectToResult(req, null)
}
