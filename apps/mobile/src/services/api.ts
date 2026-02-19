import { API_BASE_URL } from "@/constants/config"
import { getAuthToken, getDeviceHash, generateUUID } from "./storage"

/* ── Authenticated fetch wrapper ── */

type FetchOpts = RequestInit & { skipAuth?: boolean }

export async function apiFetch(path: string, opts: FetchOpts = {}): Promise<Response> {
  const { skipAuth, ...init } = opts
  const headers = new Headers(init.headers)

  if (!skipAuth) {
    const token = await getAuthToken()
    if (token) headers.set("Authorization", `Bearer ${token}`)
  }

  const deviceHash = await getDeviceHash()
  if (deviceHash) headers.set("X-Device-Hash", deviceHash)

  // Send device hash as cookie too (history/agent routes read from cookies)
  if (deviceHash) {
    const existing = headers.get("Cookie") || ""
    headers.set(
      "Cookie",
      existing ? `${existing}; ta_device_hash=${deviceHash}` : `ta_device_hash=${deviceHash}`,
    )
  }

  headers.set("X-Client", "mobile")

  return fetch(`${API_BASE_URL}${path}`, { ...init, headers })
}

/** Safely parse JSON from a response, returning fallback on failure */
async function safeJson<T = any>(res: Response, fallback: T): Promise<T> {
  try {
    const text = await res.text()
    if (!text || !text.trim()) return fallback
    return JSON.parse(text)
  } catch {
    return fallback
  }
}

/* ── Access / bootstrap ── */

export type BootstrapData = {
  ok: boolean
  isLoggedIn: boolean
  userId: string | null
  email: string | null
  deviceHash: string
  access: "paid" | "promo" | "trial" | "none"
  hasAccess: boolean
  unlimited: boolean
  trial_questions_left: number
  paid_until: string | null
  promo_until: string | null
  subscription_status: string | null
  auto_renew: boolean
  error?: string
}

const EMPTY_BOOTSTRAP: BootstrapData = {
  ok: false,
  isLoggedIn: false,
  userId: null,
  email: null,
  deviceHash: "",
  access: "none",
  hasAccess: false,
  unlimited: false,
  trial_questions_left: 0,
  paid_until: null,
  promo_until: null,
  subscription_status: null,
  auto_renew: false,
}

/** Single call to get user info + access status (mobile-specific endpoint) */
export async function bootstrap(): Promise<BootstrapData> {
  const res = await apiFetch("/api/mobile/bootstrap")
  return safeJson(res, { ...EMPTY_BOOTSTRAP, error: `HTTP ${res.status}` })
}

/* ── History ── */

export type ConversationSummary = {
  id: string
  title: string | null
  mode?: string
  created_at: string
  updated_at?: string
}

export type HistoryMessage = {
  id: string
  role: string
  content: string
  created_at?: string
}

export async function getHistory(): Promise<{ conversations: ConversationSummary[] }> {
  const res = await apiFetch("/api/history/list")
  const data = await safeJson(res, { conversations: [] })
  return {
    conversations: Array.isArray(data?.conversations) ? data.conversations : [],
  }
}

export async function getConversation(
  id: string,
): Promise<{ ok: boolean; messages: HistoryMessage[]; error?: string }> {
  const res = await apiFetch(`/api/history/${id}`)
  const data = await safeJson(res, { ok: false, messages: [], error: `HTTP ${res.status}` })
  return {
    ok: data?.ok ?? false,
    messages: Array.isArray(data?.messages) ? data.messages : [],
    error: data?.error,
  }
}

export async function saveConversation(params: {
  conversationId: string
  messages: { role: string; content: string }[]
  mode?: string
  title?: string
}): Promise<{ ok: boolean; id?: string }> {
  const res = await apiFetch("/api/history/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversationId: params.conversationId,
      mode: params.mode || "chat",
      title: params.title,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  })
  return safeJson(res, { ok: false })
}

/* ── Chat ── */

export type AgentResponse = {
  ok?: boolean
  text?: string
  response?: string
  output?: string
  error?: string
}

/** Payload contract for every webhook message */
export type MessagePayload = {
  query: string
  language: string
  mode: "chat" | "voice" | "video"
  userId: string | null
  sessionId: string
  deviceId: string
  clientMessageId: string
  timestamp: string
  user?: string
  email?: string
}

