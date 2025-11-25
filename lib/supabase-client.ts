// lib/supabase-client.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const isValidUrl =
  typeof supabaseUrl === "string" && /^https?:\/\//.test(supabaseUrl)

export const isSupabaseConfigured =
  Boolean(isValidUrl && supabaseAnonKey && supabaseAnonKey.length > 0)

if (!isSupabaseConfigured && process.env.NODE_ENV !== "production") {
  console.warn(
    "[Supabase] Not configured: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing or invalid. " +
      "All features that depend on the database are temporarily disabled.",
  )
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null
