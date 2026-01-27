import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
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

function clampInt(v: any, fallback: number, min = 0, max = 9999) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

function routeSessionSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")

  const cookieStore = cookies()
  const pendingCookies: any[] = []

  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        pendingCookies.push(...cookiesToSet)
      },
    },
  })

  const applyPendingCookies = (res: NextResponse) => {
    for (const c of pendingCookies) res.cookies.set(c.name, c.value, c.options)
  }

  return { sb, applyPendingCookies }
}

function routeAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !(service || anon)) {
    throw new Error(
      "Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and (SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    )
  }

  const sb = createClient(url, service || anon!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  return sb
}

async function findGrantByDevice(sb: any, deviceHash: string): Promise<GrantRow | null> {
  const { data } = await sb
    .from("access_grants")
    .select("*")
    .eq("device_hash", deviceHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data ?? null) as GrantRow | null
}

async function updateGrant(
  sb: any,
  id: string,
  patch: Partial<GrantRow> & { updated_at?: string }
) {
  const { data } = await sb.from("access_grants").update(patch).eq("id", id).select("*").maybeSingle()
  return (data ?? null) as GrantRow | null
}

export async function POST(_req: NextRequest) {
  try {
    const nowIso = new Date().toISOString()
    const trialDefault = clampInt(process.env.NEXT_PUBLIC_TRIAL_QUESTIONS, 5, 0, 999)

    const cookieStore = cookies()
    let deviceUuid = cookieStore.get(DEVICE_COOKIE)?.value ?? null
    let needSetDeviceCookie = false
    if (!deviceUuid) {
      deviceUuid = crypto.randomUUID()
      needSetDeviceCookie = true
    }

    const { sb: sessionSb, applyPendingCookies } = routeSessionSupabase()
    const adminSb = routeAdminSupabase()

    const { data: userData } = await sessionSb.auth.getUser()
    const user = userData?.user ?? null
    const userId = user?.id ?? null
    const isLoggedIn = Boolean(userId)

    const targets: string[] = [deviceUuid]
    if (isLoggedIn && userId) targets.push(`${ACCOUNT_PREFIX}${userId}`)

    let okAny = false

    for (const deviceHash of targets) {
      const g = await findGrantByDevice(adminSb, deviceHash)

      if (g?.id) {
        const current = typeof g.trial_questions_left === "number" ? g.trial_questions_left : null

        // если после промо осталось 0, возвращаем дефолтный trial (обычно 5)
        // если было >0, оставляем как есть
        const restoredTrial =
          current && current > 0
            ? current
            : trialDefault

        await updateGrant(adminSb, g.id, {
          promo_until: null,
          trial_questions_left: restoredTrial,
          updated_at: nowIso,
        }).catch(() => null)

        okAny = true
      }
    }

    // на всякий случай снимаем promo_until и в profiles (если промо писалось туда)
    if (isLoggedIn && userId) {
      try {
        const admin = getSupabaseAdmin()
        await admin
          .from("profiles")
          .update({ promo_until: null, updated_at: nowIso } as any)
          .eq("id", userId)
      } catch {}
    }

    const res = NextResponse.json(okAny ? { ok: true } : { ok: false, errorCode: "GRANT_NOT_FOUND" }, { status: 200 })

    if (needSetDeviceCookie) {
      res.cookies.set(DEVICE_COOKIE, deviceUuid, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      })
    }

    applyPendingCookies(res)
    res.headers.set("cache-control", "no-store, max-age=0")
    return res
  } catch (_e: any) {
    return NextResponse.json({ ok: false, errorCode: "CANCEL_FAILED" }, { status: 200 })
  }
}
