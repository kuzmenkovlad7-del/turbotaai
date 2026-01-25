import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  let orderReference = req.nextUrl.searchParams.get("orderReference") ?? ""

  try {
    const ct = req.headers.get("content-type") ?? ""

    if (ct.includes("application/json")) {
      const body: any = await req.json().catch(() => null)
      if (body?.orderReference) orderReference = String(body.orderReference)
    } else {
      const form = await req.formData().catch(() => null)
      const v = form?.get("orderReference")
      if (v) orderReference = String(v)
    }
  } catch {}

  const url = req.nextUrl.clone()
  url.searchParams.set("orderReference", orderReference || "")
  return NextResponse.redirect(url, { status: 303 })
}
