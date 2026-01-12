import { NextRequest, NextResponse } from "next/server"

const COOKIE_NAME = "turbotaai_device"
const ONE_YEAR = 60 * 60 * 24 * 365

export function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const existing = req.cookies.get(COOKIE_NAME)?.value
  if (!existing) {
    const id = crypto.randomUUID()
    res.cookies.set(COOKIE_NAME, id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ONE_YEAR,
    })
  }

  return res
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
}
