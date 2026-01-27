import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const COOKIE = "ta_device_hash"

export function middleware(req: NextRequest) {
  const v = req.cookies.get(COOKIE)?.value
  if (v) return NextResponse.next()

  const res = NextResponse.next()
  const uuid = crypto.randomUUID()

  res.cookies.set(COOKIE, uuid, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  })

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
