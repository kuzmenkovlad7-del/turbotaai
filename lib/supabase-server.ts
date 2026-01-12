import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function isSupabaseServerConfigured(): boolean {
  return Boolean(supabaseUrl && (serviceRoleKey || anonKey))
}

export function getSupabaseServerClient(): SupabaseClient {
  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL")
  }
  const key = serviceRoleKey || anonKey
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY",
    )
  }

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
