import { API_BASE_URL } from "@/constants/config"
import { getAuthToken, getDeviceHash } from "./storage"

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

  // Send device hash as cookie too (some server routes read it from cookies)
  if (deviceHash) {
    const existing = headers.get("Cookie") || ""
    headers.set("Cookie", existing ? `${existing}; ta_device_hash=${deviceHash}` : `ta_device_hash=${deviceHash}`)
  }

  headers.set("X-Client", "mobile")

  return fetch(`${API_BASE_URL}${path}`, { ...init, headers })
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

/** Single call to get user info + access status (mobile-specific endpoint) */
export async function bootstrap(): Promise<BootstrapData> {
  const res = await apiFetch("/api/mobile/bootstrap")
  return res.json()
}

/* ── History ── */

export async function getHistory() {
  const res = await apiFetch("/api/history/list")
  return res.json()
}

export async function getConversation(id: string) {
  const res = await apiFetch(`/api/history/${id}`)
  return res.json()
}

/* ── Chat ── */

export async function sendMessage(query: string, language: string, email?: string) {
  const res = await apiFetch("/api/turbotaai-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, language, mode: "chat", email }),
  })
  return res.json()
}

/* ── IAP receipt validation ── */

export async function validateReceipt(receipt: {
  platform: "ios" | "android"
  productId: string
  transactionReceipt: string
}) {
  const res = await apiFetch("/api/billing/iap/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(receipt),
  })
  return res.json()
}
