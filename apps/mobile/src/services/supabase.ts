import { createClient } from "@supabase/supabase-js"
import { API_BASE_URL } from "@/constants/config"
import {
  getAuthToken,
  setAuthToken,
  getRefreshToken,
  setRefreshToken,
  clearAll,
} from "./storage"

/**
 * Supabase client for mobile auth.
 *
 * We reuse the public anon key and project URL from the backend.
 * The mobile client uses this ONLY for signIn / signUp / getUser.
 * All other data access goes through the API (apiFetch).
 *
 * NOTE: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
 * must be set. They should match the web app's NEXT_PUBLIC_SUPABASE_URL
 * and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ""
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ""

let _client: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (_client) return _client

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Add them to apps/mobile/.env (same values as the web app).",
    )
  }

  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,      // We manage tokens ourselves via SecureStore
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  return _client
}

/* ── Auth wrappers ── */

export type AuthResult = {
  ok: boolean
  userId?: string
  email?: string
  error?: string
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const sb = getSupabase()
  const { data, error } = await sb.auth.signInWithPassword({ email, password })

  if (error || !data?.session) {
    return { ok: false, error: error?.message || "Login failed" }
  }

  await setAuthToken(data.session.access_token)
  await setRefreshToken(data.session.refresh_token)

  return {
    ok: true,
    userId: data.user?.id,
    email: data.user?.email ?? undefined,
  }
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const sb = getSupabase()
  const { data, error } = await sb.auth.signUp({ email, password })

  if (error) {
    return { ok: false, error: error.message }
  }

  // Some Supabase configs require email confirmation
  if (!data?.session) {
    return {
      ok: true,
      email: data?.user?.email ?? undefined,
      error: "Check your email to confirm your account.",
    }
  }

  await setAuthToken(data.session.access_token)
  await setRefreshToken(data.session.refresh_token)

  return {
    ok: true,
    userId: data.user?.id,
    email: data.user?.email ?? undefined,
  }
}

/** Try to refresh the session using the stored refresh token */
export async function refreshSession(): Promise<AuthResult> {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) return { ok: false, error: "no_refresh_token" }

  const sb = getSupabase()
  const { data, error } = await sb.auth.refreshSession({ refresh_token: refreshToken })

  if (error || !data?.session) {
    await clearAll()
    return { ok: false, error: error?.message || "Session expired" }
  }

  await setAuthToken(data.session.access_token)
  await setRefreshToken(data.session.refresh_token)

  return {
    ok: true,
    userId: data.user?.id,
    email: data.user?.email ?? undefined,
  }
}

export async function signOut(): Promise<void> {
  await clearAll()
  try {
    const sb = getSupabase()
    await sb.auth.signOut()
  } catch {
    // Ignore — tokens are already cleared
  }
}
