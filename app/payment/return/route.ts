import { NextResponse } from "next/server"

function buildRedirect(req: Request, orderReference: string | null) {
  const url = new URL(req.url)
  const target = new URL("/payment/result", url.origin)

  if (orderReference) target.searchParams.set("orderReference", orderReference)

  // 303 важно: после POST браузер выполнит GET на /payment/result
  const res = NextResponse.redirect(target, { status: 303 })
  res.headers.set("cache-control", "no-store, max-age=0")
  return res
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orderReference = url.searchParams.get("orderReference")
  return buildRedirect(req, orderReference)
}

export async function POST(req: Request) {
  // WayForPay часто шлёт POST form-data
  let orderReference: string | null = null

  try {
    const ct = req.headers.get("content-type") || ""
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const fd = await req.formData()
      orderReference =
        (fd.get("orderReference") as string | null) ||
        (fd.get("order_reference") as string | null) ||
        (fd.get("order") as string | null) ||
        null
    } else {
      // вдруг JSON
      const body: any = await req.json().catch(() => null)
      orderReference =
        body?.orderReference ||
        body?.order_reference ||
        body?.order ||
        null
    }
  } catch {
    // игнор
  }

  // если не нашли — попробуем хотя бы из query
  if (!orderReference) {
    const url = new URL(req.url)
    orderReference = url.searchParams.get("orderReference")
  }

  return buildRedirect(req, orderReference)
}
