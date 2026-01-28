import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function shouldClearCookie(name: string) {
  const n = name.toLowerCase()
  if (n.startsWith("sb-")) return true
  if (n.includes("supabase")) return true
  if (n.includes("auth-token")) return true
  if (n.includes("access-token")) return true
  if (n.includes("refresh-token")) return true
  return false
}

function clearAuthCookies(res: NextResponse) {
  const all = cookies().getAll()
  for (const c of all) {
    if (!shouldClearCookie(c.name)) continue

    res.cookies.set(c.name, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
  }
  res.headers.set("cache-control", "no-store, max-age=0")
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const next = url.searchParams.get("next") || "/pricing"

  const res = NextResponse.redirect(new URL(next, url.origin), 303)
  clearAuthCookies(res)
  return res
}

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true }, { status: 200 })
  clearAuthCookies(res)
  return res
}
