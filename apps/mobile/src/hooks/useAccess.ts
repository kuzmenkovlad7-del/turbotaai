/**
 * useAccess — single source of truth for access/subscription state.
 *
 * Thin wrapper over useAuth that exposes only the access slice of the
 * AuthContext so Voice, Video, Chat, and Account screens can all read
 * the same state without importing the full auth interface.
 *
 * Usage:
 *   const { accessState, decrementTrialLeft, refreshAccess } = useAccess()
 *
 * accessState fields:
 *   canUse        — true when user may start a call / send a message
 *   isLocked      — true when user must subscribe (complement of canUse)
 *   isUnlimited   — true for paid or promo (no per-question limit)
 *   isTrial       — true for trial with ≥1 question remaining
 *   trialLeft     — remaining trial questions
 *   access        — "paid" | "promo" | "trial" | "none"
 *   paidUntil     — ISO expiry for paid subscription (null if not paid)
 *   promoUntil    — ISO expiry for promo code (null if not promo)
 */

import { useAuth } from "./useAuth"
import { getAccessState } from "@/utils/accessState"
import type { AccessState } from "@/utils/accessState"
import type { AccessInfo } from "./useAuth"

export type { AccessState }

export function useAccess(): {
  accessInfo: AccessInfo | null
  accessState: AccessState
  decrementTrialLeft: () => void
  refreshAccess: () => Promise<void>
} {
  const { accessInfo, decrementTrialLeft, refreshAccess } = useAuth()
  return {
    accessInfo,
    accessState: getAccessState(accessInfo),
    decrementTrialLeft,
    refreshAccess,
  }
}
