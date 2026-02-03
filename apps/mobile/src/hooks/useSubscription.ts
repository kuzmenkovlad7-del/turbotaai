import { useCallback, useState } from "react"
import { Platform, Alert } from "react-native"
import { IAP_ENABLED, IAP_PRODUCTS } from "@/constants/config"
import * as api from "@/services/api"

type SubState = {
  purchasing: boolean
  error: string | null
}

/**
 * Hook for managing IAP subscriptions.
 *
 * When EXPO_PUBLIC_IAP_ENABLED !== "true", purchase buttons are hidden
 * and purchase() shows an informational alert.
 *
 * Full IAP flow requires:
 * 1. Apple Developer + Google Play accounts configured
 * 2. Products created in App Store Connect / Play Console
 * 3. react-native-iap installed (requires dev build, not Expo Go)
 * 4. Backend receipt validation implemented
 */
export function useSubscription() {
  const [state, setState] = useState<SubState>({
    purchasing: false,
    error: null,
  })

  const purchase = useCallback(async (productId: string) => {
    if (!IAP_ENABLED) {
      Alert.alert(
        "Coming Soon",
        "In-app purchases are not yet enabled. Subscriptions will be available in a future update.",
      )
      return
    }

    setState({ purchasing: true, error: null })

    try {
      // TODO: When IAP is enabled and react-native-iap is installed:
      // 1. import { requestSubscription } from "react-native-iap"
      // 2. const purchase = await requestSubscription({ sku: productId })
      // 3. Send receipt to backend for validation
      // 4. Refresh access status

      const platform = Platform.OS === "ios" ? "ios" : "android"

      // For now: direct validation call (will fail with 501 until fully implemented)
      const result = await api.validateReceipt({
        platform: platform as "ios" | "android",
        productId,
        transactionReceipt: "MOBILE_PURCHASE_PENDING",
      })

      if (result?.ok) {
        setState({ purchasing: false, error: null })
      } else {
        setState({
          purchasing: false,
          error: result?.message || result?.error || "Purchase could not be completed",
        })
      }
    } catch (e: any) {
      setState({ purchasing: false, error: e?.message || "Purchase failed" })
    }
  }, [])

  return { ...state, purchase, iapEnabled: IAP_ENABLED }
}
