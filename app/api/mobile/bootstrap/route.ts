import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/bootstrap
 *
 * Mobile-specific endpoint. Accepts:
 *   Authorization: Bearer <supabase_access_token>
 *   X-Device-Hash: <device_hash>
 *
 * Returns user info + access/subscription summary in one call.
 * This avoids the cookie-based auth that web uses.
 */

function env(n: string) {
  return (process.env[n] || "").trim()
}

function admin() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL")
  const key = env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_KEY")
  if (!url || !key) throw new Error("Missing Supabase config")
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function isFuture(v: any): boolean {
  if (!v) return false
  const d = new Date(String(v))
  return !isNaN(d.getTime()) && d.getTime() > Date.now()
}

export async function GET(req: NextRequest) {
  const noCache = { "cache-control": "no-store, max-age=0" }

  // 1. Extract auth token
  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()

  // 2. Extract device hash
  const deviceHash = req.headers.get("x-device-hash") || ""
  if (!deviceHash) {
    return NextResponse.json(
      { ok: false, error: "missing_device_hash" },
      { status: 400, headers: noCache },
    )
  }

  const sb = admin()
  let userId: string | null = null
  let email: string | null = null

  // 3. Resolve user from token (optional — guest access works too)
  if (token) {
    try {
      const { data } = await sb.auth.getUser(token)
      userId = data?.user?.id ?? null
      email = (data?.user?.email as string) ?? null
    } catch {
      // Invalid token — treat as guest
    }
  }

  // 4. Find access grant
  let grant: any = null

  if (userId) {
    // Try by user_id first
    const { data } = await sb
      .from("access_grants")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
    grant = data?.[0] ?? null
  }

  if (!grant) {
    // Fall back to device_hash
    const { data } = await sb
      .from("access_grants")
      .select("*")
      .eq("device_hash", deviceHash)
      .order("updated_at", { ascending: false })
      .limit(1)
    grant = data?.[0] ?? null
  }

  // 5. If logged in but no grant exists, create one
  if (!grant && userId) {
    const trialLimit = Number(process.env.TRIAL_QUESTIONS_LIMIT ?? "5")
    const now = new Date().toISOString()
    const { data } = await sb
      .from("access_grants")
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        device_hash: deviceHash,
        trial_questions_left: trialLimit,
        paid_until: null,
        promo_until: null,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single()
    grant = data
  }

  // 6. Build response
  const hasPaid = isFuture(grant?.paid_until)
  const hasPromo = isFuture(grant?.promo_until)
  const trialLeft = Number(grant?.trial_questions_left ?? 0)
  const hasAccess = hasPaid || hasPromo || trialLeft > 0

  const access = hasPaid ? "paid" : hasPromo ? "promo" : trialLeft > 0 ? "trial" : "none"

  return NextResponse.json(
    {
      ok: true,
      isLoggedIn: !!userId,
      userId,
      email,
      deviceHash,
      access,
      hasAccess,
      unlimited: hasPaid || hasPromo,
      trial_questions_left: trialLeft,
      paid_until: grant?.paid_until ?? null,
      promo_until: grant?.promo_until ?? null,
      subscription_status: grant?.status ?? null,
      auto_renew: !!grant?.auto_renew,
    },
    { status: 200, headers: noCache },
  )
}
