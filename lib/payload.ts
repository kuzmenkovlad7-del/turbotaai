/**
 * Shared message payload builder for web chat/voice/video.
 *
 * Ensures every outbound message to /api/turbotaai-agent or /api/chat
 * carries the full identity/session contract so n8n can resolve
 * authenticated users as real user namespaces, not guests.
 */

import { getClientDeviceHash } from "@/lib/device/device-hash"

export type WebMessagePayload = {
  query: string
  language: string
  mode: "chat" | "voice" | "video"
  userId: string | null
  sessionId: string
  deviceId: string
  clientMessageId: string
  timestamp: string
  user: string
  email?: string
}

/** Stable sessionId per browser tab — survives re-renders, reset on page reload */
let _tabSessionId: string | null = null

function getTabSessionId(): string {
  if (!_tabSessionId) {
    _tabSessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
  return _tabSessionId
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Build a complete message payload with full identity contract.
 *
 * @param opts.userId - Supabase user.id (string if logged in, undefined/null if guest)
 * @param opts.email  - User email (optional, for history/display)
 */
export function buildWebPayload(opts: {
  query: string
  language: string
  mode: "chat" | "voice" | "video"
  userId?: string | null
  email?: string | null
}): WebMessagePayload {
  // Normalize userId: empty/whitespace → null
  const userId =
    typeof opts.userId === "string" && opts.userId.trim()
      ? opts.userId.trim()
      : null

  const clientMessageId = generateUUID()
  const sessionId = getTabSessionId()
  const deviceId = getClientDeviceHash(userId) || ""
  const timestamp = new Date().toISOString()
  const user = userId ?? `guest:${sessionId}`

  // Warn-only diagnostics (dev)
  if (process.env.NODE_ENV === "development") {
    const issues: string[] = []
    if (!opts.query) issues.push("query is empty")
    if (!sessionId) issues.push("sessionId is empty")
    if (!deviceId) issues.push("deviceId is empty")
    if (userId === null && opts.email) {
      issues.push("authenticated email present but userId is null — check auth state")
    }
    if (issues.length > 0) {
      console.warn("[PayloadBuilder] Issues:", issues.join(", "))
    }
  }

  const payload: WebMessagePayload = {
    query: opts.query,
    language: opts.language,
    mode: opts.mode,
    userId,
    sessionId,
    deviceId,
    clientMessageId,
    timestamp,
    user,
  }

  if (opts.email && typeof opts.email === "string" && opts.email.trim()) {
    payload.email = opts.email.trim()
  }

  return payload
}
