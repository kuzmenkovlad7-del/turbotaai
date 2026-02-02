/**
 * Returns stable device hash for the current browser session.
 *
 * Priority:
 *   1. Logged-in user → "account:<userId>"   (written to cookie + localStorage)
 *   2. Existing cookie   (set by middleware on first visit)
 *   3. Existing localStorage value
 *   4. Last resort → generate raw UUID   (no prefix, same format as middleware)
 *
 * IMPORTANT: The value must match what the server reads from the cookie.
 * Middleware generates raw UUIDs; never add a "device:" prefix.
 */
export function getClientDeviceHash(userId?: string | null): string | null {
  if (typeof window === "undefined") return null

  const COOKIE_NAME = "ta_device_hash"
  const LS_KEY = "ta_device_hash"

  // ── Logged-in user: deterministic key ──────────────────────
  if (userId) {
    const v = `account:${userId}`
    try { localStorage.setItem(LS_KEY, v) } catch {}
    try {
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(v)}; Path=/; Max-Age=31536000; SameSite=Lax`
    } catch {}
    return v
  }

  // ── Guest: read existing value ─────────────────────────────
  let v: string | null = null

  // 1. Read cookie (authoritative — set by middleware or API routes)
  try {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`))
    if (m) v = decodeURIComponent(m[1]).trim() || null
  } catch {}

  // 2. Fallback to localStorage
  if (!v) {
    try { v = localStorage.getItem(LS_KEY) } catch {}
  }

  // 3. Strip legacy "device:" prefix so server and client agree
  if (v && v.startsWith("device:")) {
    v = v.slice("device:".length)
  }

  // 4. Last resort: generate raw UUID (same format as middleware)
  if (!v) {
    v = (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  // Persist to both stores
  try { localStorage.setItem(LS_KEY, v) } catch {}
  try {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(v)}; Path=/; Max-Age=31536000; SameSite=Lax`
  } catch {}

  return v
}
