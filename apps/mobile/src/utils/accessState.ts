import type { AccessInfo } from "@/hooks/useAuth"

/**
 * Derived access state — single source of truth for feature gating on mobile.
 *
 * All three entry points (Chat, Voice, Video) MUST derive lock/unlock decisions
 * from this function rather than inspecting AccessInfo fields directly. This
 * mirrors the web platform's requireAccess() / hasUnlimited() logic in
 * /lib/access/access-control.ts.
 *
 * Lock / Unlock rules (matching the web backend):
 *   UNLOCKED when:  paid_until is future  OR  promo_until is future  OR  trial_questions_left > 0
 *   LOCKED  when:   none of the above apply
 *
 * Language changes do NOT reset this state: LanguageContext and AuthContext are
 * separate providers. setLocale() only updates LanguageContext, leaving the
 * shared AuthContext (and therefore AccessInfo) untouched.
 */

export type AccessState = {
  /** Mirrors the web "access" enum — "paid" | "promo" | "trial" | "none" */
  access: "paid" | "promo" | "trial" | "none"
  /** true  → user may send messages / start a call */
  canUse: boolean
  /** true  → user is locked out and must subscribe */
  isLocked: boolean
  /** true  → paid or promo (no per-question limit) */
  isUnlimited: boolean
  /** true  → trial access with at least 1 question remaining */
  isTrial: boolean
  /** number of remaining trial questions; 0 when unlimited or locked */
  trialLeft: number
  /** ISO expiry for active paid subscription, or null */
  paidUntil: string | null
  /** ISO expiry for active promo code, or null */
  promoUntil: string | null
}

export function getAccessState(info: AccessInfo | null | undefined): AccessState {
  const access = info?.access ?? "none"
  const canUse = info?.hasAccess ?? false
  const unlimited = info?.unlimited ?? false
  const trialLeft = info?.trialLeft ?? 0

  return {
    access,
    canUse,
    isLocked: !canUse,
    isUnlimited: unlimited,
    isTrial: access === "trial" && trialLeft > 0,
    trialLeft,
    paidUntil: info?.paidUntil ?? null,
    promoUntil: info?.promoUntil ?? null,
  }
}
