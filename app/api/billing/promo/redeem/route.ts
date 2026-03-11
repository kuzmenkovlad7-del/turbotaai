import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { randomUUID } from "crypto"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "ta_device_hash"
const ACCOUNT_PREFIX = "account:"

type GrantRow = {
  id: string
  user_id: string | null
  device_hash: string
  trial_questions_left: number | null
  paid_until: any
  promo_until: any
  created_at?: string | null
  updated_at?: string | null
}

function num(v: any, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function getTrialLimit() {
  const limit = num(process.env.TRIAL_QUESTIONS_LIMIT, 5)
  return limit > 0 ? Math.floor(limit) : 5
}

function addDaysIso(days: number) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

function toDateOrNull(v: any): Date | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function laterDateIso(a: any, b: any): string | null {
  const da = toDateOrNull(a)
  const db = toDateOrNull(b)
  if (!da && !db) return null
  if (da && !db) return da.toISOString()
  if (!da && db) return db.toISOString()
  return (da!.getTime() >= db!.getTime() ? da! : db!).toISOString()
}

function getPromoMap() {
  const base: Record<string, number> = {
    TEST: 365,
    DOCTOR12FREE: 365,
  }

  const raw = process.env.PROMO_CODES_JSON
  if (raw) {
    try {
      const extra = JSON.parse(raw)
      if (extra && typeof extra === "object") {
        for (const [k, v] of Object.entries(extra)) {
          const key = String(k || "").toUpperCase().trim()
          const days = Number(v)
          if (key && Number.isFinite(days) && days > 0) base[key] = days
        }
      }
    } catch {}
  }

  return base
}

/**
 * Build a Supabase SSR client that reads session cookies from the incoming
 * NextRequest rather than from next/headers cookies().
 *
 * Reason: cookies() from "next/headers" relies on Next.js async local storage
 * and can throw or behave unpredictably in Vercel serverless functions after
 * multiple awaits.  NextRequest.cookies is always available — it's just a
 * parsed view of the Cookie header — and never fails.
 */
function makeSessionClient(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  try {
    return createServerClient(url, anon, {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll() {},  // promo route never writes session cookies
      },
    })
  } catch {
    return null
  }
}

async function findGrantByDevice(admin: any, deviceHash: string): Promise<GrantRow | null> {
  const { data, error } = await admin
    .from("access_grants")
    .select("*")
    .eq("device_hash", deviceHash)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) {
    console.error("[promo/redeem] findGrant error:", error?.message ?? error)
    return null
  }
  const row = Array.isArray(data) ? data[0] : null
  return (row ?? null) as GrantRow | null
}

