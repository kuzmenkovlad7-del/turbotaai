import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured && process.env.NODE_ENV !== "production") {
  console.warn(
    "⚠️ Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file."
  )
}

export const supabase = isSupabaseConfigured
  ? createSupabaseClient(supabaseUrl as string, supabaseAnonKey as string)
  : null

export { createClient } from "@supabase/supabase-js"

export default supabase

let browserClient: ReturnType<typeof createSupabaseClient> | null = null

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured) {
    console.warn("Supabase is not configured")
    return null
  }

  if (browserClient) return browserClient

  try {
    browserClient = createSupabaseClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            signal: AbortSignal.timeout(10000),
          }).catch((error) => {
            console.error("Supabase browser client fetch error:", error)
            throw new Error("Network connection failed")
          })
        },
      },
    })

    return browserClient
  } catch (error) {
    console.error("Failed to create Supabase browser client:", error)
    return null
  }
}

export function getSupabaseServerClient() {
  const serverSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

  if (!serverSupabaseUrl || !supabaseServiceKey) {
    console.warn("Missing Supabase server environment variables")
    return null
  }

  try {
    return createSupabaseClient(serverSupabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
      global: {
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            signal: AbortSignal.timeout(15000),
          }).catch((error) => {
            console.error("Supabase server client fetch error:", error)
            throw new Error("Network connection failed")
          })
        },
      },
    })
  } catch (error) {
    console.error("Failed to create Supabase server client:", error)
    return null
  }
}
