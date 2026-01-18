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

function toDateOrNull(v: any) {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function maxDateIso(a: any, b: any) {
  const da = toDateOrNull(a)
  const db = toDateOrNull(b)
  if (!da && !db) return null
  if (da && !db) return da.toISOString()
  if (!da && db) return db.toISOString()
  return (da!.getTime() >= db!.getTime() ? da! : db!).toISOString()
}

function isFuture(iso: string | null) {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() > Date.now()
}

async function readProfile(admin: any, userId: string) {
  const cols = "paid_until,promo_until,auto_renew,autorenew,subscription_status"
  const r1 = await admin.from("profiles").select(cols).eq("id", userId).maybeSingle()
  if (!r1?.error && r1?.data) return r1.data

  const r2 = await admin.from("profiles").select(cols).eq("user_id", userId).maybeSingle()
  if (!r2?.error && r2?.data) return r2.data

  return null
}

export async function GET() {
  const { userId, error } = await getUserIdFromSession()
  if (!userId) return NextResponse.json({ ok: false, error }, { status: 401 })

  const admin = getSupabaseAdmin()
  const p = await readProfile(admin, userId)

  const paidUntil = p?.paid_until ?? null
  const promoUntil = p?.promo_until ?? null
  const accessUntil = maxDateIso(paidUntil, promoUntil)

  const hasAccess = isFuture(accessUntil)
  const autoRenew = Boolean(p?.auto_renew ?? p?.autorenew ?? false)

  let subscriptionStatus = String(p?.subscription_status ?? "")
  if (!subscriptionStatus) subscriptionStatus = hasAccess ? "active" : "inactive"

  return NextResponse.json({
    ok: true,
    userId,
    hasAccess,
    accessUntil,
    paidUntil: paidUntil ? String(paidUntil) : null,
    promoUntil: promoUntil ? String(promoUntil) : null,
    autoRenew,
    subscriptionStatus,
  })
}
