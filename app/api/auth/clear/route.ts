import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function delCookie(res: NextResponse, name: string) {
  res.cookies.set(name, "", { path: "/", maxAge: 0, sameSite: "lax" })
  res.cookies.set(name, "", { path: "/", maxAge: 0, sameSite: "lax", domain: ".turbotaai.com" })
}

function clearAll(res: NextResponse) {
  // наши cookies
  delCookie(res, "ta_last_order")
  delCookie(res, "ta_last_order_ref")
  delCookie(res, "ta_device_hash")
  delCookie(res, "turbotaai_device")

  // supabase cookies (sb-*)
  const all = cookies().getAll()
  for (const c of all) {
    if (c.name.startsWith("sb-")) delCookie(res, c.name)
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const next = url.searchParams.get("next") || "/"

  const res = NextResponse.redirect(new URL(next, url.origin))
  clearAll(res)
  return res
}

export async function POST() {
  const res = NextResponse.json({ ok: true }, { status: 200 })
  clearAll(res)
  return res
}
