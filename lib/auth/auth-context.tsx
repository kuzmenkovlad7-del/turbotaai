"use client"

import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { isSupabaseBrowserConfigured, getSupabaseBrowser } from "@/lib/supabase/browser"

type AuthUser = {
  id?: string
  email: string
}

type AuthContextValue = {
  user: AuthUser | null
  isLoading: boolean
  isDemo: boolean
  signInWithPassword: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signUpWithPassword: (email: string, password: string, fullName?: string) => Promise<{ ok: boolean; error?: string; needsEmailConfirm?: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const DEMO_KEY = "turbotaai_demo_user"

async function syncServerToken(accessToken: string | null) {
  try {
    if (accessToken) {
      await fetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken }),
      })
    } else {
      await fetch("/api/auth/clear?scope=hard", { method: "POST" })
    }
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isDemo = !isSupabaseBrowserConfigured()

  useEffect(() => {
    if (isDemo) {
      try {
        const raw = window.localStorage.getItem(DEMO_KEY)
        if (raw) setUser(JSON.parse(raw))
      } catch {}
      setIsLoading(false)
      return
    }

    const supabase = getSupabaseBrowser()

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user
      setUser(u?.email ? { id: u.id, email: u.email } : null)
      setIsLoading(false)
      void syncServerToken(data.session?.access_token ?? null)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      setUser(u?.email ? { id: u.id, email: u.email } : null)
      void syncServerToken(session?.access_token ?? null)
    })

    return () => sub.subscription.unsubscribe()
  }, [isDemo])

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      isLoading,
      isDemo,
      signInWithPassword: async (email, password) => {
        if (isDemo) {
          const u = { email: (email || "guest@demo.turbotaai.com").trim() }
          setUser(u)
          window.localStorage.setItem(DEMO_KEY, JSON.stringify(u))
          return { ok: true }
        }

        try {
          const supabase = getSupabaseBrowser()
          const { data, error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) return { ok: false, error: error.message }
          const u = data.user
          setUser(u?.email ? { id: u.id, email: u.email } : null)
          return { ok: true }
        } catch (e: any) {
          return { ok: false, error: e?.message || "Sign-in failed" }
        }
      },
      signUpWithPassword: async (email, password, fullName) => {
        if (isDemo) {
          const u = { email: (email || "guest@demo.turbotaai.com").trim() }
          setUser(u)
          window.localStorage.setItem(DEMO_KEY, JSON.stringify(u))
          return { ok: true }
        }

        try {
          const supabase = getSupabaseBrowser()
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: fullName ? { full_name: fullName } : undefined,
            },
          })
          if (error) return { ok: false, error: error.message }
          // если включено подтверждение email, session может быть null
          const needsEmailConfirm = !data.session
          return { ok: true, needsEmailConfirm }
        } catch (e: any) {
          return { ok: false, error: e?.message || "Sign-up failed" }
        }
      },
      signOut: async () => {
        if (isDemo) {
          setUser(null)
          window.localStorage.removeItem(DEMO_KEY)
          await syncServerToken(null)
          return
        }
        try {
          const supabase = getSupabaseBrowser()
          await supabase.auth.signOut()
        } finally {
          setUser(null)
          await syncServerToken(null)
        }
      },
    }
  }, [user, isLoading, isDemo])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
