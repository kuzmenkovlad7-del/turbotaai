"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { User, Session } from "@supabase/supabase-js"
import { supabase, isSupabaseConfigured } from "@/lib/supabase-client"

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  authDisabled: boolean
  signIn: (email: string, password: string) => Promise<any>
  signUp: (email: string, password: string, username?: string) => Promise<any>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<any>
  updateProfile: (updates: { username?: string; avatar_url?: string | null }) => Promise<{ error?: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const authDisabled = !isSupabaseConfigured

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }

    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()
        if (error) {
          console.error("Error getting session:", error)
        } else {
          setSession(session)
          setUser(session?.user ?? null)
        }
      } catch (error) {
        console.error("Error in getInitialSession:", error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      try {
        subscription?.unsubscribe()
      } catch (error) {
        console.error("Error unsubscribing from auth changes:", error)
      }
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) {
      console.warn("Auth is disabled: Supabase not configured")
      return {
        data: null,
        error: new Error("Authentication is currently unavailable. Please configure Supabase."),
      }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { data, error }
    } catch (error) {
      console.error("Error signing in:", error)
      return { data: null, error }
    }
  }

  const signUp = async (email: string, password: string, username?: string) => {
    if (!isSupabaseConfigured || !supabase) {
      console.warn("Auth is disabled: Supabase not configured")
      return {
        data: null,
        error: new Error("Authentication is currently unavailable. Please configure Supabase."),
      }
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username || "",
          },
        },
      })
      return { data, error }
    } catch (error) {
      console.error("Error signing up:", error)
      return { data: null, error }
    }
  }

  const signOut = async () => {
    if (!isSupabaseConfigured || !supabase) {
      console.warn("Auth is disabled: Supabase not configured")
      return
    }

    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error("Error signing out:", error)
      }
    } catch (error) {
      console.error("Error in signOut:", error)
    }
  }

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured || !supabase) {
      console.warn("Auth is disabled: Supabase not configured")
      return {
        data: null,
        error: new Error("Authentication is currently unavailable. Please configure Supabase."),
      }
    }

    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email)
      return { data, error }
    } catch (error) {
      console.error("Error resetting password:", error)
      return { data: null, error }
    }
  }

  const updateProfile = async (updates: { username?: string; avatar_url?: string | null }) => {
    if (!isSupabaseConfigured || !supabase) {
      console.warn("Auth is disabled: Supabase not configured")
      return { error: new Error("Authentication is currently unavailable. Please configure Supabase.") }
    }

    try {
      if (!user) {
        return { error: new Error("No user logged in") }
      }

      const { data, error } = await supabase.auth.updateUser({
        data: {
          username: updates.username,
          avatar_url: updates.avatar_url,
        },
      })

      if (error) {
        return { error }
      }

      if (data.user) {
        setUser(data.user)
      }

      return { error: null }
    } catch (error) {
      console.error("Error updating profile:", error)
      return { error }
    }
  }

  const value = {
    user,
    session,
    loading,
    authDisabled,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
