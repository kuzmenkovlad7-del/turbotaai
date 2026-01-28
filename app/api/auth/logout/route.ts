import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function shouldClearCookie(name: string) {
  const n = name.toLowerCase()

  // Supabase / auth-helpers cookies обычно начинаются с sb-
  if (n.startsWith("sb-")) return true

  // иногда встречаются другие варианты
  if (n.includes("supabase")) return true
  if (n.includes("auth-token")) return true
  if (n.includes("access-token")) return true
  if (n.includes("refresh-token")) return true

  return false
}

function buildResponse() {
  const res = NextResponse.json({ ok: true }, { status: 200 })

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
  return res
}

export async function POST() {
  return buildResponse()
}

export async function GET() {
  return buildResponse()
}
