import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildAccessSummary } from "@/lib/server/access-summary"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "ta_device_hash"

function env(name: string) {
  return String(process.env[name] || "").trim()
}

/**
 * POST /api/account/claim
 *
 * Called after login/register.
 * 1. Associates billing_orders from guest device_hash with logged-in user_id
 * 2. buildAccessSummary does auto-claim (merges guest dates into account grant)
 *    + self-healing from billing_orders
 */
export async function POST(req: NextRequest) {
  const { summary, pendingCookies, needSetDeviceCookie, deviceHash, cookieDomain } =
    await buildAccessSummary(req)

  // After summary is built, associate any guest billing_orders with the user
  if (summary.userId && deviceHash) {
    try {
      const url = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL")
      const key = env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_KEY")
      if (url && key) {
        const admin = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        })

        // Link guest orders to user account
        await admin
          .from("billing_orders")
          .update({ user_id: summary.userId, updated_at: new Date().toISOString() } as any)
          .eq("device_hash", deviceHash)
          .is("user_id", null)
      }
    } catch {}
  }

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
