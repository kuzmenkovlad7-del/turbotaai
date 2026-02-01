import { NextRequest, NextResponse } from "next/server"

const DEVICE_COOKIE = "ta_device_hash"

function cookieDomain(host: string | null) {
  const h = String(host || "").toLowerCase()
  if (h === "turbotaai.com" || h.endsWith(".turbotaai.com")) return ".turbotaai.com"
  return undefined
}

export function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const existing = req.cookies.get(DEVICE_COOKIE)?.value
  if (!existing) {
    const v = crypto.randomUUID()
    const domain = cookieDomain(req.headers.get("host"))
    res.cookies.set({
      name: DEVICE_COOKIE,
      value: v,
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      domain,
    })
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
