import Constants from "expo-constants"

/**
 * Central configuration for the mobile app.
 * API_BASE_URL should point to the deployed TurbotaAI backend.
 */
const extra = Constants.expoConfig?.extra ?? {}
export const API_BASE_URL: string =
  extra.apiUrl || process.env.EXPO_PUBLIC_API_URL || "https://turbotaai.com"

/** Feature flag: set EXPO_PUBLIC_IAP_ENABLED=true to show purchase buttons */
export const IAP_ENABLED: boolean =
  (extra.iapEnabled || process.env.EXPO_PUBLIC_IAP_ENABLED || "false") === "true"

/** IAP product identifiers — must match App Store Connect / Google Play Console */
export const IAP_PRODUCTS = {
  MONTHLY: "com.turbotaai.monthly",
  YEARLY: "com.turbotaai.yearly",
} as const

export const STORAGE_KEYS = {
  AUTH_TOKEN: "turbotaai_auth_token",
  REFRESH_TOKEN: "turbotaai_refresh_token",
  DEVICE_HASH: "turbotaai_device_hash",
  REGION: "turbotaai_region",
  LANGUAGE: "turbotaai_language",
} as const