async function ensureGrant(
  admin: any,
  deviceHash: string,
  userId: string | null,
  trialDefault: number,
  nowIso: string
): Promise<GrantRow> {
  let g = await findGrantByDevice(admin, deviceHash)

  if (!g) {
    // Use upsert (not insert) so a concurrent request or pre-existing row
    // from bootstrap never causes a unique-constraint failure.
    // Do NOT include `id` — let the DB auto-generate it (matches web behaviour).
    const { error: upsertErr } = await admin
      .from("access_grants")
      .upsert(
        {
          device_hash: deviceHash,
          user_id: userId,
          trial_questions_left: trialDefault,
          paid_until: null,
          promo_until: null,
          created_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "device_hash", ignoreDuplicates: true },
      )

    if (upsertErr) {
      console.error("[promo/redeem] upsert error for", deviceHash, ":", upsertErr?.message ?? upsertErr)
    }

    g = await findGrantByDevice(admin, deviceHash)
  }

  if (g && userId && !g.user_id) {
    const up = await admin
      .from("access_grants")
      .update({ user_id: userId, updated_at: nowIso })
      .eq("device_hash", deviceHash)
      .select("*")
      .limit(1)

    const row = Array.isArray(up?.data) ? up.data[0] : null
    g = (row ?? g) as GrantRow
  }

  // Fallback: return a constructed object so we never crash on unexpected DB
  // issues — the subsequent UPDATE will still attempt to apply the promo.
  return (
    g ?? {
      id: randomUUID(),
      user_id: userId,
      device_hash: deviceHash,
      trial_questions_left: trialDefault,
      paid_until: null,
      promo_until: null,
      created_at: nowIso,
      updated_at: nowIso,
    }
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const raw = String(body?.code || "").trim()
    const code = raw.toUpperCase()

    if (!code) {
      return NextResponse.json({ ok: false, error: "invalid_promo" }, { status: 400 })
    }

    const PROMO_MAP = getPromoMap()
    const days = PROMO_MAP[code]
    if (!days) {
      return NextResponse.json({ ok: false, error: "invalid_promo" }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    // Resolve user: try Bearer token first (mobile clients send this instead of
    // session cookies), then fall back to cookie-based session (web browsers).
    let userId: string | null = null
    const authHeader = req.headers.get("authorization") || ""
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim()
    if (bearerToken) {
      try {
        const { data: bearerData } = await admin.auth.getUser(bearerToken)
        userId = bearerData?.user?.id ?? null
      } catch {}
    }
    if (!userId) {
      try {
        const sb = makeSessionClient(req)
        if (sb) {
          const { data: userData } = await sb.auth.getUser()
          userId = userData?.user?.id ?? null
        }
      } catch {}
    }

    // Promo codes require an authenticated user so the account grant is updated
    // and the access is tied to the account across all devices/platforms.
    if (!userId) {
      return NextResponse.json({ ok: false, error: "login_required" }, { status: 401 })
    }

    const trialDefault = getTrialLimit()
    const nowIso = new Date().toISOString()
    const promoUntil = addDaysIso(days)

    // Resolve device hash: mobile sends X-Device-Hash header; web uses cookie.
    // Both are read directly from the request — no next/headers needed.
    const xDeviceHash = req.headers.get("x-device-hash") || ""
    let deviceUuid: string
    let needSetDeviceCookie = false

    if (xDeviceHash) {
      deviceUuid = xDeviceHash
    } else {
      const cookieDeviceHash = req.cookies.get(DEVICE_COOKIE)?.value ?? null
      if (cookieDeviceHash) {
        deviceUuid = cookieDeviceHash
      } else {
        deviceUuid = randomUUID()
        needSetDeviceCookie = true
      }
    }

    const guestHash = deviceUuid
    const accountHash = userId ? `${ACCOUNT_PREFIX}${userId}` : null

    const guestGrant = await ensureGrant(admin, guestHash, userId ?? null, trialDefault, nowIso)
    const mergedGuest = laterDateIso(guestGrant.promo_until ?? null, promoUntil) ?? promoUntil

    // Update device grant. Verify the row was actually modified by reading back
    // the updated row — if 0 rows matched (ensureGrant returned an in-memory
    // fallback not in the DB, or the update silently failed) return a real error
    // instead of a fake ok:true that leaves bootstrap unchanged.
    const { data: guestUpdated, error: guestUpdateErr } = await admin
      .from("access_grants")
      .update({ promo_until: mergedGuest, trial_questions_left: 0, updated_at: nowIso })
      .eq("device_hash", guestHash)
      .select("device_hash,promo_until")

    if (guestUpdateErr || !Array.isArray(guestUpdated) || guestUpdated.length === 0) {
      console.error(
        "[promo/redeem] device grant update failed — err:",
        guestUpdateErr?.message ?? "none",
        "rows:", guestUpdated?.length ?? 0,
        "device_hash:", guestHash,
      )
      return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
    }

    let mergedAcc: string | null = null

    if (userId && accountHash) {
      const accGrant = await ensureGrant(admin, accountHash, userId, trialDefault, nowIso)
      mergedAcc = laterDateIso(accGrant.promo_until ?? null, mergedGuest) ?? mergedGuest

      const { error: accUpdateErr } = await admin
        .from("access_grants")
        .update({ promo_until: mergedAcc, trial_questions_left: 0, updated_at: nowIso })
        .eq("device_hash", accountHash)

      if (accUpdateErr) {
        // Non-fatal: device grant succeeded, promo is active on this device.
        // Account grant will auto-sync on next buildAccessSummary (auto-claim).
        console.error("[promo/redeem] account grant update error:", accUpdateErr?.message ?? accUpdateErr)
      }

      try {
        await admin
          .from("profiles")
          .update({ promo_until: mergedAcc, subscription_status: "active", updated_at: nowIso } as any)
          .eq("id", userId)
      } catch {}
    }

    const res = NextResponse.json(
      {
        ok: true,
        promo_until: mergedAcc ?? mergedGuest,
        promoUntil: mergedAcc ?? mergedGuest,
        guest: !userId,
      },
      { status: 200 }
    )

    if (needSetDeviceCookie) {
      const host = req.headers.get("host")
      const h = String(host || "").toLowerCase()
      const ckDomain = (h === "turbotaai.com" || h.endsWith(".turbotaai.com")) ? ".turbotaai.com" : undefined
      res.cookies.set(DEVICE_COOKIE, deviceUuid, {
        path: "/",
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
        domain: ckDomain,
      })
    }

    res.headers.set("cache-control", "no-store, max-age=0")
    return res
  } catch (_e: any) {
    console.error("[promo/redeem] Unexpected error:", _e)
    const body: Record<string, any> = { ok: false, error: "server_error" }
    if (process.env.NODE_ENV !== "production") {
      body.errorMessage = String(_e?.message || _e)
    }
    return NextResponse.json(body, { status: 500 })
  }
}
