import { useState, useEffect, useCallback } from "react"
import { getAuthToken, setAuthToken, clearAuthToken, getDeviceHash, setDeviceHash } from "@/services/storage"
import * as api from "@/services/api"

type User = {
  id: string
  email: string
}

type AuthState = {
  user: User | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  })

  // Restore session on mount
  useEffect(() => {
    ;(async () => {
      try {
        const token = await getAuthToken()
        if (!token) {
          setState({ user: null, loading: false, error: null })
          return
        }
        const data = await api.getAccessStatus()
        if (data?.user) {
          setState({ user: data.user, loading: false, error: null })
        } else {
          await clearAuthToken()
          setState({ user: null, loading: false, error: null })
        }
      } catch {
        setState({ user: null, loading: false, error: null })
      }
    })()
  }, [])

  // Ensure device hash exists
  useEffect(() => {
    ;(async () => {
      const existing = await getDeviceHash()
      if (!existing) {
        const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0
          return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
        })
        await setDeviceHash(uuid)
      }
    })()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await api.login(email, password)
      if (data?.token) {
        await setAuthToken(data.token)
        setState({ user: data.user, loading: false, error: null })
        return true
      }
      setState((s) => ({ ...s, loading: false, error: data?.error || "Login failed" }))
      return false
    } catch (e: any) {
      setState((s) => ({ ...s, loading: false, error: e?.message || "Login failed" }))
      return false
    }
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await api.register(email, password)
      if (data?.token) {
        await setAuthToken(data.token)
        setState({ user: data.user, loading: false, error: null })
        return true
      }
      setState((s) => ({ ...s, loading: false, error: data?.error || "Registration failed" }))
      return false
    } catch (e: any) {
      setState((s) => ({ ...s, loading: false, error: e?.message || "Registration failed" }))
      return false
    }
  }, [])

  const logout = useCallback(async () => {
    await clearAuthToken()
    setState({ user: null, loading: false, error: null })
  }, [])

  return { ...state, login, register, logout }
}
