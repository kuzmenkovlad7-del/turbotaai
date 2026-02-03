import { useState, useEffect, useCallback, useRef } from "react"
import { ensureDeviceHash } from "@/services/storage"
import { signIn, signUp, signOut, refreshSession, type AuthResult } from "@/services/supabase"
import { bootstrap, type BootstrapData } from "@/services/api"

export type AccessInfo = {
  access: "paid" | "promo" | "trial" | "none"
  hasAccess: boolean
  unlimited: boolean
  trialLeft: number
  paidUntil: string | null
  subscriptionStatus: string | null
}

type AuthState = {
  ready: boolean          // bootstrap completed (show splash until true)
  user: { id: string; email: string } | null
  accessInfo: AccessInfo | null
  error: string | null
  loading: boolean
}

const EMPTY_ACCESS: AccessInfo = {
  access: "none",
  hasAccess: false,
  unlimited: false,
  trialLeft: 0,
  paidUntil: null,
  subscriptionStatus: null,
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    ready: false,
    user: null,
    accessInfo: null,
    error: null,
    loading: false,
  })
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const runBootstrap = useCallback(async () => {
    try {
      await ensureDeviceHash()
      const data = await bootstrap()
      if (!mounted.current) return
      const user = data.isLoggedIn && data.userId && data.email
        ? { id: data.userId, email: data.email }
        : null
      const accessInfo: AccessInfo = {
        access: data.access ?? "none",
        hasAccess: data.hasAccess ?? false,
        unlimited: data.unlimited ?? false,
        trialLeft: data.trial_questions_left ?? 0,
        paidUntil: data.paid_until ?? null,
        subscriptionStatus: data.subscription_status ?? null,
      }
      setState(s => ({ ...s, ready: true, user, accessInfo, error: null }))
    } catch (e: any) {
      if (!mounted.current) return
      setState(s => ({ ...s, ready: true, error: e?.message }))
    }
  }, [])

  // On mount: try refresh then bootstrap
  useEffect(() => {
    ;(async () => {
      await ensureDeviceHash()
      // Try to refresh existing session silently
      await refreshSession().catch(() => {})
      await runBootstrap()
    })()
  }, [runBootstrap])

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    setState(s => ({ ...s, loading: true, error: null }))
    const result = await signIn(email, password)
    if (result.ok) {
      await runBootstrap()
    }
    if (mounted.current) {
      setState(s => ({ ...s, loading: false, error: result.ok ? null : (result.error ?? null) }))
    }
    return result
  }, [runBootstrap])

  const register = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    setState(s => ({ ...s, loading: true, error: null }))
    const result = await signUp(email, password)
    if (result.ok && !result.error) {
      // Session created — bootstrap
      await runBootstrap()
    }
    if (mounted.current) {
      setState(s => ({ ...s, loading: false, error: result.error ?? null }))
    }
    return result
  }, [runBootstrap])

  const logout = useCallback(async () => {
    await signOut()
    if (mounted.current) {
      setState({ ready: true, user: null, accessInfo: EMPTY_ACCESS, error: null, loading: false })
    }
  }, [])

  return {
    ...state,
    login,
    register,
    logout,
    refreshAccess: runBootstrap,
  }
}
