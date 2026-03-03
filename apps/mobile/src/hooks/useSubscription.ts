import { useCallback, useState } from "react"
import { Platform, Alert, Linking } from "react-native"
import { IAP_ENABLED, STORE_BUILD } from "@/constants/config"
import { useAuth } from "@/hooks/useAuth"
import { validateReceipt } from "@/services/api"

type SubState = {
  purchasing: boolean
  restoring: boolean
  error: string | null
}

/**
 * Hook for managing IAP subscriptions via react-native-iap.
 *
 * When EXPO_PUBLIC_IAP_ENABLED !== "true" (dev/preview builds), purchase
 * buttons show an informational alert — no native store dialogs.
 *
 * Full IAP flow (production builds, EXPO_PUBLIC_IAP_ENABLED=true):
 * 1. Apple Developer + Google Play accounts configured
 * 2. Products created in App Store Connect / Play Console with IDs:
 *    com.turbotaai.monthly, com.turbotaai.yearly
 * 3. EAS build (react-native-iap requires native code, not Expo Go)
 * 4. Backend receipt validation at /api/billing/iap/validate
 */

/* ── Lazy-import react-native-iap so the module is not required in Expo Go ─ */
async function getRNIap() {
  return import("react-native-iap")
}

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
      const RNIap = await getRNIap()
      await RNIap.initConnection()

      const result = await RNIap.requestSubscription({ sku: productId })
      if (!result) throw new Error("Purchase cancelled or no result returned")

      // Purchases may come as array (Android) or single object (iOS)
      const purchase = Array.isArray(result) ? result[0] : result
      const transactionReceipt =
        (purchase as any)?.transactionReceipt ||
        (purchase as any)?.purchaseToken ||
        ""

      if (transactionReceipt) {
        const validated = await validateReceipt({
          platform: Platform.OS as "ios" | "android",
          productId,
          transactionReceipt,
        })
        if (!validated.ok) {
          throw new Error(validated.error || "Receipt validation failed")
        }
        // Acknowledge purchase on Android (prevents refund after 3 days)
        if (Platform.OS === "android" && (purchase as any)?.purchaseToken) {
          await RNIap.acknowledgePurchaseAndroid({
            token: (purchase as any).purchaseToken,
          }).catch(() => {})
        }
        // Finish the transaction on iOS
        if (Platform.OS === "ios") {
          await RNIap.finishTransaction({ purchase, isConsumable: false }).catch(() => {})
        }
      }

      await refreshAccess()
      setState(s => ({ ...s, purchasing: false }))
    } catch (e: any) {
      // User cancellation is not an error worth surfacing
      const isCancelled =
        e?.code === "E_USER_CANCELLED" ||
        e?.message?.toLowerCase().includes("cancel")
      setState(s => ({
        ...s,
        purchasing: false,
        error: isCancelled ? null : (e?.message || "Purchase could not be completed"),
      }))
    } finally {
      getRNIap().then(r => r.endConnection()).catch(() => {})
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
      const RNIap = await getRNIap()
      await RNIap.initConnection()
      const purchases = await RNIap.getAvailablePurchases()

      // Validate the most recent purchase for this app
      const latest = purchases.find((p: any) =>
        p.productId === "com.turbotaai.monthly" ||
        p.productId === "com.turbotaai.yearly"
      )

      if (latest) {
        const transactionReceipt =
          (latest as any)?.transactionReceipt ||
          (latest as any)?.purchaseToken ||
          ""
        if (transactionReceipt) {
          await validateReceipt({
            platform: Platform.OS as "ios" | "android",
            productId: latest.productId,
            transactionReceipt,
          }).catch(() => {})
        }
        await refreshAccess()
      } else {
        // No active subscription found — refresh access to confirm server state
        await refreshAccess()
        Alert.alert("No Active Subscription", "No active subscription was found for this account.")
      }

      setState(s => ({ ...s, restoring: false, error: null }))
    } catch (e: any) {
      setState(s => ({ ...s, restoring: false, error: e?.message || "Restore failed" }))
    } finally {
      getRNIap().then(r => r.endConnection()).catch(() => {})
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
    /**
     * true when EXPO_PUBLIC_STORE_BUILD=true (or legacy EXPO_PUBLIC_STORE_SAFE).
     * AccountScreen uses this to hide the external "Subscribe on web" CTA,
     * which is not permitted by App Store / Google Play guidelines.
     * AccountScreen also applies an iOS Platform.OS guard as a belt-and-suspenders
     * safety net so the CTA can never appear on iOS regardless of this flag.
     */
    storeBuild: STORE_BUILD,
  }
}
