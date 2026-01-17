import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing")
if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing")

export function getSupabaseServerClient() {
  const cookieStore = cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options })
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: "", ...options, maxAge: 0 })
      },
    },
  })
}

export function getOrCreateDeviceHash() {
  const cookieStore = cookies()
  let deviceHash = cookieStore.get("device_hash")?.value

  if (!deviceHash) {
    deviceHash = crypto.randomUUID()
    cookieStore.set("device_hash", deviceHash, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    })
  }

  return deviceHash
}
