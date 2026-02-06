import { useState, useEffect, useCallback, useRef } from "react"
import { ensureDeviceHash } from "@/services/storage"
import { signIn, signUp, signOut, refreshSession, isSupabaseConfigured, type AuthResult } from "@/services/supabase"
import { bootstrap, type BootstrapData } from "@/services/api"

export type AccessInfo = {
  access: "paid" | "promo" | "trial" | "none"
  hasAccess: boolean
  unlimited: boolean
  trialLeft: number
  paidUntil: string | null
  promoUntil: string | null
  subscriptionStatus: string | null
  autoRenew: boolean
}

type AuthState = {
  ready: boolean          // bootstrap completed (show splash until true)
  user: { id: string; email: string } | null
  accessInfo: AccessInfo | null
  error: string | null
  loading: boolean
  bootstrapFailed: boolean
}

const EMPTY_ACCESS: AccessInfo = {
  access: "none",
  hasAccess: false,
  unlimited: false,
  trialLeft: 0,
  paidUntil: null,
  promoUntil: null,
  subscriptionStatus: null,
  autoRenew: false,
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    ready: false,
    user: null,
    accessInfo: null,
    error: null,
    loading: false,
    bootstrapFailed: false,
  })
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const runBootstrap = useCallback(async () => {
    try {
      console.log("[useAuth] bootstrap start")
      await ensureDeviceHash()
      const data = await bootstrap()
      if (!mounted.current) return
      console.log("[useAuth] bootstrap ok, logged_in=", data.isLoggedIn)
      const user = data.isLoggedIn && data.userId && data.email
        ? { id: data.userId, email: data.email }
        : null
      const accessInfo: AccessInfo = {
        access: data.access ?? "none",
        hasAccess: data.hasAccess ?? false,
        unlimited: data.unlimited ?? false,
        trialLeft: data.trial_questions_left ?? 0,
        paidUntil: data.paid_until ?? null,
        promoUntil: data.promo_until ?? null,
        subscriptionStatus: data.subscription_status ?? null,
        autoRenew: data.auto_renew ?? false,
      }
      setState(s => ({ ...s, ready: true, user: user ?? s.user, accessInfo, error: null, bootstrapFailed: false }))
    } catch (e: any) {
      if (!mounted.current) return
      console.warn("[useAuth] bootstrap failed:", e?.message)
      setState(s => ({ ...s, ready: true, error: e?.message, bootstrapFailed: true }))
    }
  }, [])

  const retryBootstrap = useCallback(async () => {
    setState(s => ({ ...s, error: null, bootstrapFailed: false }))
    await runBootstrap()
  }, [runBootstrap])

  // On mount: try refresh then bootstrap
  useEffect(() => {
    ;(async () => {
      try {
        if (!isSupabaseConfigured()) {
          console.warn("[useAuth] Supabase env vars not configured")
        }
        await ensureDeviceHash()
        const refreshResult = await refreshSession().catch(() => ({ ok: false } as AuthResult))
        console.log("[useAuth] session refresh:", refreshResult.ok ? "restored" : "no session")
        await runBootstrap()
      } catch (e: any) {
        console.warn("[useAuth] init error:", e?.message)
        if (mounted.current) {
          setState(s => ({ ...s, ready: true, error: e?.message, bootstrapFailed: true }))
        }
      }
    })()
  }, [runBootstrap])

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      if (!isSupabaseConfigured()) {
        const err = "Supabase is not configured. Check .env file."
        if (mounted.current) setState(s => ({ ...s, loading: false, error: err }))
        return { ok: false, error: err }
      }
      console.log("[useAuth] login attempt:", email)
      const result = await signIn(email, password)
      console.log("[useAuth] login result:", result.ok, result.error ?? "")
      if (result.ok) {
        // Set user immediately from signIn data so navigator transitions
        // even if the subsequent bootstrap call is slow or fails
        if (mounted.current && result.userId && result.email) {
          setState(s => ({ ...s, user: { id: result.userId!, email: result.email! } }))
        }
        await runBootstrap()
      }
      if (mounted.current) {
        setState(s => ({ ...s, loading: false, error: result.ok ? s.error : (result.error ?? null) }))
      }
      return result
    } catch (e: any) {
      const msg = e?.message || "Login failed unexpectedly"
      console.warn("[useAuth] login error:", msg)
      if (mounted.current) {
        setState(s => ({ ...s, loading: false, error: msg }))
      }
      return { ok: false, error: msg }
    }
  }, [runBootstrap])

  const register = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      if (!isSupabaseConfigured()) {
        const err = "Supabase is not configured. Check .env file."
        if (mounted.current) setState(s => ({ ...s, loading: false, error: err }))
        return { ok: false, error: err }
      }
      console.log("[useAuth] register attempt:", email)
      const result = await signUp(email, password)
      console.log("[useAuth] register result:", result.ok, result.error ?? "")
      if (result.ok && !result.error) {
        // Set user immediately so navigator transitions without waiting for bootstrap
        if (mounted.current && result.userId && result.email) {
          setState(s => ({ ...s, user: { id: result.userId!, email: result.email! } }))
        }
        await runBootstrap()
      }
      if (mounted.current) {
        setState(s => ({ ...s, loading: false, error: result.error ?? s.error }))
      }
      return result
    } catch (e: any) {
      const msg = e?.message || "Registration failed unexpectedly"
      console.warn("[useAuth] register error:", msg)
      if (mounted.current) {
        setState(s => ({ ...s, loading: false, error: msg }))
      }
      return { ok: false, error: msg }
    }
  }, [runBootstrap])

  const logout = useCallback(async () => {
    try {
      console.log("[useAuth] logout")
      await signOut()
    } catch (e: any) {
      console.warn("[useAuth] logout error:", e?.message)
    }
    if (mounted.current) {
      setState({ ready: true, user: null, accessInfo: EMPTY_ACCESS, error: null, loading: false, bootstrapFailed: false })
    }
  }, [])

  return {
    ...state,
    login,
    register,
    logout,
    refreshAccess: runBootstrap,
    retryBootstrap,
  }
}
