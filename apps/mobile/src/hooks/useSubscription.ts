import { useState, useEffect, useCallback } from "react"
import { Platform } from "react-native"
import { IAP_PRODUCTS } from "@/constants/config"
import * as api from "@/services/api"

/**
 * Hook for managing IAP subscriptions.
 *
 * NOTE: react-native-iap must be properly linked and configured.
 * iOS: requires StoreKit configuration in Xcode.
 * Android: requires Google Play Billing library.
 *
 * This is a scaffold — actual IAP initialization and purchase flow
 * require react-native-iap to be installed and configured.
 */
type SubscriptionState = {
  hasAccess: boolean
  accessUntil: string | null
  loading: boolean
  purchasing: boolean
  error: string | null
}

export function useSubscription() {
  const [state, setState] = useState<SubscriptionState>({
    hasAccess: false,
    accessUntil: null,
    loading: true,
    purchasing: false,
    error: null,
  })

  // Check access status on mount
  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = useCallback(async () => {
    try {
      setState((s) => ({ ...s, loading: true }))
      const data = await api.getAccessStatus()
      setState({
        hasAccess: !!data?.unlimited,
        accessUntil: data?.accessUntil || null,
        loading: false,
        purchasing: false,
        error: null,
      })
    } catch (e: any) {
      setState((s) => ({ ...s, loading: false, error: e?.message }))
    }
  }, [])

  const purchase = useCallback(async (productId: string) => {
    setState((s) => ({ ...s, purchasing: true, error: null }))
    try {
      // TODO: Implement actual IAP purchase flow with react-native-iap
      // 1. RNIap.requestSubscription(productId)
      // 2. Get receipt from purchase result
      // 3. Validate receipt with backend
      // 4. Refresh access status

      const platform = Platform.OS === "ios" ? "ios" : "android"

      // Placeholder — replace with actual IAP purchase + receipt
      const receipt = {
        platform: platform as "ios" | "android",
        productId,
        transactionReceipt: "PLACEHOLDER_RECEIPT",
      }

      const result = await api.validateReceipt(receipt)
      if (result?.ok) {
        await checkAccess()
      } else {
        setState((s) => ({
          ...s,
          purchasing: false,
          error: result?.error || "Purchase validation failed",
        }))
      }
    } catch (e: any) {
      setState((s) => ({ ...s, purchasing: false, error: e?.message || "Purchase failed" }))
    }
  }, [checkAccess])

  return { ...state, purchase, checkAccess }
}
