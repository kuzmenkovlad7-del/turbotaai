import * as SecureStore from "expo-secure-store"
import { STORAGE_KEYS } from "@/constants/config"

/* ── Secure token storage (Keychain on iOS, Keystore on Android) ── */

export const getAuthToken = () => SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN)
export const setAuthToken = (t: string) => SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, t)
export const clearAuthToken = () => SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN)

export const getRefreshToken = () => SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN)
export const setRefreshToken = (t: string) => SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, t)
export const clearRefreshToken = () => SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN)

export const getDeviceHash = () => SecureStore.getItemAsync(STORAGE_KEYS.DEVICE_HASH)
export const setDeviceHash = (h: string) => SecureStore.setItemAsync(STORAGE_KEYS.DEVICE_HASH, h)

/** Generate a random UUID v4 (no external deps) */
export function generateUUID(): string {
  const hex = "0123456789abcdef"
  let uuid = ""
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += "-"
    } else if (i === 14) {
      uuid += "4"
    } else if (i === 19) {
      uuid += hex[(Math.random() * 4) | 8]
    } else {
      uuid += hex[(Math.random() * 16) | 0]
    }
  }
  return uuid
}

/** Ensure a device hash exists; create one if not */
export async function ensureDeviceHash(): Promise<string> {
  const existing = await getDeviceHash()
  if (existing) return existing
  const hash = generateUUID()
  await setDeviceHash(hash)
  return hash
}

/* ── Session ID persistence (per mode) ── */

export const getSessionId = (mode: string) =>
  SecureStore.getItemAsync(STORAGE_KEYS.SESSION_PREFIX + mode)

export const setSessionId = (mode: string, id: string) =>
  SecureStore.setItemAsync(STORAGE_KEYS.SESSION_PREFIX + mode, id)

export const clearSessionId = (mode: string) =>
  SecureStore.deleteItemAsync(STORAGE_KEYS.SESSION_PREFIX + mode)

/** Clear all stored credentials */
export async function clearAll(): Promise<void> {
  await Promise.all([clearAuthToken(), clearRefreshToken()])
}
