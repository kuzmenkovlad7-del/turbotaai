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
 * Uses the same dual-grant logic as the web (lib/server/access-summary.ts):
 *   - device grant  → access_grants WHERE device_hash = <X-Device-Hash>
 *   - account grant → access_grants WHERE device_hash = "account:<userId>"
 * Both grants are looked up independently and their paid_until / promo_until
 * are MERGED (later date wins) so any access granted on any device/platform
 * is reflected immediately.  Trial counter comes from the device grant.
 */

function env(n: string) {
  return (process.env[n] || "").trim()
}

function makeAdmin() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL")
  const key = env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_KEY")
  if (!url || !key) throw new Error("Missing Supabase config")
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function toDateOrNull(v: any): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}

function isFuture(v: any): boolean {
  const d = toDateOrNull(v)
  return !!d && d.getTime() > Date.now()
}

/** Return the ISO string for whichever date is later (null if both null). */
function laterIso(a: any, b: any): string | null {
  const da = toDateOrNull(a)
  const db = toDateOrNull(b)
  if (!da && !db) return null
  if (da && !db) return da.toISOString()
  if (!da && db) return db.toISOString()
  return (da!.getTime() >= db!.getTime() ? da! : db!).toISOString()
}

/** Find the most-recently-updated grant by the `device_hash` column key. */
async function findGrantByKey(sb: any, key: string): Promise<any | null> {
  const { data } = await sb
    .from("access_grants")
    .select("*")
    .eq("device_hash", key)
    .order("updated_at", { ascending: false })
    .limit(1)
  return data?.[0] ?? null
}

export async function GET(req: NextRequest) {
  const noCache = { "cache-control": "no-store, max-age=0" }

  // 1. Extract Bearer token
  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()

  // 2. Extract device hash (required)
  const deviceHash = req.headers.get("x-device-hash") || ""
  if (!deviceHash) {
    return NextResponse.json(
      { ok: false, error: "missing_device_hash" },
      { status: 400, headers: noCache },
    )
  }

  const sb = makeAdmin()
  let userId: string | null = null
  let email: string | null = null

  // 3. Resolve user from Bearer token (optional — guest access works too)
  if (token) {
    try {
      const { data } = await sb.auth.getUser(token)
      userId = data?.user?.id ?? null
      email = (data?.user?.email as string) ?? null
    } catch {
      // Invalid / expired token — treat as guest
    }
  }

  const TRIAL_DEFAULT = Math.max(1, Math.floor(Number(process.env.TRIAL_QUESTIONS_LIMIT || "5") || 5))
  const now = new Date().toISOString()
  // Account key mirrors the web's convention (lib/server/access-summary.ts)
  const accountKey = userId ? `account:${userId}` : null

  // 4. Fetch both grants in parallel
  const [deviceGrant, accountGrant] = await Promise.all([
    findGrantByKey(sb, deviceHash),
    accountKey ? findGrantByKey(sb, accountKey) : Promise.resolve(null),
  ])

  // 5. Lazily create missing grants
  //    Device grant: full trial for brand-new device
  let dg = deviceGrant
  if (!dg) {
    const { data } = await sb
      .from("access_grants")
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        device_hash: deviceHash,
        trial_questions_left: TRIAL_DEFAULT,
        paid_until: null,
        promo_until: null,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single()
    dg = data ?? await findGrantByKey(sb, deviceHash)
  }

  //    Account grant: copy trial count from device grant so used questions carry over
  let ag = accountGrant
  if (!ag && accountKey && userId) {
    const trialForAccount = Number(dg?.trial_questions_left ?? TRIAL_DEFAULT)
    const { data } = await sb
      .from("access_grants")
      .insert({
        id: crypto.randomUUID(),
        user_id: userId,
        device_hash: accountKey,
        trial_questions_left: trialForAccount,
        paid_until: dg?.paid_until ?? null,
        promo_until: dg?.promo_until ?? null,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single()
    ag = data ?? await findGrantByKey(sb, accountKey)
  }

  // 6. Also read profiles table for promo_until / paid_until so that access
  //    set by older web code (which only wrote to profiles, not access_grants)
  //    or by an admin is still reflected immediately after login.
  let profPaidUntil: string | null = null
  let profPromoUntil: string | null = null
  if (userId) {
    try {
      const { data: prof } = await sb
        .from("profiles")
        .select("paid_until,promo_until")
        .eq("id", userId)
        .maybeSingle()
      profPaidUntil  = (prof as any)?.paid_until  ?? null
      profPromoUntil = (prof as any)?.promo_until ?? null
    } catch {}
  }

  // 7. Merge: take the best (later) paid/promo date from device grant, account
  //    grant, and profiles so any access path on any platform is visible.
  const mergedPaid  = laterIso(laterIso(dg?.paid_until  ?? null, ag?.paid_until  ?? null), profPaidUntil)
  const mergedPromo = laterIso(laterIso(dg?.promo_until ?? null, ag?.promo_until ?? null), profPromoUntil)

  // 8. Trial counter lives on the device grant (same convention as web).
  const trialLeft = Math.max(0, Number(dg?.trial_questions_left ?? TRIAL_DEFAULT))

  const hasPaid   = isFuture(mergedPaid)
  const hasPromo  = isFuture(mergedPromo)
  const unlimited = hasPaid || hasPromo
  const hasAccess = unlimited || trialLeft > 0

  const access = hasPaid ? "paid" : hasPromo ? "promo" : trialLeft > 0 ? "trial" : "none"

  // subscription_status / auto_renew: prefer account grant if present
  const subscription_status = (ag ?? dg)?.status ?? null
  const auto_renew = !!((ag ?? dg)?.auto_renew ?? false)

  return NextResponse.json(
    {
      ok: true,
      isLoggedIn: !!userId,
      userId,
      email,
      deviceHash,

      access,
      hasAccess,
      unlimited,

      // camelCase aliases used by useAuth.ts / AccountScreen
      hasPaid,
      hasPromo,

      trial_questions_left: trialLeft,
      questionsLeft: trialLeft,

      paid_until:  mergedPaid,
      paidUntil:   mergedPaid,
      promo_until: mergedPromo,
      promoUntil:  mergedPromo,

      subscription_status,
      auto_renew,
    },
    { status: 200, headers: noCache },
  )
}
