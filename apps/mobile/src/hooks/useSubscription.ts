import { useCallback, useState } from "react"
import { Platform, Alert, Linking } from "react-native"
import { IAP_ENABLED, IAP_PRODUCTS, STORE_BUILD } from "@/constants/config"
import { useAuth } from "@/hooks/useAuth"
import { validateReceipt } from "@/services/api"

type SubState = {
  purchasing: boolean
  error: string | null
}

/**
 * Diagnostic log for the last syncExistingPurchases run.
 * Shown on AccountScreen in a compact block so the state is visible
 * directly on-device without adb logcat.
 */
export type IapSyncLog = {
  /** ISO timestamp of when sync started */
  ts: string
  /** Did initConnection() succeed? */
  initOk: boolean
  /** How many purchases getAvailablePurchases() returned */
  purchasesCount: number
  /** One string per purchase: "pid=X pids=[Y,Z] token=present|missing" */
  purchasesInfo: string[]
  /** Which field matched the target productId: "productId" | "productIds" | null */
  matchedBy: string | null
  /** Was a non-empty purchaseToken found on the matched purchase? */
  tokenPresent: boolean
  /** Was validateReceipt() actually called? */
  validateCalled: boolean
  /** validateReceipt() result */
  validateStatus: "ok" | "fail" | null
  /** validateReceipt() error string if status="fail" */
  validateError: string | null
  /** Did refreshAccess() succeed after validation? */
  refreshed: boolean
  /** Outer-catch error message if anything threw unexpectedly */
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
 * Android notes:
 * - Google Play Billing v5+ requires subscriptionOffers with offerToken.
 * - If the user already owns the subscription (E_ALREADY_OWNED), the hook
 *   silently retrieves the existing purchaseToken via getAvailablePurchases(),
 *   re-validates it with the backend, and refreshes access — no visible error.
 */

/* ── Lazy-import react-native-iap so the module is not required in Expo Go ─ */
async function getRNIap() {
  return import("react-native-iap")
}

/**
 * Silently validate an existing (already-owned) Android subscription.
 *
 * Called in two situations:
 *   1. requestSubscription throws E_ALREADY_OWNED — the user purchased on
 *      this account before but access was never granted (e.g. after a
 *      reinstall or a failed previous validation).
 *   2. syncExistingPurchases() — triggered on Account screen focus and
 *      Refresh Access press, so recovery happens without user interaction.
 *
 * KEY FIX: matches by both p.productId (legacy) AND p.productIds (array,
 * Google Play Billing v5+ new subscription format). Previously only
 * productId was checked, so new-style subscriptions were never matched,
 * meaning purchaseToken was always empty and the backend was never called.
 *
 * Returns { ok, log } — log is displayed on AccountScreen for diagnosis.
 */
async function validateExistingAndroidPurchase(
  productId: string,
  refreshAccess: () => Promise<void>,
): Promise<{ ok: boolean; log: IapSyncLog }> {
  const log: IapSyncLog = {
    ts: new Date().toISOString(),
    initOk: false,
    purchasesCount: 0,
    purchasesInfo: [],
    matchedBy: null,
    tokenPresent: false,
    validateCalled: false,
    validateStatus: null,
    validateError: null,
    refreshed: false,
    error: null,
  }

  try {
    console.log(`[iap/sync] start productId=${productId}`)
    const RNIap = await getRNIap()

    await RNIap.initConnection()
    log.initOk = true
    console.log(`[iap/sync] initConnection OK`)

    const purchases: any[] = await RNIap.getAvailablePurchases().catch((e: any) => {
      console.error(`[iap/sync] getAvailablePurchases threw:`, e?.message)
      return []
    })

    log.purchasesCount = Array.isArray(purchases) ? purchases.length : 0
    log.purchasesInfo = Array.isArray(purchases)
      ? purchases.map((p: any) => {
          const pid = p.productId ?? "(null)"
          const pids = Array.isArray(p.productIds) ? p.productIds.join(",") : "(none)"
          const hasToken = !!(p.purchaseToken || p.transactionReceipt)
          return `pid=${pid} pids=[${pids}] token=${hasToken ? "present" : "MISSING"}`
        })
      : []

    console.log(`[iap/sync] getAvailablePurchases count=${log.purchasesCount}`)
    log.purchasesInfo.forEach((info, i) =>
      console.log(`[iap/sync] purchase[${i}]: ${info}`),
    )

    // ── Match by productId (legacy) OR productIds array (GPB v5+ new format) ──
    // Google Play Billing Library v5+ returns subscription purchases with
    // productIds: string[] (array) rather than productId: string (single).
    // If we only check productId we miss every new-style subscription purchase.
    let owned: any = null
    if (Array.isArray(purchases)) {
      owned = purchases.find((p: any) => {
        if (p.productId === productId) return true
        if (Array.isArray(p.productIds) && p.productIds.includes(productId)) return true
        return false
      })
    }

    if (owned) {
      log.matchedBy = owned.productId === productId ? "productId" : "productIds"
      console.log(`[iap/sync] matched purchase matchedBy=${log.matchedBy}`)
    } else {
      console.log(`[iap/sync] no match found for productId=${productId}`)
    }

    const purchaseToken: string =
      owned?.purchaseToken || owned?.transactionReceipt || ""
    log.tokenPresent = !!purchaseToken
    console.log(`[iap/sync] purchaseToken present=${log.tokenPresent} suffix=...${purchaseToken.slice(-10)}`)

    if (!purchaseToken) {
      console.log(`[iap/sync] early return — no purchaseToken, skipping validate`)
      return { ok: false, log }
    }

    log.validateCalled = true
    console.log(`[iap/sync] calling validateReceipt`)
    const validated = await validateReceipt({
      platform: "android",
      productId,
      transactionReceipt: purchaseToken,
      transactionId: owned?.transactionId || owned?.orderId || undefined,
    })

    log.validateStatus = validated.ok ? "ok" : "fail"
    log.validateError = validated.ok ? null : (validated.error || "unknown")
    console.log(
      `[iap/sync] validateReceipt ok=${validated.ok}${validated.ok ? ` paid_until=${validated.paid_until}` : ` error=${log.validateError}`}`,
    )

    if (!validated.ok) return { ok: false, log }

    // Acknowledge prevents Google from auto-refunding after 3 days
    await RNIap.acknowledgePurchaseAndroid({ token: purchaseToken }).catch((e: any) => {
      console.error(`[iap/sync] acknowledgePurchaseAndroid error:`, e?.message)
    })
    console.log(`[iap/sync] acknowledged OK`)

    await refreshAccess().catch((e: any) => {
      console.error(`[iap/sync] refreshAccess error:`, e?.message)
      throw e
    })
    log.refreshed = true
    console.log(`[iap/sync] refreshAccess OK — recovery complete`)

    return { ok: true, log }
  } catch (e: any) {
    log.error = e?.message || String(e)
    console.error(`[iap/sync] outer catch:`, log.error)
    return { ok: false, log }
  } finally {
    getRNIap().then(r => r.endConnection()).catch(() => {})
  }
}

export function useSubscription() {
  const { refreshAccess } = useAuth()
  const [state, setState] = useState<SubState>({
    purchasing: false,
    error: null,
  })
  const [syncLog, setSyncLog] = useState<IapSyncLog | null>(null)

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
      const code: string = e?.code || ""
      const msg: string = (e?.message || "").toLowerCase()

      const isCancelled =
        code === "E_USER_CANCELLED" || msg.includes("cancel")

      // ── Android: user already owns this subscription ───────────────────────
      // Google Play throws E_ALREADY_OWNED when requestSubscription is called
      // but a subscription already exists on this account (e.g. after reinstall
      // or a previous purchase whose validation failed to reach the backend).
      // Recovery: fetch the existing purchaseToken via getAvailablePurchases()
      // and re-submit it to /api/billing/iap/validate silently.
      const isAlreadyOwned =
        code === "E_ALREADY_OWNED" ||
        msg.includes("already owned") ||
        msg.includes("itemalreadyowned")

      if (isAlreadyOwned && Platform.OS === "android") {
        const { log } = await validateExistingAndroidPurchase(productId, refreshAccess)
        setSyncLog(log)
        setState(s => ({ ...s, purchasing: false, error: null }))
        // Either way don't surface an error — if recovery failed the user can
        // press Refresh Access; if it succeeded access is already updated.
        return
      }

      setState(s => ({
        ...s,
        purchasing: false,
        error: isCancelled ? null : (e?.message || "Purchase could not be completed"),
      }))
    } finally {
      getRNIap().then(r => r.endConnection()).catch(() => {})
    }
  }, [refreshAccess])

  /**
   * Silently check for existing Google Play purchases and validate them
   * against the backend if found.
   *
   * Safe to call on every Account screen focus and Refresh Access press:
   *   - returns immediately if IAP is disabled or platform is not Android
   *   - does not show any UI or errors on failure
   *   - idempotent: re-validating an already-validated token just re-confirms
   *     the expiry date (backend never regresses paid_until)
   */
  const syncExistingPurchases = useCallback(async () => {
    if (!IAP_ENABLED || Platform.OS !== "android") return
    const { log } = await validateExistingAndroidPurchase(IAP_PRODUCTS.MONTHLY, refreshAccess)
    setSyncLog(log)
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
    syncExistingPurchases,
    manageSubscription,
    /**
     * Last result from syncExistingPurchases / E_ALREADY_OWNED recovery.
     * null on iOS or when sync has not yet run. Displayed on AccountScreen
     * as a compact diagnostic block for on-device debugging.
     */
    syncLog,
    iapEnabled: IAP_ENABLED,
    /**
     * true when EXPO_PUBLIC_STORE_BUILD=true (or legacy EXPO_PUBLIC_STORE_SAFE).
     * AccountScreen uses this to hide the external "Subscribe on web" CTA.
     */
    storeBuild: STORE_BUILD,
  }
}
