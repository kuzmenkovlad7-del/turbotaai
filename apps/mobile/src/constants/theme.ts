/** Design tokens used across all screens */
export const colors = {
  primary: "#7c3aed",
  primaryDark: "#6d28d9",
  primaryLight: "#ede9fe",
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceAlt: "#f1f5f9",
  text: "#0f172a",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  border: "#e2e8f0",
  error: "#dc2626",
  errorLight: "#fef2f2",
  success: "#16a34a",
  successLight: "#dcfce7",
  userBubble: "#7c3aed",
  aiBubble: "#f0fdf4",
  aiBubbleBorder: "#bbf7d0",
} as const

/** Dark-mode palette — same semantic keys, dark values */
export const darkColors: typeof colors = {
  primary: "#a78bfa",
  primaryDark: "#7c3aed",
  primaryLight: "#2e1065",
  background: "#0f172a",
  surface: "#1e293b",
  surfaceAlt: "#334155",
  text: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  border: "#334155",
  error: "#f87171",
  errorLight: "#450a0a",
  success: "#4ade80",
  successLight: "#052e16",
  userBubble: "#7c3aed",
  aiBubble: "#052e16",
  aiBubbleBorder: "#166534",
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  hero: 34,
} as const
