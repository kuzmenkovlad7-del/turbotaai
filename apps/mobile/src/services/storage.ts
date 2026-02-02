import * as SecureStore from "expo-secure-store"
import { STORAGE_KEYS } from "@/constants/config"

/** Secure token storage (uses Keychain on iOS, Keystore on Android) */
export async function getAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN)
}

export async function setAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token)
}

export async function clearAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN)
}

export async function getDeviceHash(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.DEVICE_HASH)
}

export async function setDeviceHash(hash: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.DEVICE_HASH, hash)
}
