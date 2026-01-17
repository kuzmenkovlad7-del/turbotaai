import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const DEVICE_COOKIE = "turbotaai_device"
const LAST_USER_COOKIE = "turbotaai_last_user"

/**
 * POST /api/auth/clear
 * - default: clear auth cookies, KEEP device + last_user
 *
 * Full wipe for testing (also removes device + last_user):
 * - POST /api/auth/clear?scope=hard
 */
export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const scope = (req.nextUrl.searchParams.get("scope") || "auth").toLowerCase()

  // IMPORTANT: hard only on scope=hard
  const hard = scope === "hard"

  const res = NextResponse.json({ ok: true, scope, hard }, { status: 200 })

  for (const c of cookieStore.getAll()) {
    if (!hard && (c.name === DEVICE_COOKIE || c.name === LAST_USER_COOKIE)) continue
    res.cookies.set(c.name, "", { path: "/", maxAge: 0 })
  }

  res.headers.set("cache-control", "no-store, max-age=0")
  return res
}
