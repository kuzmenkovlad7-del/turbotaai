import { createClient, type SupabaseClient } from "@supabase/supabase-js"

function must(v: string | undefined, name: string) {
  if (!v) throw new Error(`[Supabase] Missing env: ${name}`)
  return v
}

export function getSupabaseAdmin(): SupabaseClient {
  const url = must(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL")
  const key = must(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
