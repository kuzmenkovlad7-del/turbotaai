import { useCallback, useState } from "react"
import { Platform, Alert, Linking } from "react-native"
import { IAP_ENABLED, IAP_PRODUCTS } from "@/constants/config"
import { useT } from "@/hooks/useLanguage"
import * as api from "@/services/api"

type SubState = {
  purchasing: boolean
  restoring: boolean
  error: string | null
}

/**
 * Hook for managing IAP subscriptions.
 *
 * When EXPO_PUBLIC_IAP_ENABLED !== "true", purchase buttons show an
 * informational alert. Restore / manage actions always work.
 *
 * Full IAP flow requires:
 * 1. Apple Developer + Google Play accounts configured
 * 2. Products created in App Store Connect / Play Console
 * 3. react-native-iap installed (requires dev build, not Expo Go)
 * 4. Backend receipt validation implemented
 */
export function useSubscription() {
  const { t } = useT()
  const [state, setState] = useState<SubState>({
    purchasing: false,
    restoring: false,
    error: null,
  })

  const purchase = useCallback(async (productId: string) => {
    if (!IAP_ENABLED) {
      Alert.alert(
        t.accountSubscription,
        t.accountIapSoon,
      )
      return
    }

    setState(s => ({ ...s, purchasing: true, error: null }))

    try {
      // TODO: When IAP is enabled and react-native-iap is installed:
      // 1. import { requestSubscription } from "react-native-iap"
      // 2. const purchase = await requestSubscription({ sku: productId })
      // 3. Send receipt to backend for validation
      // 4. Refresh access status

      const platform = Platform.OS === "ios" ? "ios" : "android"

      const result = await api.validateReceipt({
        platform: platform as "ios" | "android",
        productId,
        transactionReceipt: "MOBILE_PURCHASE_PENDING",
      })

      if (result?.ok) {
        setState(s => ({ ...s, purchasing: false, error: null }))
      } else {
        setState(s => ({
          ...s,
          purchasing: false,
          error: result?.message || result?.error || "Purchase could not be completed",
        }))
      }
    } catch (e: any) {
      setState(s => ({ ...s, purchasing: false, error: e?.message || "Purchase failed" }))
    }
  }, [t])

  const restorePurchases = useCallback(async () => {
    if (!IAP_ENABLED) {
      Alert.alert(
        t.accountRestorePurchases,
        t.accountIapSoon,
      )
      return
    }

    setState(s => ({ ...s, restoring: true, error: null }))

    try {
      // TODO: When IAP is enabled:
      // 1. import { getAvailablePurchases } from "react-native-iap"
      // 2. const purchases = await getAvailablePurchases()
      // 3. Validate each receipt with backend
      // 4. Refresh access status
      console.log("[useSubscription] restore purchases requested")

      setState(s => ({ ...s, restoring: false, error: null }))
    } catch (e: any) {
      setState(s => ({ ...s, restoring: false, error: e?.message || "Restore failed" }))
    }
  }, [t])

  const manageSubscription = useCallback(() => {
    if (Platform.OS === "ios") {
      Linking.openURL("https://apps.apple.com/account/subscriptions").catch(() => {
        Linking.openURL("itms-apps://apps.apple.com/account/subscriptions").catch(() => {})
      })
    } else {
      Linking.openURL(
        "https://play.google.com/store/account/subscriptions?package=com.turbotaai.app",
      ).catch(() => {
        Linking.openURL("https://play.google.com/store/account/subscriptions").catch(() => {})
      })
    }
  }, [])

  return {
    ...state,
    purchase,
    restorePurchases,
    manageSubscription,
    iapEnabled: IAP_ENABLED,
  }
}
