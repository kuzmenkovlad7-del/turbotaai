import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    await supabase.auth.signOut()
  } catch {}

  const url = new URL(req.url)
  const next = url.searchParams.get("next")
  const referer = req.headers.get("referer")

  const dest = next || referer || "/"
  const res = NextResponse.redirect(dest)
  res.headers.set("cache-control", "no-store")
  return res
}
