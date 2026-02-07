import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let _admin: SupabaseClient | null = null

function initAdmin(): SupabaseClient {
  if (_admin) return _admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing")
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing")
  _admin = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  return _admin
}

/**
 * Lazy-initialised Supabase admin client.
 * Using a getter avoids top-level throws that crash the Next.js build
 * when env vars are not yet injected (e.g. during static analysis).
 */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(initAdmin(), prop, receiver)
  },
})

export function getSupabaseAdmin() {
  return initAdmin()
}
