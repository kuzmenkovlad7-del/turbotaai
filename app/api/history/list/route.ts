import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { supabaseAdmin } from "@/lib/supabase/admin"

const DEVICE_COOKIE = "device_hash"

export async function GET() {
  const cookieStore = cookies()
  const res = new NextResponse(null, { status: 200 })

  const deviceHash = cookieStore.get(DEVICE_COOKIE)?.value || null

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options, maxAge: 0 })
        },
      },
    }
  )

  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user ?? null

  let q = supabaseAdmin
    .from("conversations")
    .select("id,title,mode,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(50)

  if (user?.id) {
    q = q.eq("user_id", user.id)
  } else if (deviceHash) {
    q = q.eq("device_hash", deviceHash).is("user_id", null)
  } else {
    const out = NextResponse.json({ conversations: [] })
    for (const c of res.cookies.getAll()) out.cookies.set(c)
    return out
  }

  const { data } = await q

  const out = NextResponse.json({ conversations: data ?? [] })
  for (const c of res.cookies.getAll()) out.cookies.set(c)
  return out
}
