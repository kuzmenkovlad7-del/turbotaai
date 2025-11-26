"use client"

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type AuthUser = {
  email: string
}

type AuthContextValue = {
  user: AuthUser | null
  isLoading: boolean
  signInDemo: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const STORAGE_KEY = "turbotaai_demo_user"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Читаем демо-юзера из localStorage
  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as AuthUser
        if (parsed?.email) {
          setUser(parsed)
        }
      }
    } catch {
      // игнорируем ошибки парсинга
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signInDemo = async (email: string) => {
    const trimmed = email.trim() || "guest@demo.turbotaai.com"
    const u: AuthUser = { email: trimmed }

    setUser(u)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    }
  }

  const signOut = async () => {
    setUser(null)
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }

  const value: AuthContextValue = {
    user,
    isLoading,
    signInDemo,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
