import { useCallback, useState } from "react"
import { Platform, Alert, Linking } from "react-native"
import { IAP_ENABLED } from "@/constants/config"
import { useAuth } from "@/hooks/useAuth"

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
  const { refreshAccess } = useAuth()
  const [state, setState] = useState<SubState>({
    purchasing: false,
    restoring: false,
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

    setState(s => ({ ...s, purchasing: true, error: null }))

    try {
      // TODO: When IAP is enabled and react-native-iap is installed:
      // 1. import { requestSubscription } from "react-native-iap"
      // 2. const result = await requestSubscription({ sku: productId })
      // 3. Validate receipt: await api.validateReceipt({ platform, productId, transactionReceipt: result.transactionReceipt })
      // 4. await refreshAccess()
      setState(s => ({ ...s, purchasing: false }))
    } catch (e: any) {
      setState(s => ({ ...s, purchasing: false, error: e?.message || "Purchase could not be completed" }))
    }
  }, [refreshAccess])

  const restorePurchases = useCallback(async () => {
    if (!IAP_ENABLED) {
      Alert.alert(
        "Restore Purchases",
        "In-app purchases are not yet enabled. If you subscribed via the web, your access is already linked to your account.",
      )
      return
    }

    setState(s => ({ ...s, restoring: true, error: null }))

    try {
      // TODO: When IAP is enabled:
      // 1. import { getAvailablePurchases } from "react-native-iap"
      // 2. const purchases = await getAvailablePurchases()
      // 3. Validate each receipt with backend
      // 4. await refreshAccess()
      setState(s => ({ ...s, restoring: false, error: null }))
    } catch (e: any) {
      setState(s => ({ ...s, restoring: false, error: e?.message || "Restore failed" }))
    }
  }, [refreshAccess])

  const manageSubscription = useCallback(() => {
    if (Platform.OS === "ios") {
      // Opens the iOS subscription management sheet
      Linking.openURL("https://apps.apple.com/account/subscriptions").catch(() => {
        // Fallback for older iOS
        Linking.openURL("itms-apps://apps.apple.com/account/subscriptions").catch(() => {})
      })
    } else {
      // Opens Google Play subscription management
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
