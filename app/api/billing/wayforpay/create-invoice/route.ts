import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function getUserFromSession() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return { user: null as any, error: "Missing Supabase public env" }

  const cookieStore = cookies()
  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user?.id) return { user: null, error: error?.message || "Unauthorized" }
  return { user: data.user, error: null }
}

function getBaseUrl(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "https"
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || ""
  return `${proto}://${host}`
}

export async function POST(req: NextRequest) {
  const { user, error } = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ ok: false, error: error || "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({} as any))
  const planId = String(body?.planId || "monthly").trim()

  const baseUrl = getBaseUrl(req)

  // это URL, который откроется в новой вкладке и сам отправит форму в WayForPay
  const invoiceUrl = `${baseUrl}/api/billing/wayforpay/purchase?planId=${encodeURIComponent(planId)}`

  return NextResponse.json({ ok: true, invoiceUrl })
}
