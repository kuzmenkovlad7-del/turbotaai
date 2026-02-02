import { API_BASE_URL } from "@/constants/config"
import { getAuthToken, getDeviceHash } from "./storage"

type FetchOptions = RequestInit & { skipAuth?: boolean }

/**
 * Authenticated fetch wrapper.
 * Attaches auth token and device hash to every request.
 */
async function apiFetch(path: string, opts: FetchOptions = {}): Promise<Response> {
  const { skipAuth, ...init } = opts
  const headers = new Headers(init.headers)

  if (!skipAuth) {
    const token = await getAuthToken()
    if (token) headers.set("Authorization", `Bearer ${token}`)
  }

  const deviceHash = await getDeviceHash()
  if (deviceHash) headers.set("X-Device-Hash", deviceHash)

  headers.set("X-Client", "mobile")

  return fetch(`${API_BASE_URL}${path}`, { ...init, headers })
}

/** Auth: login with email/password via Supabase */
export async function login(email: string, password: string) {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  })
  return res.json()
}

/** Auth: register new account */
export async function register(email: string, password: string) {
  const res = await apiFetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  })
  return res.json()
}

/** Check current access status */
export async function getAccessStatus() {
  const res = await apiFetch("/api/access/status")
  return res.json()
}

/** Get conversation history list */
export async function getHistory() {
  const res = await apiFetch("/api/history/list")
  return res.json()
}

/** Get single conversation */
export async function getConversation(id: string) {
  const res = await apiFetch(`/api/history/${id}`)
  return res.json()
}

/** Send message to AI assistant */
export async function sendMessage(query: string, language: string) {
  const res = await apiFetch("/api/turbotaai-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, language, mode: "chat" }),
  })
  return res.json()
}

/** Validate IAP receipt with backend */
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
