import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react"
import { AppState, type AppStateStatus } from "react-native"
import { ensureDeviceHash } from "@/services/storage"
import { signIn, signUp, signOut, refreshSession, isSupabaseConfigured, type AuthResult } from "@/services/supabase"
import { bootstrap, type BootstrapData } from "@/services/api"
import { logEvent } from "@/services/analytics"

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

export type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<AuthResult>
  register: (email: string, password: string) => Promise<AuthResult>
  logout: () => Promise<void>
  refreshAccess: () => Promise<void>
  retryBootstrap: () => Promise<void>
  /**
   * Optimistically decrement trial_questions_left by 1 in local state.
   *
   * Call this after each successful AI reply while the user is on trial so
   * the displayed count stays in sync without waiting for the next bootstrap
   * round-trip. When trialLeft reaches 0, access transitions to "none"
   * immediately — the locked paywall is shown on the next render.
   */
  decrementTrialLeft: () => void
  /**
   * Optimistically apply promo access using the `promo_until` value returned
   * by `redeemPromo()`. Updates local state immediately so every screen
   * (Home badge, Chat, Voice, Video) reflects the new access without waiting
   * for the background bootstrap round-trip to complete.
   */
  setAccessFromPromo: (promoUntil: string) => void
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

const NOOP_RESULT: AuthResult = { ok: false, error: "AuthContext not initialised" }
const NOOP_ASYNC = async () => {}

export const AuthContext = createContext<AuthContextValue>({
  ready: false,
  user: null,
  accessInfo: null,
  error: null,
  loading: false,
  bootstrapFailed: false,
  login: async () => NOOP_RESULT,
  register: async () => NOOP_RESULT,
  logout: NOOP_ASYNC,
  refreshAccess: NOOP_ASYNC,
  retryBootstrap: NOOP_ASYNC,
  decrementTrialLeft: () => {},
  setAccessFromPromo: () => {},
})

/**
 * Run inside AuthContext.Provider (App.tsx).
 * Exposes a single shared auth + access state for the whole app.
 */
