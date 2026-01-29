import { NextRequest, NextResponse } from "next/server"
import { buildAccessSummary } from "@/lib/server/access-summary"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "ta_device_hash"

export async function GET(req: NextRequest) {
  const { summary, pendingCookies, needSetDeviceCookie, deviceHash, cookieDomain } = await buildAccessSummary(req)

  const res = NextResponse.json(summary, { status: 200 })
  res.headers.set("cache-control", "no-store, max-age=0")

  if (needSetDeviceCookie) {
    res.cookies.set(DEVICE_COOKIE, deviceHash, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      domain: cookieDomain,
    })
  }

  for (const c of pendingCookies) {
    res.cookies.set(c.name, c.value, c.options)
  }

  return res
}
