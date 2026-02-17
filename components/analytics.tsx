"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import Script from "next/script"
import { trackPageView, trackFbPageView, updateTrackingDebug } from "@/lib/tracking"

const GA_ID = "G-RRMR2Y3VGJ"
const DEBUG = process.env.NEXT_PUBLIC_TRACKING_DEBUG === "true"

// ---------------------------------------------------------------------------
// Pixel ID normalisation — reject "", "null", "undefined" (case-insensitive)
// ---------------------------------------------------------------------------
function normalisePixelId(raw: string | undefined): string | null {
  const trimmed = (raw ?? "").trim()
  if (!trimmed) return null
  if (/^(null|undefined)$/i.test(trimmed)) return null
  return trimmed
}

const RAW_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const FB_PIXEL_ID = normalisePixelId(RAW_PIXEL_ID)

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
    dataLayer?: any[]
    fbq?: (...args: any[]) => void
    _fbq?: any
    __fbPixelInited?: boolean
    __trackingDebug?: {
      gaLoaded: boolean
      fbLoaded: boolean
      lastEvents?: any[]
      counters?: Record<string, number>
      pixelIdMasked?: string
      pixelInitAttempted?: boolean
      pixelInitSuccess?: boolean
      pixelInitReason?: "invalid_id" | "already_initialized" | "ok" | "fbq_missing"
    }
  }
}

function log(...args: any[]) {
  if (DEBUG) console.log("[tracking]", ...args)
}

function maskPixelId(id: string | null): string {
  if (!id) return "(none)"
  if (id.length <= 6) return "***"
  return id.slice(0, 3) + "***" + id.slice(-3)
}

export default function Analytics() {
  const pathname = usePathname()
  const prevPathRef = useRef<string | null>(null)
  const gaReadyRef = useRef(false)
  const fbInitRef = useRef(false)

  // Init Meta Pixel once — guarded by ref AND global flag
  useEffect(() => {
    if (fbInitRef.current) return
    if (typeof window === "undefined") return

    fbInitRef.current = true

    // Reject invalid pixel IDs before touching fbq
    if (!FB_PIXEL_ID) {
      window.__trackingDebug = {
        ...(window.__trackingDebug ?? { gaLoaded: false, fbLoaded: false }),
        pixelIdMasked: "(none)",
        pixelInitAttempted: true,
        pixelInitSuccess: false,
        pixelInitReason: "invalid_id",
      }
      log("fb pixel init skipped: invalid_id", RAW_PIXEL_ID)
      return
    }

    // Prevent double-init across React re-mounts (e.g. Strict Mode, HMR)
    if (window.__fbPixelInited) {
      window.__trackingDebug = {
        ...(window.__trackingDebug ?? { gaLoaded: false, fbLoaded: false }),
        pixelIdMasked: maskPixelId(FB_PIXEL_ID),
        pixelInitAttempted: true,
        pixelInitSuccess: false,
        pixelInitReason: "already_initialized",
      }
      log("fb pixel init skipped: already_initialized")
      return
    }

    // Standard Meta Pixel snippet (minified)
    const f = window
    const b = document

    if (f.fbq) {
      // fbq exists from another script — just init with our ID
      f.fbq("init", FB_PIXEL_ID)
      f.fbq("track", "PageView")
      window.__fbPixelInited = true
      window.__trackingDebug = {
        ...(window.__trackingDebug ?? { gaLoaded: false, fbLoaded: false }),
        pixelIdMasked: maskPixelId(FB_PIXEL_ID),
        pixelInitAttempted: true,
        pixelInitSuccess: true,
        pixelInitReason: "ok",
      }
      log("fb init (fbq already existed) + first PageView", maskPixelId(FB_PIXEL_ID))
      return
    }

    const n: any = (f.fbq = function (...args: any[]) {
      if (n.callMethod) {
        n.callMethod.apply(n, args)
      } else {
        n.queue.push(args)
      }
    })
    if (!f._fbq) f._fbq = n
    n.push = n
    n.loaded = true
    n.version = "2.0"
    n.queue = []

    const s = b.createElement("script")
    s.async = true
    s.src = "https://connect.facebook.net/en_US/fbevents.js"
    const firstScript = b.getElementsByTagName("script")[0]
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(s, firstScript)
    }

    window.fbq!("init", FB_PIXEL_ID)
    window.fbq!("track", "PageView")
    window.__fbPixelInited = true

    window.__trackingDebug = {
      ...(window.__trackingDebug ?? { gaLoaded: false, fbLoaded: false }),
      pixelIdMasked: maskPixelId(FB_PIXEL_ID),
      pixelInitAttempted: true,
      pixelInitSuccess: true,
      pixelInitReason: "ok",
    }

    log("fb init + first PageView", maskPixelId(FB_PIXEL_ID))
  }, [])

  // Track SPA route changes
  useEffect(() => {
    if (!pathname) return

    // Skip the very first render — GA4 handles it via config load,
    // and Meta Pixel fires PageView on init above.
    if (prevPathRef.current === null) {
      prevPathRef.current = pathname
      return
    }

    // Only fire on actual path changes (not re-renders)
    if (pathname === prevPathRef.current) return
    prevPathRef.current = pathname

    trackPageView(pathname)
    trackFbPageView(pathname)
  }, [pathname])

  // Debug helper — updates every 2s
  useEffect(() => {
    if (typeof window === "undefined") return
    updateTrackingDebug()
    const timer = window.setInterval(updateTrackingDebug, 2000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <>
      {/* GA4 — gtag.js loaded via next/script for optimal performance */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
        onLoad={() => {
          gaReadyRef.current = true
          log("ga4 script loaded")
        }}
      />
      <Script
        id="ga4-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer=window.dataLayer||[];
            function gtag(){dataLayer.push(arguments);}
            gtag('js',new Date());
            gtag('config','${GA_ID}',{send_page_view:true});
          `,
        }}
      />

      {/* Meta Pixel noscript fallback — only rendered when pixel ID is valid */}
      {FB_PIXEL_ID && (
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
      )}
    </>
  )
}
