import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function getUserIdFromSession() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !SUPABASE_ANON) return { userId: null, error: "Missing Supabase public env" }

  const cookieStore = cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user?.id) return { userId: null, error: error?.message || "Unauthorized" }
  return { userId: data.user.id, error: null }
}

async function updateProfile(admin: any, userId: string, payload: any) {
  const tries = [
    admin.from("profiles").update(payload).eq("id", userId),
    admin.from("profiles").update(payload).eq("user_id", userId),
  ]
  for (const t of tries) {
    const r = await t
    if (!r?.error) return { ok: true }
  }
  return { ok: false }
}

export async function POST() {
  const { userId, error } = await getUserIdFromSession()
  if (!userId) return NextResponse.json({ ok: false, error }, { status: 401 })

  const admin = getSupabaseAdmin()

  const payloadVariants = [
    { auto_renew: false, subscription_status: "canceled", updated_at: new Date().toISOString() },
    { autorenew: false, subscription_status: "canceled", updated_at: new Date().toISOString() },
    { auto_renew: false, subscription_status: "canceled" },
    { autorenew: false, subscription_status: "canceled" },
  ]

  for (const payload of payloadVariants) {
    const r = await updateProfile(admin, userId, payload)
    if (r.ok) return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false, error: "Failed to update profile" }, { status: 500 })
}
