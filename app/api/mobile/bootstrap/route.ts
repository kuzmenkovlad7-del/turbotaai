import { NextRequest, NextResponse } from "next/server"
import { buildAccessSummary } from "@/lib/server/access-summary"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "ta_device_hash"

/**
 * GET /api/mobile/bootstrap
 *
 * Mobile-specific endpoint. Accepts:
 *   Authorization: Bearer <supabase_access_token>
 *   X-Device-Hash: <device_hash>
 *
 * Delegates to buildAccessSummary (lib/server/access-summary.ts) — the same
 * shared resolver used by /api/account/summary — so mobile and web always see
 * identical access state (auto-claim, self-healing billing orders, profile sync).
 */
export async function GET(req: NextRequest) {
  const noCache = { "cache-control": "no-store, max-age=0" }

  // X-Device-Hash is required for mobile clients
  const deviceHashHeader = req.headers.get("x-device-hash") || ""
  if (!deviceHashHeader) {
    return NextResponse.json(
      { ok: false, error: "missing_device_hash" },
      { status: 400, headers: noCache },
    )
  }

  const { summary, pendingCookies, needSetDeviceCookie, deviceHash, cookieDomain } =
    await buildAccessSummary(req)

  const res = NextResponse.json(summary, { status: 200 })
  res.headers.set("cache-control", "no-store, max-age=0")

  if (needSetDeviceCookie) {
    res.cookies.set(DEVICE_COOKIE, deviceHash, {
      path: "/",
      httpOnly: false,
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
