// lib/app-config.ts

export const APP_NAME =
  process.env.NEXT_PUBLIC_APP_NAME || "TurbotaAI"

export const APP_DOMAIN =
  process.env.NEXT_PUBLIC_APP_DOMAIN || "turbotaai.com"

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || `https://${APP_DOMAIN}`

export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || `support@${APP_DOMAIN}`
