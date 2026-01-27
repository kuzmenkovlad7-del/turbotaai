import { NextRequest, NextResponse } from "next/server"

const DEVICE_COOKIE = "ta_device_hash"

export function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const existing = req.cookies.get(DEVICE_COOKIE)?.value
  if (!existing) {
    const v = crypto.randomUUID()
    res.cookies.set({
      name: DEVICE_COOKIE,
      value: v,
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
