import { useCallback, useEffect, useState } from "react"
import * as SecureStore from "expo-secure-store"
import { STORAGE_KEYS } from "@/constants/config"

/**
 * Tracks whether the user has explicitly agreed to AI data processing.
 *
 * State values:
 *   null  — still loading from storage (show nothing)
 *   false — not yet agreed (show consent modal)
 *   true  — already agreed (proceed normally)
 *
 * The flag is stored in SecureStore so it survives app restarts.
 * Accepting consent once is permanent until the account is deleted or the
 * app is reinstalled.
 */
export function useAiConsent() {
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null)

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEYS.AI_CONSENT)
      .then((val) => setConsentGiven(val === "true"))
      .catch(() => setConsentGiven(false))
  }, [])

  const acceptConsent = useCallback(async () => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.AI_CONSENT, "true")
    } catch {
      // SecureStore failure should not block the user — the modal will
      // reappear on next launch (consent is re-read), which is acceptable.
    }
    setConsentGiven(true)
  }, [])

  return { consentGiven, acceptConsent }
}
