/**
 * Centralized tracking helpers for GA4 + Meta Pixel.
 *
 * Safe no-ops when gtag/fbq are not loaded.
 * All functions are client-side only — call from "use client" modules.
 */

const GA_ID = "G-RRMR2Y3VGJ"
const DEBUG = typeof window !== "undefined" && process.env.NEXT_PUBLIC_TRACKING_DEBUG === "true"

// ---------------------------------------------------------------------------
// Debug ring buffer
// ---------------------------------------------------------------------------

type DebugEntry = { event: string; ts: number; params?: Record<string, any> }

const MAX_EVENTS = 20
const _lastEvents: DebugEntry[] = []
const _counters: Record<string, number> = {}

function pushDebugEvent(event: string, params?: Record<string, any>) {
  const entry: DebugEntry = { event, ts: Date.now(), params }
  _lastEvents.push(entry)
  if (_lastEvents.length > MAX_EVENTS) _lastEvents.shift()
  _counters[event] = (_counters[event] || 0) + 1
}

/** Refresh window.__trackingDebug with current state */
export function updateTrackingDebug() {
  if (typeof window === "undefined") return
  const w = window as any
  const prev = w.__trackingDebug ?? {}
  w.__trackingDebug = {
    // Preserve pixel init fields written by Analytics component
    ...prev,
    gaLoaded: typeof w.gtag === "function",
    fbLoaded: typeof w.fbq === "function",
    lastEvents: _lastEvents.slice(),
    counters: { ..._counters },
  }
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(...args: any[]) {
  if (DEBUG) console.log("[tracking]", ...args)
}

// ---------------------------------------------------------------------------
// Low-level GA4 / FB helpers
// ---------------------------------------------------------------------------

function ga(eventName: string, params?: Record<string, any>) {
  const w = typeof window !== "undefined" ? (window as any) : null
  if (!w?.gtag) return
  w.gtag("event", eventName, params)
  log("ga4", eventName, params)
}

function fb(eventName: string, params?: Record<string, any>) {
  const w = typeof window !== "undefined" ? (window as any) : null
  if (!w?.fbq) {
    log("fb skip — fbq_missing", eventName)
    if (w) {
      w.__trackingDebug = { ...(w.__trackingDebug ?? {}), pixelInitReason: "fbq_missing" }
    }
    return
  }
  if (!w.__fbPixelInited) {
    log("fb skip — pixel not initialized", eventName)
    return
  }
  w.fbq("track", eventName, params)
  log("fb", eventName, params)
}

// ---------------------------------------------------------------------------
// Purchase dedup via sessionStorage
// ---------------------------------------------------------------------------

const PURCHASE_KEY = "ta_tracked_purchases"

function wasPurchaseTracked(txId: string): boolean {
  if (!txId || typeof sessionStorage === "undefined") return false
  try {
    const raw = sessionStorage.getItem(PURCHASE_KEY) || ""
    return raw.split(",").includes(txId)
  } catch {
    return false
  }
}

function markPurchaseTracked(txId: string) {
  if (!txId || typeof sessionStorage === "undefined") return
  try {
    const raw = sessionStorage.getItem(PURCHASE_KEY) || ""
    const ids = raw ? raw.split(",") : []
    ids.push(txId)
    // Keep last 50 to prevent unbounded growth
    sessionStorage.setItem(PURCHASE_KEY, ids.slice(-50).join(","))
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Public API — conversion events
// ---------------------------------------------------------------------------

/** Lead CTA click (e.g. "Talk to AI", "Start chat") */
export function trackLeadClick(label?: string) {
  const p = label ? { event_label: label } : undefined
  ga("generate_lead", p)
  fb("Lead", p)
  pushDebugEvent("lead_cta_click", p)
  updateTrackingDebug()
}

/** Contact form submitted successfully */
export function trackContactFormSubmit() {
  ga("generate_lead", { event_label: "contact_form" })
  fb("Lead", { content_name: "contact_form" })
  pushDebugEvent("contact_form_submit_success")
  updateTrackingDebug()
}

/** Signup succeeded */
export function trackSignup(method?: string) {
  ga("sign_up", method ? { method } : undefined)
  fb("CompleteRegistration")
  pushDebugEvent("signup_success", { method })
  updateTrackingDebug()
}

/** Login succeeded (GA only) */
export function trackLogin(method?: string) {
  ga("login", method ? { method } : undefined)
  pushDebugEvent("login_success", { method })
  updateTrackingDebug()
}

/** User initiates checkout */
export function trackCheckoutStart(params?: { value?: number; currency?: string }) {
  ga("begin_checkout", params)
  fb("InitiateCheckout", params)
  pushDebugEvent("checkout_start", params)
  updateTrackingDebug()
}

/** User submits payment info (redirected to payment page) */
export function trackAddPaymentInfo(params?: { value?: number; currency?: string }) {
  ga("add_payment_info", params)
  fb("AddPaymentInfo", params)
  pushDebugEvent("add_payment_info", params)
  updateTrackingDebug()
}

/** Purchase confirmed — deduped by transaction_id */
export function trackPurchase(params: {
  transaction_id: string
  value: number
  currency: string
}) {
  if (wasPurchaseTracked(params.transaction_id)) {
    log("purchase already tracked", params.transaction_id)
    return
  }
  markPurchaseTracked(params.transaction_id)

  ga("purchase", {
    transaction_id: params.transaction_id,
    value: params.value,
    currency: params.currency,
  })
  fb("Purchase", {
    value: params.value,
    currency: params.currency,
    content_ids: [params.transaction_id],
  })
  pushDebugEvent("purchase_success", params)
  updateTrackingDebug()
}

/** Trial started */
export function trackTrialStart() {
  ga("start_trial")
  fb("StartTrial")
  pushDebugEvent("trial_start")
  updateTrackingDebug()
}

/** GA4 page_view (used by Analytics component) */
export function trackPageView(path: string) {
  const w = typeof window !== "undefined" ? (window as any) : null
  if (!w?.gtag) return
  w.gtag("config", GA_ID, { page_path: path })
  log("ga4 page_view", path)
}

/** Meta Pixel PageView (used by Analytics component) */
export function trackFbPageView(path: string) {
  const w = typeof window !== "undefined" ? (window as any) : null
  if (!w?.fbq) {
    log("fb PageView skip — fbq_missing", path)
    if (w) {
      w.__trackingDebug = { ...(w.__trackingDebug ?? {}), pixelInitReason: "fbq_missing" }
    }
    return
  }
  if (!w.__fbPixelInited) {
    log("fb PageView skip — pixel not initialized", path)
    return
  }
  w.fbq("track", "PageView")
  log("fb PageView", path)
}
