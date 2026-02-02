/**
 * Central configuration for the mobile app.
 * API_BASE_URL should point to the deployed TurbotaAI backend.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://turbotaai.com"

/** IAP product identifiers — must match App Store Connect / Google Play Console */
export const IAP_PRODUCTS = {
  MONTHLY: "com.turbotaai.monthly",
  YEARLY: "com.turbotaai.yearly",
} as const

export const STORAGE_KEYS = {
  AUTH_TOKEN: "turbotaai_auth_token",
  DEVICE_HASH: "turbotaai_device_hash",
  REGION: "turbotaai_region",
  LANGUAGE: "turbotaai_language",
} as const
