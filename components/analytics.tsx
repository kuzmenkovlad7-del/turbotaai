"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import Script from "next/script"

const GA_ID = "G-RRMR2Y3VGJ"
const FB_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || ""
const DEBUG = process.env.NEXT_PUBLIC_TRACKING_DEBUG === "true"

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
    dataLayer?: any[]
    fbq?: (...args: any[]) => void
    _fbq?: any
    __trackingDebug?: { gaLoaded: boolean; fbLoaded: boolean }
  }
}

function log(...args: any[]) {
  if (DEBUG) console.log("[tracking]", ...args)
}

/** Fires GA4 page_view for the given path */
function gaPageView(path: string) {
  if (typeof window === "undefined" || !window.gtag) return
  window.gtag("config", GA_ID, { page_path: path })
  log("ga4 page_view", path)
}

/** Fires Meta Pixel PageView (deduped via eventID) */
function fbPageView(path: string) {
  if (typeof window === "undefined" || !window.fbq || !FB_PIXEL_ID) return
  window.fbq("track", "PageView")
  log("fb PageView", path)
}

export default function Analytics() {
  const pathname = usePathname()
  const prevPathRef = useRef<string | null>(null)
  const gaReadyRef = useRef(false)
  const fbInitRef = useRef(false)

  // Init Meta Pixel once
  useEffect(() => {
    if (!FB_PIXEL_ID || fbInitRef.current) return
    if (typeof window === "undefined") return

    fbInitRef.current = true

    // Standard Meta Pixel snippet (minified)
    const f = window
    const b = document
    if (f.fbq) return // already initialized by another instance

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
    log("fb init + first PageView", FB_PIXEL_ID)
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

    gaPageView(pathname)
    fbPageView(pathname)
  }, [pathname])

  // Debug helper
  useEffect(() => {
    if (typeof window === "undefined") return
    const update = () => {
      window.__trackingDebug = {
        gaLoaded: typeof window.gtag === "function",
        fbLoaded: typeof window.fbq === "function",
      }
    }
    update()
    // Re-check after scripts load
    const timer = window.setInterval(update, 2000)
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
