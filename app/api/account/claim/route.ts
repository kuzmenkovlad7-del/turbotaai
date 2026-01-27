import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEVICE_COOKIE = "ta_device_hash"
const ACCOUNT_PREFIX = "account:"

function pickEnv(name: string) {
  const v = process.env[name]
  return v && String(v).trim() ? String(v).trim() : ""
}

function mustEnv(name: string) {
  const v = pickEnv(name)
  if (!v) throw new Error("Missing env " + name)
  return v
}

function routeSupabaseSession() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL")
  const anon = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

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

  const json = (body: any, status = 200) => {
    const res = NextResponse.json(body, { status })
    for (const c of pendingCookies) res.cookies.set(c.name, c.value, c.options)
    res.headers.set("cache-control", "no-store, max-age=0")
    return res
  }

  return { sb, cookieStore, json }
}

export async function POST(_req: NextRequest) {
  try {
    const { sb, cookieStore, json } = routeSupabaseSession()
    const admin = getSupabaseAdmin()

    const deviceHash = String(cookieStore.get(DEVICE_COOKIE)?.value || "").trim() || null
    if (!deviceHash) return json({ ok: false, error: "Missing device cookie" }, 200)

    const { data: userData } = await sb.auth.getUser()
    const user = userData?.user ?? null
    if (!user?.id) return json({ ok: false, error: "Not logged in" }, 200)

    const nowIso = new Date().toISOString()
    const accountKey = `${ACCOUNT_PREFIX}${user.id}`

    const updGrant = await admin
      .from("access_grants")
      .update({ user_id: user.id, updated_at: nowIso } as any)
      .eq("device_hash", deviceHash)
      .is("user_id", null)
      .select("id")

    const updGrantAccountKey = await admin
      .from("access_grants")
      .update({ user_id: user.id, updated_at: nowIso } as any)
      .eq("device_hash", accountKey)
      .is("user_id", null)
      .select("id")

    const updOrders = await admin
      .from("billing_orders")
      .update({ user_id: user.id, updated_at: nowIso } as any)
      .eq("device_hash", deviceHash)
      .is("user_id", null)
      .select("order_reference")

    return json({
      ok: true,
      deviceHash,
      userId: user.id,
      claimed: {
        grants: (updGrant.data || []).length,
        grantsAccountKey: (updGrantAccountKey.data || []).length,
        orders: (updOrders.data || []).length,
      },
      errors: {
        grants: updGrant.error?.message || null,
        grantsAccountKey: updGrantAccountKey.error?.message || null,
        orders: updOrders.error?.message || null,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "Claim failed", details: String(e?.message || e) }, { status: 500 })
  }
}
