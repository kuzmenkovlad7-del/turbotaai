import { NextRequest, NextResponse } from "next/server"

const DEVICE_COOKIE = "ta_device_hash"
const REGION_COOKIE = "ta_region"
const LANG_COOKIE = "ta_lang"

function cookieDomain(host: string | null) {
  const h = String(host || "").toLowerCase()
  if (h === "turbotaai.com" || h.endsWith(".turbotaai.com")) return ".turbotaai.com"
  return undefined
}

function detectCountry(req: NextRequest): string | null {
  // Vercel
  const vc = req.headers.get("x-vercel-ip-country")
  if (vc) return vc.toUpperCase()
  // Cloudflare
  const cf = req.headers.get("cf-ipcountry")
  if (cf && cf !== "XX") return cf.toUpperCase()
  // Generic
  const gc = req.headers.get("x-country-code")
  if (gc) return gc.toUpperCase()
  // Next.js geo (available on some platforms)
  const geo = (req as any).geo?.country
  if (geo) return String(geo).toUpperCase()
  return null
}

export function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const domain = cookieDomain(req.headers.get("host"))
  const secure = req.nextUrl.protocol === "https:"
  const cookieOpts = { httpOnly: false, sameSite: "lax" as const, secure, path: "/", maxAge: 60 * 60 * 24 * 365, domain }

  // 1. Device hash
  const existing = req.cookies.get(DEVICE_COOKIE)?.value
  if (!existing) {
    res.cookies.set({ name: DEVICE_COOKIE, value: crypto.randomUUID(), ...cookieOpts })
  }

  // 2. Region detection — set once, never overwrite
  let region = req.cookies.get(REGION_COOKIE)?.value || null

  // Allow debug override via ?ta_region=UA or ?ta_region=INTL
  const debugRegion = req.nextUrl.searchParams.get("ta_region")
  if (debugRegion === "UA" || debugRegion === "INTL") {
    region = debugRegion
    res.cookies.set({ name: REGION_COOKIE, value: region, ...cookieOpts })
  }

  if (!region) {
    const country = detectCountry(req)
    region = country === "UA" ? "UA" : "INTL"
    res.cookies.set({ name: REGION_COOKIE, value: region, ...cookieOpts })
  }

  // 3. Default language — only if user has no saved preference
  const hasLangPref = req.cookies.get(LANG_COOKIE)?.value
  if (!hasLangPref) {
    const defaultLang = region === "UA" ? "uk" : "en"
    res.cookies.set({ name: LANG_COOKIE, value: defaultLang, ...cookieOpts })
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
