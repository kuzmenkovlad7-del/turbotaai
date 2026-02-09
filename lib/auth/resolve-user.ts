/**
 * Resolve authenticated userId from request cookies via Supabase server auth.
 *
 * Used by API routes to reconcile identity: if a user is logged in,
 * their Supabase user.id takes precedence over any client-sent userId.
 */

import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function resolveAuthUserId(req: NextRequest): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null

  try {
    const supabase = createServerClient(url, anon, {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set() {},
        remove() {},
      },
    })

    const { data } = await supabase.auth.getUser()
    return data?.user?.id || null
  } catch {
    return null
  }
}
