import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

const DEVICE_COOKIE = "device_hash"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({
    request: { headers: req.headers },
  })

  // гарантируем стабильный device_hash (иначе будут плодиться access_grants)
  const existing = req.cookies.get(DEVICE_COOKIE)?.value
  if (!existing) {
    res.cookies.set({
      name: DEVICE_COOKIE,
      value: crypto.randomUUID(),
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  // синхронизация Supabase auth cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options, maxAge: 0 })
        },
      },
    }
  )

  await supabase.auth.getUser()
  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
