import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "ta_device_hash"
const ACCOUNT_PREFIX = "account:"

function clampInt(v: any, fallback: number, min = 0, max = 9999) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

function trialDefaultValue() {
  return clampInt(process.env.TRIAL_QUESTIONS_LIMIT, 5, 0, 999)
}

function makeAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/**
 * Resolve user ID from the request.
 * Mobile sends Authorization: Bearer <token>; web uses cookie session.
 */
async function resolveUserId(req: NextRequest, admin: ReturnType<typeof makeAdmin>): Promise<string | null> {
  // Mobile: Bearer token
  const authHeader = req.headers.get("authorization") || ""
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (bearerToken) {
    try {
      const { data } = await admin.auth.getUser(bearerToken)
      if (data?.user?.id) return data.user.id
    } catch {}
  }

  // Web: cookie-based session
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  try {
    const cookieStore = cookies()
    const sb = createServerClient(url, anon, {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    })
    const { data } = await sb.auth.getUser()
    return data?.user?.id ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const nowIso = new Date().toISOString()
    const trialDefault = trialDefaultValue()

    // Resolve device hash: mobile sends X-Device-Hash header; web uses cookie.
    const xDeviceHash = req.headers.get("x-device-hash") || ""
    let deviceUuid: string
    let needSetDeviceCookie = false

    if (xDeviceHash) {
      deviceUuid = xDeviceHash
    } else {
      const cookieStore = cookies()
      const cookieDevice = cookieStore.get(DEVICE_COOKIE)?.value ?? null
      if (cookieDevice) {
        deviceUuid = cookieDevice
      } else {
        deviceUuid = crypto.randomUUID()
        needSetDeviceCookie = true
      }
    }

    const admin = makeAdmin()
    const userId = await resolveUserId(req, admin)

    // Same targets as redeem: device grant + account grant
    const targets: string[] = [deviceUuid]
    if (userId) targets.push(`${ACCOUNT_PREFIX}${userId}`)

    // Update grants by device_hash (the unique key we know) — same pattern as
    // redeem/route.ts. DO NOT update by `id`: the id may be missing from the
    // returned row shape, causing silent no-ops while the route still returns ok.
    // Restoring trial_questions_left to the default (promo sets it to 0 on redeem).
    for (const dh of targets) {
      const { error } = await admin
        .from("access_grants")
        .update({ promo_until: null, trial_questions_left: trialDefault, updated_at: nowIso })
        .eq("device_hash", dh)
      if (error) {
        console.error("[promo/cancel] grant update error for", dh, ":", error.message ?? error)
      }
    }

    // Clear profiles.promo_until — this is the source that mobile bootstrap
    // includes in its 3-way merge (device grant + account grant + profiles).
    // Must be cleared in sync with grants so all three sources agree.
    if (userId) {
      const { error: profErr } = await admin
        .from("profiles")
        .update({ promo_until: null, updated_at: nowIso } as any)
        .eq("id", userId)
      if (profErr) {
        console.error("[promo/cancel] profiles update error for", userId, ":", profErr.message ?? profErr)
      }
    }

    const res = NextResponse.json({ ok: true }, { status: 200 })

    if (needSetDeviceCookie) {
      res.cookies.set(DEVICE_COOKIE, deviceUuid, {
        path: "/",
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
      })
    }

    res.headers.set("cache-control", "no-store, max-age=0")
    return res
  } catch (_e: any) {
    console.error("[promo/cancel] Unexpected error:", _e)
    return NextResponse.json({ ok: false, errorCode: "CANCEL_FAILED" }, { status: 200 })
  }
}
