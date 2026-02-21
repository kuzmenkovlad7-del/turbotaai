"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import Script from "next/script"
import { trackPageView, trackFbPageView, trackTtqPageView, updateTrackingDebug } from "@/lib/tracking"

const GA_ID = "G-RRMR2Y3VGJ"

// TikTok Pixel ID — env var overrides, hardcoded fallback guarantees it
// always ships even without the env var being set.
const TIKTOK_PIXEL_ID =
  (process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID ?? "").trim() || "D6CUMBJC77U90IGSJR5G"

const DEBUG = process.env.NEXT_PUBLIC_TRACKING_DEBUG === "true"

// ---------------------------------------------------------------------------
// Meta Pixel ID normalisation — reject "", "null", "undefined"
// ---------------------------------------------------------------------------
function normalisePixelId(raw: string | undefined): string | null {
  const trimmed = (raw ?? "").trim()
  if (!trimmed || /^(null|undefined)$/i.test(trimmed)) return null
  return trimmed
}

const FB_PIXEL_ID = normalisePixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID)

// ---------------------------------------------------------------------------
// Suppress "[Meta Pixel] - Invalid PixelID: null." emitted by 3rd-party scripts
// ---------------------------------------------------------------------------
if (typeof window !== "undefined") {
  const re = /\[Meta Pixel\].*Invalid PixelID/
  const _err = console.error
  const _warn = console.warn
  console.error = (...a: unknown[]) => { if (typeof a[0] === "string" && re.test(a[0])) return; _err.apply(console, a) }
  console.warn  = (...a: unknown[]) => { if (typeof a[0] === "string" && re.test(a[0])) return; _warn.apply(console, a) }
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
    __trackingDebug?: Record<string, unknown>
  }
}

function log(...args: any[]) {
  if (DEBUG) console.log("[tracking]", ...args)
}

function maskId(id: string | null) {
  if (!id) return "(none)"
  return id.length <= 4 ? "***" : `***${id.slice(-4)}`
}

export default function Analytics() {
  const pathname = usePathname()
  const prevPathRef = useRef<string | null>(null)
  const gaReadyRef = useRef(false)
  const fbInitRef  = useRef(false)

  // ── Meta Pixel: init once ────────────────────────────────────────────────
  useEffect(() => {
    if (fbInitRef.current || typeof window === "undefined" || !FB_PIXEL_ID) return
    if (window.__fbPixelInited) { fbInitRef.current = true; return }

    fbInitRef.current = true

    if (window.fbq) {
      window.fbq("init", FB_PIXEL_ID)
      window.fbq("track", "PageView")
      window.__fbPixelInited = true
      log("fb init (pre-existing fbq) + PageView", maskId(FB_PIXEL_ID))
      return
    }

    const n: any = (window.fbq = function (...a: any[]) {
      n.callMethod ? n.callMethod.apply(n, a) : n.queue.push(a)
    })
    if (!window._fbq) window._fbq = n
    n.push = n; n.loaded = true; n.version = "2.0"; n.queue = []
    const s = document.createElement("script")
    s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js"
    const f = document.getElementsByTagName("script")[0]
    f?.parentNode?.insertBefore(s, f)
    window.fbq("init", FB_PIXEL_ID)
    window.fbq("track", "PageView")
    window.__fbPixelInited = true
    log("fb init + PageView", maskId(FB_PIXEL_ID))
  }, [])

  // ── SPA route tracking — GA4 + Meta Pixel + TikTok ──────────────────────
  // First render is skipped: GA4 fires its own initial page_view via config,
  // Meta Pixel fires PageView in the init effect above, and TikTok fires
  // ttq.page() directly inside the <Script> snippet below.
  useEffect(() => {
    if (!pathname) return
    if (prevPathRef.current === null) {
      // Record starting path — do NOT fire; initial events are handled elsewhere.
      prevPathRef.current = pathname
      return
    }
    if (pathname === prevPathRef.current) return
    prevPathRef.current = pathname

    trackPageView(pathname)     // GA4
    trackFbPageView(pathname)   // Meta Pixel
    trackTtqPageView(pathname)  // TikTok
    log("route change → page views", pathname)
  }, [pathname])

  // ── Debug heartbeat ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return
    updateTrackingDebug()
    const t = window.setInterval(updateTrackingDebug, 2000)
    return () => window.clearInterval(t)
  }, [])

  // TikTok pixel snippet — inlined so it's present as soon as the
  // browser sees the string content. Build the snippet string separately
  // to keep template literals readable.
  const tiktokSnippet = `!function(w,d,t){
  w.TiktokAnalyticsObject=t;
  var ttq=w[t]=w[t]||[];
  ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
  ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
  for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
  ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
  ttq.load=function(e,n){
    var r="https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;
    ttq._t=ttq._t||{};ttq._t[e]=+new Date;
    ttq._o=ttq._o||{};ttq._o[e]=n||{};
    var s=document.createElement("script");
    s.type="text/javascript";s.async=!0;
    s.src=r+"?sdkid="+e+"&lib="+t;
    var f=document.getElementsByTagName("script")[0];
    f.parentNode.insertBefore(s,f);
  };
  ttq.load('${TIKTOK_PIXEL_ID}');
  ttq.page();
}(window,document,'ttq');`

  return (
    <>
      {/* GA4 loader */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
        onLoad={() => { gaReadyRef.current = true; log("ga4 loaded") }}
      />
      <Script
        id="ga4-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:true});`,
        }}
      />

      {/* TikTok Pixel — full official snippet including ttq.page() so the
          initial pageview is queued synchronously in the stub and replayed
          the moment the remote events.js script loads. No separate useEffect
          is needed for the first load; SPA navigation is handled above. */}
      <Script
        id="tiktok-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: tiktokSnippet }}
      />

      {/* Meta Pixel noscript fallback */}
      {FB_PIXEL_ID && (
        <noscript>
          <img
            height="1" width="1" style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
      )}
    </>
  )
}
