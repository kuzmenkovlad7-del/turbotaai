#!/usr/bin/env node
/**
 * verify-conversions.mjs
 *
 * Checks that conversion event tracking helpers are properly wired
 * by verifying the source code contains the expected tracking calls.
 *
 * Usage:
 *   node scripts/verify-conversions.mjs [baseUrl]
 *
 * The baseUrl argument is accepted for compatibility but not used —
 * this script does static analysis of the source files.
 */

import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const ROOT = resolve(import.meta.dirname, "..")

const RED = "\x1b[31m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const RESET = "\x1b[0m"

let passed = 0
let failed = 0

function check(label, filePath, pattern) {
  const full = resolve(ROOT, filePath)
  if (!existsSync(full)) {
    console.log(`${RED}FAIL${RESET} ${label} — file not found: ${filePath}`)
    failed++
    return
  }
  const content = readFileSync(full, "utf8")
  const re = pattern instanceof RegExp ? pattern : new RegExp(pattern)
  if (re.test(content)) {
    console.log(`${GREEN}PASS${RESET} ${label}`)
    passed++
  } else {
    console.log(`${RED}FAIL${RESET} ${label} — pattern /${re.source}/ not found in ${filePath}`)
    failed++
  }
}

console.log(`\n${YELLOW}=== Conversion Events Verification ===${RESET}\n`)

// 1. Tracking library exists with all helpers
check(
  "lib/tracking.ts exists with trackLeadClick",
  "lib/tracking.ts",
  /export function trackLeadClick/
)
check(
  "lib/tracking.ts has trackStartChatClick",
  "lib/tracking.ts",
  /export function trackStartChatClick/
)
check(
  "lib/tracking.ts has trackStartVoiceClick",
  "lib/tracking.ts",
  /export function trackStartVoiceClick/
)
check(
  "lib/tracking.ts has trackStartVideoClick",
  "lib/tracking.ts",
  /export function trackStartVideoClick/
)
check(
  "lib/tracking.ts has trackContactFormSubmit",
  "lib/tracking.ts",
  /export function trackContactFormSubmit/
)
check(
  "lib/tracking.ts has trackSignup",
  "lib/tracking.ts",
  /export function trackSignup/
)
check(
  "lib/tracking.ts has trackLogin",
  "lib/tracking.ts",
  /export function trackLogin/
)
check(
  "lib/tracking.ts has trackCheckoutStart",
  "lib/tracking.ts",
  /export function trackCheckoutStart/
)
check(
  "lib/tracking.ts has trackAddPaymentInfo",
  "lib/tracking.ts",
  /export function trackAddPaymentInfo/
)
check(
  "lib/tracking.ts has trackPurchase with dedup",
  "lib/tracking.ts",
  /wasPurchaseTracked.*transaction_id/s
)
check(
  "lib/tracking.ts has trackTrialStart",
  "lib/tracking.ts",
  /export function trackTrialStart/
)

// 2. Analytics component uses shared lib
check(
  "analytics.tsx imports from lib/tracking",
  "components/analytics.tsx",
  /from ["']@\/lib\/tracking["']/
)
check(
  "analytics.tsx has updateTrackingDebug",
  "components/analytics.tsx",
  /updateTrackingDebug/
)

// 3. Lead / modal CTA events wired
check(
  "Home page imports trackStartChatClick",
  "app/page.tsx",
  /trackStartChatClick/
)
check(
  "Home page imports trackStartVoiceClick",
  "app/page.tsx",
  /trackStartVoiceClick/
)
check(
  "Home page imports trackStartVideoClick",
  "app/page.tsx",
  /trackStartVideoClick/
)
check(
  "Contact form imports trackContactFormSubmit",
  "components/contact-form.tsx",
  /trackContactFormSubmit/
)

// 4. Auth events wired
check(
  "Login page imports trackLogin",
  "app/login/page.tsx",
  /trackLogin/
)
check(
  "Register page imports trackSignup",
  "app/register/page.tsx",
  /trackSignup/
)
check(
  "Register page tracks trial start",
  "app/register/page.tsx",
  /trackTrialStart/
)

// 5. Checkout events wired
check(
  "Pricing page imports trackCheckoutStart",
  "app/pricing/page.tsx",
  /trackCheckoutStart/
)
check(
  "Pricing page imports trackAddPaymentInfo",
  "app/pricing/page.tsx",
  /trackAddPaymentInfo/
)

// 6. Purchase event wired with dedup
check(
  "Payment result page imports trackPurchase",
  "app/payment/result/page.tsx",
  /trackPurchase/
)
check(
  "Payment result page has purchaseTrackedRef guard",
  "app/payment/result/page.tsx",
  /purchaseTrackedRef/
)

// 7. GA4 events in tracking lib
check(
  "GA4: generate_lead event",
  "lib/tracking.ts",
  /ga\(["']generate_lead["']/
)
check(
  "GA4: start_chat_click event",
  "lib/tracking.ts",
  /ga\(["']start_chat_click["']/
)
check(
  "GA4: start_voice_click event",
  "lib/tracking.ts",
  /ga\(["']start_voice_click["']/
)
check(
  "GA4: start_video_click event",
  "lib/tracking.ts",
  /ga\(["']start_video_click["']/
)
check(
  "GA4: sign_up event",
  "lib/tracking.ts",
  /ga\(["']sign_up["']/
)
check(
  "GA4: login event",
  "lib/tracking.ts",
  /ga\(["']login["']/
)
check(
  "GA4: begin_checkout event",
  "lib/tracking.ts",
  /ga\(["']begin_checkout["']/
)
check(
  "GA4: add_payment_info event",
  "lib/tracking.ts",
  /ga\(["']add_payment_info["']/
)
check(
  "GA4: purchase event",
  "lib/tracking.ts",
  /ga\(["']purchase["']/
)
check(
  "GA4: start_trial event",
  "lib/tracking.ts",
  /ga\(["']start_trial["']/
)

// 8. Meta Pixel events in tracking lib
check(
  "Meta: Lead event (legacy generate_lead)",
  "lib/tracking.ts",
  /fb\(["']Lead["']/
)
check(
  "Meta: Lead with start_chat_click content_name",
  "lib/tracking.ts",
  /content_name.*start_chat_click/
)
check(
  "Meta: Lead with start_voice_click content_name",
  "lib/tracking.ts",
  /content_name.*start_voice_click/
)
check(
  "Meta: Lead with start_video_click content_name",
  "lib/tracking.ts",
  /content_name.*start_video_click/
)
check(
  "Meta: CompleteRegistration event",
  "lib/tracking.ts",
  /fb\(["']CompleteRegistration["']/
)
check(
  "Meta: InitiateCheckout event",
  "lib/tracking.ts",
  /fb\(["']InitiateCheckout["']/
)
check(
  "Meta: AddPaymentInfo event",
  "lib/tracking.ts",
  /fb\(["']AddPaymentInfo["']/
)
check(
  "Meta: Purchase event",
  "lib/tracking.ts",
  /fb\(["']Purchase["']/
)
check(
  "Meta: StartTrial event",
  "lib/tracking.ts",
  /fb\(["']StartTrial["']/
)

// 9. Debug infrastructure
check(
  "Debug: __trackingDebug with lastEvents",
  "lib/tracking.ts",
  /lastEvents/
)
check(
  "Debug: __trackingDebug with counters",
  "lib/tracking.ts",
  /counters/
)

console.log(`\n${YELLOW}Results:${RESET} ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : GREEN}${failed} failed${RESET}\n`)

process.exit(failed > 0 ? 1 : 0)
