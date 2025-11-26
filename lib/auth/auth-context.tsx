// lib/auth/auth-context.tsx
"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"

interface AuthUser {
  email: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signInDemo: (email: string) => Promise<void>
  signOutDemo: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  // Пробуем восстановить "демо-логин" из localStorage
  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem("demoUser") : null
      if (stored) {
        setUser(JSON.parse(stored))
      }
    } catch (e) {
      console.warn("Failed to read demo user from localStorage", e)
    }
  }, [])

  const signInDemo = async (email: string) => {
    setLoading(true)
    try {
      const demoUser = { email }
      setUser(demoUser)
      if (typeof window !== "undefined") {
        window.localStorage.setItem("demoUser", JSON.stringify(demoUser))
      }
    } finally {
      setLoading(false)
    }
  }

  const signOutDemo = async () => {
    setLoading(true)
    try {
      setUser(null)
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("demoUser")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInDemo, signOutDemo }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