export function useAuthProvider(): AuthContextValue {
  const [state, setState] = useState<AuthState>({
    ready: false,
    user: null,
    accessInfo: null,
    error: null,
    loading: false,
    bootstrapFailed: false,
  })
  const mounted = useRef(true)
  const bootstrapping = useRef(false)
  /**
   * Set to true when refreshAccess() is called while a bootstrap is already
   * in progress. The in-flight bootstrap will re-run once it finishes so the
   * most recent server state (e.g. after promo apply) is always reflected.
   */
  const pendingRefresh = useRef(false)
  /**
   * Incremented every time an optimistic access update is written locally
   * (setAccessFromPromo, decrementTrialLeft). runBootstrap captures this at
   * the moment the network request starts; if the value has changed by the
   * time the response arrives, the server snapshot pre-dates the local change
   * and must be discarded to avoid overwriting the optimistic state.
   */
  const optimisticVersionRef = useRef(0)
  /**
   * Resolve/reject callbacks queued by callers that hit runBootstrap while
   * another bootstrap was already in-flight. Each entry is settled once the
   * next bootstrap completes, so `await refreshAccess()` in UI handlers
   * (e.g. the "Refresh Access" button) waits for genuinely fresh data.
   */
  const bootstrapListenersRef = useRef<Array<{ resolve: () => void; reject: (err: unknown) => void }>>([])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const runBootstrap = useCallback(async () => {
    // Snapshot the optimistic version before any await so we can detect whether
    // setAccessFromPromo / decrementTrialLeft ran while the request was in-flight.
    const snapshotVersion = optimisticVersionRef.current

    if (bootstrapping.current) {
      // A bootstrap is already in-flight; queue a follow-up so the latest
      // server state (e.g. after promo apply) is reflected once it finishes.
      pendingRefresh.current = true
      // Return a promise that resolves/rejects when the NEXT bootstrap finishes.
      // This makes `await refreshAccess()` in UI handlers (e.g. "Refresh Access"
      // button) wait for genuinely fresh data rather than returning immediately.
      return new Promise<void>((resolve, reject) => {
        bootstrapListenersRef.current.push({ resolve, reject })
      })
    }
    bootstrapping.current = true
    pendingRefresh.current = false
    try {
      await ensureDeviceHash()
      const data: BootstrapData = await bootstrap()
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
        promoUntil: data.promo_until ?? null,
        subscriptionStatus: data.subscription_status ?? null,
        autoRenew: data.auto_renew ?? false,
      }

      setState(s => {
        // Guard against stale-bootstrap overwrite: if setAccessFromPromo or
        // decrementTrialLeft ran after this request was dispatched, our server
        // snapshot pre-dates the local change.  Discarding it prevents reverting
        // the optimistic state (e.g. "Promo applied" flash-back to trial UI).
        if (optimisticVersionRef.current !== snapshotVersion) return s
        return {
          ...s,
          ready: true,
          user: user ?? s.user,
          accessInfo,
          error: null,
          bootstrapFailed: false,
        }
      })
    } catch (e: any) {
      if (!mounted.current) return
      setState(s => ({
        ...s,
        ready: true,
        error: e?.message,
        bootstrapFailed: true,
        accessInfo: s.accessInfo ?? EMPTY_ACCESS,
      }))
      // Notify any waiting callers (e.g. "Refresh Access" button) of the failure
      // so their awaited promise rejects and they can show an inline error.
      bootstrapListenersRef.current.splice(0).forEach(({ reject }) => reject(e))
      throw e
    } finally {
      bootstrapping.current = false
      // Resolve any remaining listeners (success path — catch block did not run).
      bootstrapListenersRef.current.splice(0).forEach(({ resolve }) => resolve())
      // If refreshAccess() was called while we were running, fetch again
      // immediately so the caller's state change (e.g. promo applied) is
      // picked up without requiring a manual retry or app restart.
      if (pendingRefresh.current && mounted.current) {
        pendingRefresh.current = false
        runBootstrap()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const retryBootstrap = useCallback(async () => {
    setState(s => ({ ...s, error: null, bootstrapFailed: false }))
    try {
      await runBootstrap()
    } catch {
      // state already has bootstrapFailed:true set inside runBootstrap's catch
    }
  }, [runBootstrap])

  // On mount: refresh session then bootstrap
  useEffect(() => {
    ;(async () => {
      try {
        if (!isSupabaseConfigured()) {
          console.warn("[useAuth] Supabase env vars not configured")
        }
        await ensureDeviceHash()
        const refreshResult = await refreshSession().catch(() => ({ ok: false } as AuthResult))
        if (refreshResult.ok && refreshResult.userId && refreshResult.email && mounted.current) {
          setState(s => ({ ...s, user: { id: refreshResult.userId!, email: refreshResult.email! } }))
        }
        await runBootstrap()
      } catch (e: any) {
        if (mounted.current) {
          setState(s => ({
            ...s,
            ready: true,
            error: e?.message,
            bootstrapFailed: true,
            accessInfo: s.accessInfo ?? EMPTY_ACCESS,
          }))
        }
      }
    })()
  }, [runBootstrap])

  // Refresh when app returns from background
  useEffect(() => {
    const appStateRef = { current: AppState.currentState }
    const subscription = AppState.addEventListener("change", async (next: AppStateStatus) => {
      const prev = appStateRef.current
      appStateRef.current = next
      if (prev.match(/inactive|background/) && next === "active" && mounted.current) {
        try {
          const result = await refreshSession().catch(() => ({ ok: false } as AuthResult))
          if (result.ok && result.userId && result.email && mounted.current) {
            setState(s => ({ ...s, user: { id: result.userId!, email: result.email! } }))
          }
          await runBootstrap()
        } catch {
          // silent — next foreground attempt will retry
        }
      }
    })
    return () => subscription.remove()
  }, [runBootstrap])

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      if (!isSupabaseConfigured()) {
        const err = "Supabase is not configured. Check .env file."
        if (mounted.current) setState(s => ({ ...s, loading: false, error: err }))
        return { ok: false, error: err }
      }
      const result = await signIn(email, password)
      if (result.ok) {
        logEvent("login", { method: "email" })
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
      if (mounted.current) setState(s => ({ ...s, loading: false, error: msg }))
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
      const result = await signUp(email, password)
      if (result.ok && !result.error) {
        logEvent("register", { method: "email" })
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
      if (mounted.current) setState(s => ({ ...s, loading: false, error: msg }))
      return { ok: false, error: msg }
    }
  }, [runBootstrap])

  const logout = useCallback(async () => {
    try {
      await signOut()
    } catch {
      // silent
    }
    if (mounted.current) {
      setState({ ready: true, user: null, accessInfo: EMPTY_ACCESS, error: null, loading: false, bootstrapFailed: false })
    }
  }, [])

  const decrementTrialLeft = useCallback(() => {
    // Bump version so any in-flight bootstrap cannot overwrite the local decrement
    // with a stale server count (e.g. bootstrap started before the message was sent).
    optimisticVersionRef.current += 1
    setState((s) => {
      if (!s.accessInfo || s.accessInfo.access !== "trial") return s
      const newLeft = Math.max(0, s.accessInfo.trialLeft - 1)
      return {
        ...s,
        accessInfo: {
          ...s.accessInfo,
          trialLeft: newLeft,
          // Mirror the web: when questions run out, access becomes "none"
          access: newLeft > 0 ? "trial" : "none",
          hasAccess: newLeft > 0,
        },
      }
    })
  }, [])

  const setAccessFromPromo = useCallback((promoUntil: string) => {
    // Bump version so any in-flight bootstrap (started before the promo was applied)
    // cannot overwrite this optimistic update with stale server data.
    optimisticVersionRef.current += 1
    setState((s) => {
      if (!s.accessInfo) return s
      return {
        ...s,
        accessInfo: {
          ...s.accessInfo,
          access: "promo" as const,
          hasAccess: true,
          unlimited: true,
          promoUntil,
        },
      }
    })
  }, [])

  return {
    ...state,
    login,
    register,
    logout,
    refreshAccess: runBootstrap,
    retryBootstrap,
    decrementTrialLeft,
    setAccessFromPromo,
  }
}

/**
 * Consume the shared auth context.
 * All screens share the same state — refreshAccess() updates every consumer.
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
