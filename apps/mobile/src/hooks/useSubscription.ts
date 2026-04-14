import { useCallback, useState } from "react"
import { Platform, Alert, Linking } from "react-native"
import { IAP_ENABLED, STORE_BUILD } from "@/constants/config"
import { useAuth } from "@/hooks/useAuth"
import { validateReceipt } from "@/services/api"

type SubState = {
  purchasing: boolean
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
 * 2. Monthly product created in App Store Connect / Play Console with ID:
 *    com.turbotaai.monthly
 * 3. EAS build (react-native-iap requires native code, not Expo Go)
 * 4. Backend receipt validation at /api/billing/iap/validate
 *
 * Android note: Google Play Billing Library v5+ (required for targetSdk 35)
 * requires subscriptionOffers with an offerToken in requestSubscription.
 * The offerToken is fetched at purchase time via getSubscriptions() and is
 * NOT hardcoded — it changes per base plan / offer configuration in Play Console.
 */

/* ── Lazy-import react-native-iap so the module is not required in Expo Go ─ */
async function getRNIap() {
  return import("react-native-iap")
}

export function useSubscription() {
  const { refreshAccess } = useAuth()
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

    setState(s => ({ ...s, purchasing: true, error: null }))

    try {
      const RNIap = await getRNIap()
      await RNIap.initConnection()

      // ── Android: Google Play Billing v5+ requires subscriptionOffers ──────
      // requestSubscription({ sku }) alone throws:
      //   "subscriptionOffers are required for Google Play subscriptions"
      // We must call getSubscriptions() first to obtain the offerToken for
      // the product's default base plan offer, then pass it in subscriptionOffers.
      let purchaseParams: any
      if (Platform.OS === "android") {
        const subs: any[] = await RNIap.getSubscriptions({ skus: [productId] }).catch(() => [])
        const sub = subs.find((s: any) => s.productId === productId)
        const offerDetails: any[] = (sub as any)?.subscriptionOfferDetails ?? []
        const offerToken: string | null =
          offerDetails.length > 0 ? (offerDetails[0]?.offerToken ?? null) : null

        if (!offerToken) {
          throw new Error(
            "This subscription is not available right now. Please check back later or contact support.",
          )
        }
        purchaseParams = {
          sku: productId,
          subscriptionOffers: [{ sku: productId, offerToken }],
        }
      } else {
        // iOS — plain sku is sufficient
        purchaseParams = { sku: productId }
      }

      const result = await RNIap.requestSubscription(purchaseParams)
      if (!result) throw new Error("Purchase cancelled or no result returned")

      // Purchases may come as array (Android) or single object (iOS)
      const purchase = Array.isArray(result) ? result[0] : result
      const transactionReceipt =
        (purchase as any)?.transactionReceipt ||
        (purchase as any)?.purchaseToken ||
        ""
      const transactionId: string | undefined =
        (purchase as any)?.transactionId || (purchase as any)?.orderId || undefined

      if (transactionReceipt) {
        const validated = await validateReceipt({
          platform: Platform.OS as "ios" | "android",
          productId,
          transactionReceipt,
          transactionId,
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

  const manageSubscription = useCallback(() => {
    if (Platform.OS === "ios") {
      // Opens the iOS subscription management sheet
      Linking.openURL("https://apps.apple.com/account/subscriptions").catch(() => {
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
    manageSubscription,
    iapEnabled: IAP_ENABLED,
    /**
     * true when EXPO_PUBLIC_STORE_BUILD=true (or legacy EXPO_PUBLIC_STORE_SAFE).
     * AccountScreen uses this to hide the external "Subscribe on web" CTA.
     */
    storeBuild: STORE_BUILD,
  }
}
