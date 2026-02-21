/**
 * Centralized tracking helpers for GA4 + Meta Pixel + TikTok Pixel.
 *
 * Safe no-ops when gtag/fbq/ttq are not loaded.
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
    ttqLoaded: typeof w.ttq === "function",
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
// Low-level GA4 / Meta Pixel / TikTok helpers
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

/** TikTok Pixel — safe no-op when ttq is not ready */
function ttq(eventName: string, params?: Record<string, any>) {
  const w = typeof window !== "undefined" ? (window as any) : null
  if (!w?.ttq?.track) {
    log("ttq skip — not loaded", eventName)
    return
  }
  w.ttq.track(eventName, params)
  log("ttq", eventName, params)
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
  ttq("SubmitForm")
  pushDebugEvent("contact_form_submit_success")
  updateTrackingDebug()
}

/** Signup succeeded */
export function trackSignup(method?: string) {
  ga("sign_up", method ? { method } : undefined)
  fb("CompleteRegistration")
  ttq("CompleteRegistration")
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
  ttq("InitiateCheckout", params)
  pushDebugEvent("checkout_start", params)
  updateTrackingDebug()
}

/** User submits payment info (redirected to payment page) */
export function trackAddPaymentInfo(params?: { value?: number; currency?: string }) {
  ga("add_payment_info", params)
  fb("AddPaymentInfo", params)
  // TikTok doesn't have AddPaymentInfo — no equivalent needed
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
  ttq("PlaceAnOrder", {
    value: params.value,
    currency: params.currency,
    content_id: params.transaction_id,
  })
  pushDebugEvent("purchase_success", params)
  updateTrackingDebug()
}

/** Trial started */
export function trackTrialStart() {
  ga("start_trial")
  fb("StartTrial")
  ttq("Subscribe")
  pushDebugEvent("trial_start")
  updateTrackingDebug()
}

/** View key content page (pricing, landing) */
export function trackViewContent(params?: { content_name?: string; content_id?: string }) {
  ga("view_item", params)
  fb("ViewContent", params)
  ttq("ViewContent", params)
  pushDebugEvent("view_content", params)
  updateTrackingDebug()
}

// ---------------------------------------------------------------------------
// UTM helper — reads current URL search params (client-only)
// ---------------------------------------------------------------------------

function getUtmParams(): Record<string, string> | undefined {
  if (typeof window === "undefined") return undefined
  const sp = new URLSearchParams(window.location.search)
  const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
  const result: Record<string, string> = {}
  for (const key of utmKeys) {
    const val = sp.get(key)
    if (val) result[key] = val
  }
  return Object.keys(result).length > 0 ? result : undefined
}

// ---------------------------------------------------------------------------
// Modal CTA click events — URL does not change when modal opens
// ---------------------------------------------------------------------------

/** Start chat CTA clicked — chat modal opens, URL unchanged */
export function trackStartChatClick() {
  const utmParams = getUtmParams()
  ga("start_chat_click", utmParams)
  fb("Lead", { content_name: "start_chat_click", ...utmParams })
  ttq("ClickButton", { content_name: "start_chat" })
  pushDebugEvent("start_chat_click", utmParams)
  updateTrackingDebug()
}

/** Start voice call CTA clicked — voice modal opens, URL unchanged */
export function trackStartVoiceClick() {
  const utmParams = getUtmParams()
  ga("start_voice_click", utmParams)
  fb("Lead", { content_name: "start_voice_click", ...utmParams })
  ttq("ClickButton", { content_name: "start_voice" })
  pushDebugEvent("start_voice_click", utmParams)
  updateTrackingDebug()
}

/** Start video call CTA clicked — video modal opens, URL unchanged */
export function trackStartVideoClick() {
  const utmParams = getUtmParams()
  ga("start_video_click", utmParams)
  fb("Lead", { content_name: "start_video_click", ...utmParams })
  ttq("ClickButton", { content_name: "start_video" })
  pushDebugEvent("start_video_click", utmParams)
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

/** TikTok Pixel page view (used by Analytics component for SPA navigation) */
export function trackTtqPageView(path: string) {
  const w = typeof window !== "undefined" ? (window as any) : null
  if (!w?.ttq?.page) {
    log("ttq PageView skip — not loaded", path)
    return
  }
  w.ttq.page()
  log("ttq page()", path)
}
