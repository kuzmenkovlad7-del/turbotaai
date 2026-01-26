import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function delCookie(res: NextResponse, name: string) {
  res.cookies.set(name, "", { path: "/", maxAge: 0, sameSite: "lax" })
  res.cookies.set(name, "", { path: "/", maxAge: 0, sameSite: "lax", domain: ".turbotaai.com" })
}

function clearAuthCookies(res: NextResponse) {
  delCookie(res, "ta_last_order")
  delCookie(res, "ta_device_hash")

  const all = cookies().getAll()
  for (const c of all) {
    if (c.name.startsWith("sb-")) delCookie(res, c.name)
  }

  // ВАЖНО: вычищаем storage (localStorage/sessionStorage), иначе Supabase остаётся залогинен
  res.headers.set('Clear-Site-Data', '"cache","cookies","storage"')
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const next = url.searchParams.get("next") || "/"

  const res = NextResponse.redirect(new URL(next, url.origin))
  clearAuthCookies(res)
  res.headers.set("cache-control", "no-store")
  return res
}

export async function POST(req: Request) {
  const url = new URL(req.url)

  let next = url.searchParams.get("next") || ""
  if (!next) {
    try {
      const body: any = await req.json()
      next = String(body?.next || "")
    } catch {}
  }
  if (!next) next = "/"

  const res = NextResponse.json({ ok: true, next }, { status: 200 })
  clearAuthCookies(res)
  res.headers.set("cache-control", "no-store")
  return res
}
