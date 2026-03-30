import { useCallback, useState } from "react"
import { Platform, Alert, Linking } from "react-native"
import { IAP_ENABLED, STORE_BUILD, IAP_PRODUCTS } from "@/constants/config"
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
 *
 * Platform notes:
 * - iOS (StoreKit): requestSubscription resolves with the purchase object.
 * - Android (Google Play Billing): requestSubscription launches the billing
 *   UI and resolves with null/void. The purchase data arrives asynchronously
 *   via purchaseUpdatedListener. We use the listener pattern on Android
 *   to handle both immediate and deferred (pending) purchases.
 */

/* ── Lazy-import react-native-iap so the module is not required in Expo Go ─ */
async function getRNIap() {
  return import("react-native-iap")
}

const PRODUCT_IDS = [IAP_PRODUCTS.MONTHLY, IAP_PRODUCTS.YEARLY] as const

/** Timeout for awaiting a purchase listener event on Android (60 s). */
const ANDROID_PURCHASE_TIMEOUT_MS = 60_000

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

      if (Platform.OS === "android") {
        // ── Android path ─────────────────────────────────────────────────────
        // Google Play Billing resolves requestSubscription with null/void.
        // The actual purchase object arrives via purchaseUpdatedListener.
        // We wrap both the listener and the billing-flow initiation in a
        // single Promise so purchasing: true stays set until fully handled.
        await new Promise<void>((resolve, reject) => {
          let handled = false

          const timer = setTimeout(() => {
            if (handled) return
            handled = true
            purchaseSub.remove()
            errorSub.remove()
            reject(new Error("Purchase timed out. Please try again."))
          }, ANDROID_PURCHASE_TIMEOUT_MS)

          const purchaseSub = RNIap.purchaseUpdatedListener(async (p: any) => {
            if (p.productId !== productId) return
            if (handled) return
            handled = true
            clearTimeout(timer)
            purchaseSub.remove()
            errorSub.remove()

            try {
              const token = p.purchaseToken || p.transactionReceipt || ""
              if (!token) throw new Error("No purchase token received from Play Store")

              const validated = await validateReceipt({
                platform: "android",
                productId: p.productId,
                transactionReceipt: token,
                transactionId: p.transactionId || p.orderId || undefined,
              })
              if (!validated.ok) throw new Error(validated.error || "Receipt validation failed")

              // Acknowledge the purchase — required within 3 days or Google refunds it.
              await RNIap.acknowledgePurchaseAndroid({ token }).catch(() => {})
              await refreshAccess()
              setState(s => ({ ...s, purchasing: false }))
              resolve()
            } catch (innerErr: any) {
              setState(s => ({
                ...s,
                purchasing: false,
                error: innerErr?.message || "Purchase could not be completed",
              }))
              resolve()
            }
          })

          const errorSub = RNIap.purchaseErrorListener((err: any) => {
            if (handled) return
            handled = true
            clearTimeout(timer)
            purchaseSub.remove()
            errorSub.remove()

            const isCancelled =
              err?.code === "E_USER_CANCELLED" ||
              err?.message?.toLowerCase().includes("cancel")

            setState(s => ({
              ...s,
              purchasing: false,
              error: isCancelled ? null : (err?.message || "Purchase could not be completed"),
            }))
            resolve()
          })

          // Initiate the billing flow — the result is intentionally ignored on Android.
          RNIap.requestSubscription({ sku: productId }).catch((err: any) => {
            if (handled) return
            handled = true
            clearTimeout(timer)
            purchaseSub.remove()
            errorSub.remove()
            reject(err)
          })
        })
      } else {
        // ── iOS path ──────────────────────────────────────────────────────────
        // StoreKit resolves requestSubscription with the purchase object.
        const result = await RNIap.requestSubscription({ sku: productId })
        if (!result) throw new Error("Purchase cancelled or no result returned")

        const p: any = Array.isArray(result) ? result[0] : result
        const transactionReceipt: string = p?.transactionReceipt || ""
        const transactionId: string | undefined = p?.transactionId || undefined

        if (transactionReceipt) {
          const validated = await validateReceipt({
            platform: "ios",
            productId,
            transactionReceipt,
            transactionId,
          })
          if (!validated.ok) throw new Error(validated.error || "Receipt validation failed")

          // Finish the StoreKit transaction so the OS doesn't re-deliver it.
          await RNIap.finishTransaction({ purchase: p, isConsumable: false }).catch(() => {})
        }

        await refreshAccess()
        setState(s => ({ ...s, purchasing: false }))
      }
    } catch (e: any) {
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

      // Find the most recent active subscription for this app.
      // getAvailablePurchases returns only non-consumed / active purchases.
      const latest = purchases.find((p: any) =>
        (PRODUCT_IDS as readonly string[]).includes(p.productId),
      )

      if (latest) {
        const token: string =
          (latest as any)?.purchaseToken ||
          (latest as any)?.transactionReceipt ||
          ""

        if (token) {
          await validateReceipt({
            platform: Platform.OS as "ios" | "android",
            productId: latest.productId,
            transactionReceipt: token,
            transactionId: (latest as any)?.transactionId || (latest as any)?.orderId,
          }).catch(() => {})
        }
        await refreshAccess()
        setState(s => ({ ...s, restoring: false, error: null }))
      } else {
        // No active subscription found — refresh access to confirm server state.
        await refreshAccess()
        setState(s => ({ ...s, restoring: false, error: null }))
        Alert.alert(
          "No Active Subscription",
          "No active subscription was found for this account.",
        )
      }
    } catch (e: any) {
      setState(s => ({ ...s, restoring: false, error: e?.message || "Restore failed" }))
    } finally {
      getRNIap().then(r => r.endConnection()).catch(() => {})
    }
  }, [refreshAccess])

  const manageSubscription = useCallback(() => {
    if (Platform.OS === "ios") {
      // Opens the iOS subscription management sheet (iOS 15+).
      Linking.openURL("https://apps.apple.com/account/subscriptions").catch(() => {
        // Fallback deep link for older iOS.
        Linking.openURL("itms-apps://apps.apple.com/account/subscriptions").catch(() => {})
      })
    } else {
      // Opens Google Play subscription management for this app.
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
     */
    storeBuild: STORE_BUILD,
  }
}