/** Dev-safe validator: logs missing/invalid fields, never crashes */
function validatePayload(payload: MessagePayload): void {
  const issues: string[] = []
  if (!payload.query) issues.push("query is empty")
  if (!payload.sessionId) issues.push("sessionId is empty")
  if (!payload.deviceId) issues.push("deviceId is empty")
  if (!payload.clientMessageId) issues.push("clientMessageId is empty")
  if (!payload.timestamp) issues.push("timestamp is empty")
  if (!payload.language) issues.push("language is empty")
  if (payload.userId === "") issues.push("userId is empty string (should be null)")
  if (!["chat", "voice", "video"].includes(payload.mode)) issues.push("mode is invalid")
  if (!payload.user) issues.push("user compat field is missing")
  if (payload.user === "guest@example.com") issues.push("user must not be guest@example.com")
  if (issues.length > 0) {
    console.warn("[PayloadValidator] Issues before send:", issues.join(", "), payload)
  }
}

/**
 * Shared payload builder for chat/voice/video screens.
 * Normalizes userId (empty string → null) and adds compatibility `user` field.
 */
export function buildMessagePayload(opts: {
  query: string
  language: string
  mode: "chat" | "voice" | "video"
  userId: string | null | undefined
  sessionId: string
  deviceId: string
  email?: string
}): MessagePayload & { user: string } {
  const normalizedUserId = opts.userId && opts.userId.trim() ? opts.userId : null
  return {
    query: opts.query,
    language: opts.language,
    mode: opts.mode,
    userId: normalizedUserId,
    sessionId: opts.sessionId,
    deviceId: opts.deviceId,
    clientMessageId: generateUUID(),
    timestamp: new Date().toISOString(),
    email: opts.email,
    user: normalizedUserId ?? `guest:${opts.sessionId}`,
  }
}

export async function sendMessage(payload: MessagePayload & { user?: string }): Promise<AgentResponse> {
  validatePayload(payload)
  const res = await apiFetch("/api/turbotaai-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: payload.query,
      language: payload.language,
      mode: payload.mode,
      userId: payload.userId,
      sessionId: payload.sessionId,
      deviceId: payload.deviceId,
      clientMessageId: payload.clientMessageId,
      timestamp: payload.timestamp,
      user: payload.user || undefined,
      email: payload.email || undefined,
      user: payload.user || payload.userId || `guest:${payload.sessionId}`,
    }),
  })
  const data = await safeJson(res, { ok: false, error: `HTTP ${res.status}` } as AgentResponse)

  // Surface access control errors clearly
  if (!res.ok) {
    const errMsg =
      data?.error === "payment_required"
        ? "You have used all your free questions. Subscribe to continue."
        : data?.error || `Request failed (${res.status})`
    return { ok: false, error: errMsg }
  }

  return data
}

/** Extract displayable text from the variable agent response shape */
export function extractReplyText(data: AgentResponse): string {
  if (data?.error && data?.ok === false) return data.error
  // N8N webhook returns various shapes
  const raw =
    data?.output ||
    data?.text ||
    data?.response ||
    (Array.isArray(data) ? (data as any)[0]?.output || (data as any)[0]?.text : null)
  if (typeof raw === "string" && raw.trim()) return raw.trim()
  // Fallback: try any string value
  if (data && typeof data === "object" && !Array.isArray(data)) {
    for (const v of Object.values(data)) {
      if (typeof v === "string" && v.trim().length > 2 && v !== "true" && v !== "false") {
        return v.trim()
      }
    }
  }
  return "..."
}

/* ── IAP receipt validation ── */

export async function validateReceipt(receipt: {
  platform: "ios" | "android"
  productId: string
  transactionReceipt: string
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await apiFetch("/api/billing/iap/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(receipt),
  })
  return safeJson(res, { ok: false, error: `HTTP ${res.status}` })
}

/* ── Promo codes ── */

export async function redeemPromo(
  code: string,
): Promise<{ ok: boolean; promo_until?: string; error?: string }> {
  const res = await apiFetch("/api/billing/promo/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  })
  return safeJson(res, { ok: false, error: `HTTP ${res.status}` })
}

/* ── Subscription management ── */

export async function cancelAutoRenew(): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/billing/subscription/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
  return safeJson(res, { ok: false, error: `HTTP ${res.status}` })
}

export async function resumeAutoRenew(): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/billing/subscription/resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
  return safeJson(res, { ok: false, error: `HTTP ${res.status}` })
}
