import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  let token = ""
  try {
    const body = await req.json()
    token = String(body?.access_token || "").trim()
  } catch {}

  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing access_token" }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set("turbota_at", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
  return res
}
