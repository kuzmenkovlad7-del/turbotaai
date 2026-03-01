import Constants from "expo-constants"

/**
 * Central configuration for the mobile app.
 *
 * Single source of truth: EXPO_PUBLIC_API_URL
 * All WebView URLs and API calls derive from this.
 */
const extra = Constants.expoConfig?.extra ?? {}

/**
 * Normalize apex domain → www to prevent HTTP 301 redirects that strip the
 * Authorization header — a silent auth failure that makes all API calls return
 * as unauthenticated without any visible error in the app.
 *
 * e.g. https://turbotaai.com → https://www.turbotaai.com
 */
function normalizeApiUrl(raw: string): string {
  if (!raw) return raw
  if (/^https?:\/\/turbotaai\.com(\/|$)/.test(raw)) {
    console.warn(
      "[TurbotaAI] EXPO_PUBLIC_API_URL is apex domain — auto-correcting to www " +
      "to prevent HTTP 301 redirects from stripping the Authorization header. " +
      "Update your .env to use https://www.turbotaai.com to suppress this warning."
    )
    return raw.replace(/^(https?:\/\/)turbotaai\.com/, "$1www.turbotaai.com")
  }
  return raw
}

export const API_BASE_URL: string = normalizeApiUrl(
  extra.apiUrl || process.env.EXPO_PUBLIC_API_URL || ""
)

/** Feature flag: set EXPO_PUBLIC_IAP_ENABLED=true to show purchase buttons */
export const IAP_ENABLED: boolean =
  (extra.iapEnabled || process.env.EXPO_PUBLIC_IAP_ENABLED || "false") === "true"

/**
 * Store-build mode — set EXPO_PUBLIC_STORE_BUILD=true in any build that will
 * be submitted to the App Store or Google Play.
 *
 * false (default / dev / preview):
 *   Shows "Subscribe on turbotaai.com" button that opens an external browser.
 *   Convenient for QA and pre-launch testing but NOT compliant with store
 *   guidelines for digital-content purchases.
 *
 * true (store submission):
 *   Hides the external-checkout CTA entirely and shows a neutral "coming soon"
 *   notice instead.  Promo code apply and Refresh Access continue to work.
 *   Full native IAP integration is still required for production purchases
 *   (see useSubscription TODO comments).
 *
 * Legacy alias EXPO_PUBLIC_STORE_SAFE is also accepted — either flag activates
 * store-build behaviour.
 *
 * Note: AccountScreen applies an additional iOS safeguard via Platform.OS so
 * the external CTA is never shown on iOS regardless of this flag.
 */
export const STORE_BUILD: boolean =
  (
    extra.storeBuild || process.env.EXPO_PUBLIC_STORE_BUILD ||
    extra.storeSafe  || process.env.EXPO_PUBLIC_STORE_SAFE  ||
    "false"
  ) === "true"

/** @deprecated — use STORE_BUILD; kept so existing imports compile unchanged */
export const STORE_SAFE = STORE_BUILD

/** Debug mode: set EXPO_PUBLIC_DEBUG=true to show diagnostic overlays */
export const DEBUG_ENABLED: boolean =
  (extra.debug || process.env.EXPO_PUBLIC_DEBUG || "false") === "true"

/** IAP product identifiers — must match App Store Connect / Google Play Console */
export const IAP_PRODUCTS = {
  MONTHLY: "com.turbotaai.monthly",
  YEARLY: "com.turbotaai.yearly",
} as const

export const STORAGE_KEYS = {
  AUTH_TOKEN: "turbotaai_auth_token",
  REFRESH_TOKEN: "turbotaai_refresh_token",
  DEVICE_HASH: "turbotaai_device_hash",
  SESSION_PREFIX: "turbotaai_session_",
  REGION: "turbotaai_region",
  LANGUAGE: "turbotaai_language",
} as const

/* ── Runtime validation ────────────────────────────────────── */

type EnvIssue = { name: string; severity: "error" | "warn" }

function checkEnv(): EnvIssue[] {
  const issues: EnvIssue[] = []
  if (!API_BASE_URL) issues.push({ name: "EXPO_PUBLIC_API_URL", severity: "error" })
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL) issues.push({ name: "EXPO_PUBLIC_SUPABASE_URL", severity: "error" })
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) issues.push({ name: "EXPO_PUBLIC_SUPABASE_ANON_KEY", severity: "error" })
  return issues
}

export const ENV_ISSUES = checkEnv()
export const ENV_OK = ENV_ISSUES.filter(i => i.severity === "error").length === 0

// Log issues once on startup for developer visibility
if (ENV_ISSUES.length > 0) {
  console.warn(
    "[TurbotaAI] Environment issues:\n" +
    ENV_ISSUES.map(i => `  ${i.severity.toUpperCase()}: ${i.name} is not set`).join("\n") +
    "\n  Copy apps/mobile/.env.example → .env and fill in values."
  )
}

if (DEBUG_ENABLED) {
  console.log("[TurbotaAI:debug] API_BASE_URL (effective) =", API_BASE_URL)
  console.log("[TurbotaAI:debug] IAP_ENABLED =", IAP_ENABLED)
  console.log("[TurbotaAI:debug] SUPABASE_URL =", process.env.EXPO_PUBLIC_SUPABASE_URL ? "set" : "MISSING")
}
