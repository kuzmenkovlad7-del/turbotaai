import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function fromUrl(req: NextRequest) {
  const url = new URL(req.url)
  return (
    url.searchParams.get("orderReference") ||
    url.searchParams.get("order_reference") ||
    ""
  )
}

async function fromBody(req: NextRequest) {
  const ct = req.headers.get("content-type") || ""
  try {
    if (ct.includes("application/json")) {
      const j: any = await req.json()
      return j?.orderReference || j?.order_reference || ""
    }
    const fd = await req.formData()
    return (
      (fd.get("orderReference") as string) ||
      (fd.get("order_reference") as string) ||
      ""
    )
  } catch {
    return ""
  }
}

async function handle(req: NextRequest) {
  let ref = fromUrl(req)
  if (!ref && req.method !== "GET") ref = await fromBody(req)

  const target = ref
    ? `/payment/result?orderReference=${encodeURIComponent(ref)}`
    : "/subscription"

  const res = NextResponse.redirect(new URL(target, req.url), 302)
  res.headers.set("cache-control", "no-store, max-age=0")
  return res
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
