"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import Script from "next/script"
import { trackPageView, trackFbPageView, trackTtqPageView, updateTrackingDebug } from "@/lib/tracking"

const GA_ID = "G-RRMR2Y3VGJ"

// Pixel ID from env — falls back to the hardcoded production ID so builds
// work without the env var (same behaviour as GA_ID above).
const TIKTOK_PIXEL_ID =
  process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID?.trim() || "D6CUMBJC77U90IGSJR5G"

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

// ---------------------------------------------------------------------------
// Suppress "[Meta Pixel] - Invalid PixelID: null." from 3rd-party scripts.
// ---------------------------------------------------------------------------
if (typeof window !== "undefined") {
  const _pixelErrRe = /\[Meta Pixel\].*Invalid PixelID/
  const _origErr = console.error
  const _origWarn = console.warn
  console.error = function (...args: unknown[]) {
    if (typeof args[0] === "string" && _pixelErrRe.test(args[0])) return
    return _origErr.apply(console, args)
  }
  console.warn = function (...args: unknown[]) {
    if (typeof args[0] === "string" && _pixelErrRe.test(args[0])) return
    return _origWarn.apply(console, args)
  }
}

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
    dataLayer?: any[]
    fbq?: (...args: any[]) => void
    _fbq?: any
    __fbPixelInited?: boolean
    ttq?: {
      page: () => void
      track: (event: string, params?: Record<string, any>) => void
      load: (id: string, opts?: Record<string, any>) => void
      identify: (params: Record<string, any>) => void
      [key: string]: any
    }
    __ttqPixelInited?: boolean
    __trackingDebug?: {
      gaLoaded: boolean
      fbLoaded: boolean
      ttqLoaded: boolean
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
  if (id.length <= 4) return "***"
  return "***" + id.slice(-4)
}

export default function Analytics() {
  const pathname = usePathname()
  const prevPathRef = useRef<string | null>(null)
  const gaReadyRef = useRef(false)
  const fbInitRef = useRef(false)
  const ttqInitRef = useRef(false)

  // ── Init Meta Pixel once ─────────────────────────────────────────────────
  useEffect(() => {
    if (fbInitRef.current) return
    if (typeof window === "undefined") return

    fbInitRef.current = true

    if (!FB_PIXEL_ID) {
      window.__trackingDebug = {
        ...(window.__trackingDebug ?? { gaLoaded: false, fbLoaded: false, ttqLoaded: false }),
        pixelIdMasked: "(none)",
        pixelInitAttempted: true,
        pixelInitSuccess: false,
        pixelInitReason: "invalid_id",
      }
      log("fb pixel init skipped: invalid_id", RAW_PIXEL_ID)
      return
    }

    if (window.__fbPixelInited) {
      window.__trackingDebug = {
        ...(window.__trackingDebug ?? { gaLoaded: false, fbLoaded: false, ttqLoaded: false }),
        pixelIdMasked: maskPixelId(FB_PIXEL_ID),
        pixelInitAttempted: true,
        pixelInitSuccess: false,
        pixelInitReason: "already_initialized",
      }
      log("fb pixel init skipped: already_initialized")
      return
    }

    const f = window
    const b = document

    if (f.fbq) {
      f.fbq("init", FB_PIXEL_ID)
      f.fbq("track", "PageView")
      window.__fbPixelInited = true
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
      ...(window.__trackingDebug ?? { gaLoaded: false, fbLoaded: false, ttqLoaded: false }),
      pixelIdMasked: maskPixelId(FB_PIXEL_ID),
      pixelInitAttempted: true,
      pixelInitSuccess: true,
      pixelInitReason: "ok",
    }

    log("fb init + first PageView", maskPixelId(FB_PIXEL_ID))
  }, [])

  // ── Init TikTok Pixel once — fires ttq.page() for the first load ─────────
  // The <Script> tag below loads the stub + remote script.
  // This effect calls ttq.page() once after hydration.
  // SPA route changes are handled by the pathname effect below.
  useEffect(() => {
    if (ttqInitRef.current) return
    if (typeof window === "undefined") return
    if (window.__ttqPixelInited) return

    ttqInitRef.current = true
    window.__ttqPixelInited = true

    // ttq is a stub queue at this point — page() will be replayed when the
    // remote script loads.
    if (window.ttq?.page) {
      window.ttq.page()
      log("ttq first page()")
    }
  }, [])

  // ── Track SPA route changes ───────────────────────────────────────────────
  useEffect(() => {
    if (!pathname) return

    // Skip the very first render — init effects above handle the first load.
    if (prevPathRef.current === null) {
      prevPathRef.current = pathname
      return
    }

    if (pathname === prevPathRef.current) return
    prevPathRef.current = pathname

    trackPageView(pathname)
    trackFbPageView(pathname)
    trackTtqPageView(pathname)
  }, [pathname])

  // ── Debug helper — updates every 2s ──────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return
    updateTrackingDebug()
    const timer = window.setInterval(updateTrackingDebug, 2000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <>
      {/* GA4 */}
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

      {/* TikTok Pixel — stub queue init + async script load.
          ttq.page() is NOT called here; the useEffect above fires it once
          after hydration so React controls dedup. */}
      <Script
        id="tiktok-pixel-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(w,d,t){
              w.TiktokAnalyticsObject=t;
              var ttq=w[t]=w[t]||[];
              ttq.methods=["page","track","identify","instances","debug","on","off","once","ready",
                           "alias","group","enableCookie","disableCookie","holdConsent",
                           "revokeConsent","grantConsent"];
              ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
              for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
              ttq.instance=function(t){
                for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);
                return e;
              };
              ttq.load=function(e,n){
                var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;
                ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;
                ttq._t=ttq._t||{};ttq._t[e]=+new Date;
                ttq._o=ttq._o||{};ttq._o[e]=n||{};
                n=document.createElement("script");n.type="text/javascript";n.async=!0;
                n.src=r+"?sdkid="+e+"&lib="+t;
                e=document.getElementsByTagName("script")[0];
                e.parentNode.insertBefore(n,e);
              };
              ttq.load('${TIKTOK_PIXEL_ID}');
            }(window,document,'ttq');
          `,
        }}
      />

      {/* Meta Pixel noscript fallback */}
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
