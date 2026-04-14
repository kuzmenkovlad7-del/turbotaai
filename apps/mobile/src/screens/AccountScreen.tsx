import React, { useState, useCallback, useRef, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import ScreenWrapper from "@/components/ScreenWrapper"
import Button from "@/components/Button"
import { useAuth } from "@/hooks/useAuth"
import { useT } from "@/hooks/useLanguage"
import { useSubscription } from "@/hooks/useSubscription"
import { redeemPromo, cancelAutoRenew, resumeAutoRenew, cancelPromo } from "@/services/api"
import { logEvent } from "@/services/analytics"
import { IAP_PRODUCTS, DEBUG_ENABLED } from "@/constants/config"
import { LOCALE_LABELS, type Locale } from "@/constants/i18n"
import { colors, fontSize, spacing, radii } from "@/constants/theme"

const LOCALES: Locale[] = ["en", "uk", "ru"]

export default function AccountScreen() {
  const { user, accessInfo, logout, refreshAccess } = useAuth()
  const { t, locale, setLocale } = useT()
  const {
    purchasing,
    purchase,
    syncExistingPurchases,
    manageSubscription,
    iapEnabled,
    error: iapError,
  } = useSubscription()

  // Promo code state
  const [promoCode, setPromoCode] = useState("")
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoMsg, setPromoMsg] = useState<{ text: string; ok: boolean } | null>(null)
  // Debug diagnostics for EXPO_PUBLIC_DEBUG panel
  const [lastPromoRedeem, setLastPromoRedeem] = useState<{
    httpStatus: number
    ok: boolean
    error?: string
    fetchedAt: string
  } | null>(null)

  // Subscription action state
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Refresh access state
  const [refreshingAccess, setRefreshingAccess] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [refreshDone, setRefreshDone] = useState(false)

  // Refresh access when tab gains focus (e.g. returning from web browser after purchase/promo).
  // Debounced to 30 s so repeated tab switches don't spam the API.
  const lastFocusRefreshRef = useRef<number>(0)
  useFocusEffect(
    useCallback(() => {
      const now = Date.now()
      if (now - lastFocusRefreshRef.current > 30_000) {
        lastFocusRefreshRef.current = now
        refreshAccess().catch(() => {})
        // Silently recover any existing Google Play subscription on Android.
        // No-op on iOS or when IAP is disabled.
        syncExistingPurchases().catch(() => {})
      }
    }, [refreshAccess, syncExistingPurchases]),
  )

  // Auto-dismiss the promo success message after 3 s so it never stays stale
  useEffect(() => {
    if (!promoMsg?.ok) return
    const timer = setTimeout(() => setPromoMsg(null), 3_000)
    return () => clearTimeout(timer)
  }, [promoMsg])

  // Clear stale action feedback whenever the access level changes (e.g. trial→promo
  // after redeem, or promo→trial after cancel).  Without this, a "Done!" message
  // from a previous cancel stays in the actionMsg state and re-appears if the user
  // redeems a promo code and the promo block re-mounts.
  useEffect(() => {
    setActionMsg(null)
  }, [accessInfo?.access])

  // Auto-dismiss action success message after 3 s (mirrors promoMsg behaviour)
  useEffect(() => {
    if (!actionMsg?.ok) return
    const timer = setTimeout(() => setActionMsg(null), 3_000)
    return () => clearTimeout(timer)
  }, [actionMsg])

  const handleLogout = () => {
    Alert.alert(t.accountSignOut, t.accountSignOutConfirm, [
      { text: t.accountCancel, style: "cancel" },
      { text: t.accountSignOut, style: "destructive", onPress: logout },
    ])
  }

  const handleApplyPromo = useCallback(async () => {
    const code = promoCode.trim()
    if (!code) return
    setPromoLoading(true)
    setPromoMsg(null)
    try {
      const result = await redeemPromo(code)
      // Record diagnostics for the EXPO_PUBLIC_DEBUG panel regardless of outcome
      setLastPromoRedeem({
        httpStatus: result.httpStatus,
        ok: result.ok,
        error: result.ok ? undefined : (result.error || "unknown"),
        fetchedAt: new Date().toISOString(),
      })
      if (result.ok) {
        logEvent("subscription_started", { method: "promo" })
        setPromoMsg({ text: t.accountPromoSuccess, ok: true })
        setPromoCode("")
        // Refresh from bootstrap — the server is the single source of truth for
        // promo_until. Do NOT apply result.promo_until optimistically: the redeem
        // route computes addDaysIso(days) fresh from today on every call, so the
        // response date may differ from the stored grant date (which laterDateIso
        // may have set earlier). Applying it optimistically causes a visible flash
        // of the wrong date that then reverts when bootstrap responds.
        try { await refreshAccess() } catch {}
      } else {
        // Map by HTTP status so the user sees a meaningful localised message
        // rather than a raw error string or the generic "Invalid code" fallback.
        let msg: string
        if (result.httpStatus === 401) {
          msg = t.accountPromoErrorLogin
        } else if (result.httpStatus >= 500) {
          msg = t.accountPromoErrorServer
        } else {
          // 400 or any unexpected code → treat as invalid
          msg = t.accountPromoErrorInvalid
        }
        setPromoMsg({ text: msg, ok: false })
      }
    } catch (e: any) {
      setPromoMsg({ text: t.accountPromoErrorServer, ok: false })
    } finally {
      setPromoLoading(false)
    }
  }, [promoCode, refreshAccess, t])

  const handleCancelAutoRenew = useCallback(() => {
    Alert.alert(t.accountCancelAutoRenew, t.accountCancelConfirm, [
      { text: t.accountCancel, style: "cancel" },
      {
        text: t.accountCancelAutoRenew,
        style: "destructive",
        onPress: async () => {
          setActionLoading(true)
          setActionMsg(null)
          try {
            const result = await cancelAutoRenew()
            if (result.ok) {
              setActionMsg({ text: t.accountActionSuccess, ok: true })
              await refreshAccess()
            } else {
              setActionMsg({ text: result.error || "Failed", ok: false })
            }
          } catch (e: any) {
            setActionMsg({ text: e?.message || "Failed", ok: false })
          } finally {
            setActionLoading(false)
          }
        },
      },
    ])
  }, [refreshAccess, t])

  const handleResumeAutoRenew = useCallback(() => {
    Alert.alert(t.accountResumeAutoRenew, t.accountResumeConfirm, [
      { text: t.accountCancel, style: "cancel" },
      {
        text: t.accountResumeAutoRenew,
        onPress: async () => {
          setActionLoading(true)
          setActionMsg(null)
          try {
            const result = await resumeAutoRenew()
            if (result.ok) {
              setActionMsg({ text: t.accountActionSuccess, ok: true })
              await refreshAccess()
            } else {
              setActionMsg({ text: result.error || "Failed", ok: false })
            }
          } catch (e: any) {
            setActionMsg({ text: e?.message || "Failed", ok: false })
          } finally {
            setActionLoading(false)
          }
        },
      },
    ])
  }, [refreshAccess, t])

  const handleCancelPromo = useCallback(() => {
    Alert.alert(t.accountCancelPromo, t.accountCancelPromoConfirm, [
      { text: t.accountCancel, style: "cancel" },
      {
        text: t.accountCancelPromo,
        style: "destructive",
        onPress: async () => {
          setActionLoading(true)
          setActionMsg(null)
          try {
            const result = await cancelPromo()
            if (result.ok) {
              setActionMsg({ text: t.accountActionSuccess, ok: true })
              await refreshAccess()
            } else {
              setActionMsg({ text: t.accountPromoErrorServer, ok: false })
            }
          } catch (e: any) {
            setActionMsg({ text: t.accountPromoErrorServer, ok: false })
          } finally {
            setActionLoading(false)
          }
        },
      },
    ])
  }, [refreshAccess, t])

  const fmtDate = (iso: string | null) => {
    if (!iso) return null
    try {
      return new Date(iso).toLocaleDateString()
    } catch {
      return iso
    }
  }

  const isPaid = accessInfo?.access === "paid"
  const isPromo = accessInfo?.access === "promo"
  const isTrial = accessInfo?.access === "trial"
  const showSubscribeCTA = !accessInfo?.unlimited

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>{t.accountTitle}</Text>

        {/* Profile card */}
        <View style={styles.card}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>
              {user?.email ? user.email[0].toUpperCase() : "?"}
            </Text>
          </View>
          <Text style={styles.email}>{user?.email ?? t.guest}</Text>
          {user && (
            <Button
              title={t.accountSignOut}
              variant="outline"
              onPress={handleLogout}
              style={{ marginTop: spacing.md, alignSelf: "center" }}
            />
          )}
        </View>

        {/* Language card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t.accountLanguage}</Text>
          <View style={styles.langRow}>
            {LOCALES.map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.langBtn, l === locale && styles.langBtnActive]}
                onPress={() => setLocale(l)}
                activeOpacity={0.7}
              >
                <Text style={[styles.langLabel, l === locale && styles.langLabelActive]}>
                  {LOCALE_LABELS[l]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Subscription card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t.accountSubscription}</Text>

          {!accessInfo ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : isPaid ? (
            <View style={styles.activeBox}>
              <Text style={styles.activeLabel}>{t.accountPremium}</Text>
              {accessInfo.paidUntil && (
                <Text style={styles.activeDate}>
                  {t.accountUntil(fmtDate(accessInfo.paidUntil)!)}
                </Text>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t.accountAutoRenew}:</Text>
                <Text style={[styles.detailValue, { color: accessInfo.autoRenew ? colors.success : colors.textMuted }]}>
                  {accessInfo.autoRenew ? t.accountAutoRenewOn : t.accountAutoRenewOff}
                </Text>
              </View>
            </View>
          ) : isPromo ? (
            <View style={styles.promoBox}>
              <Text style={styles.promoLabel}>{t.accountPromo}</Text>
              {accessInfo.promoUntil && (
                <Text style={styles.promoDate}>
                  {t.accountPromoUntil(fmtDate(accessInfo.promoUntil)!)}
                </Text>
              )}
            </View>
          ) : isTrial ? (
            <View style={styles.trialBox}>
              <Text style={styles.trialLabel}>{t.accountTrial}</Text>
              <Text style={styles.trialCount}>
                {t.accountTrialCount(accessInfo.trialLeft)}
              </Text>
            </View>
          ) : (
            <View style={styles.noAccessBox}>
              <Text style={styles.noAccessLabel}>{t.accountNoPlan}</Text>
              <Text style={styles.noAccessDesc}>{t.accountNoPlanDesc}</Text>
            </View>
          )}

          {/* Cancel promo for promo users — mirrors web /profile "Cancel promo" button */}
          {isPromo && (
            <View style={styles.actionSection}>
              <Button
                title={t.accountCancelPromo}
                variant="outline"
                onPress={handleCancelPromo}
                loading={actionLoading}
              />
              {actionMsg && (
                <Text style={[styles.actionFeedback, { color: actionMsg.ok ? colors.success : colors.error }]}>
                  {actionMsg.text}
                </Text>
              )}
            </View>
          )}

          {/* Auto-renew management for paid users */}
          {isPaid && (
            <View style={styles.actionSection}>
              {accessInfo.autoRenew ? (
                <Button
                  title={t.accountCancelAutoRenew}
                  variant="outline"
                  onPress={handleCancelAutoRenew}
                  loading={actionLoading}
                />
              ) : (
                <Button
                  title={t.accountResumeAutoRenew}
                  variant="secondary"
                  onPress={handleResumeAutoRenew}
                  loading={actionLoading}
                />
              )}
              {actionMsg && (
                <Text style={[styles.actionFeedback, { color: actionMsg.ok ? colors.success : colors.error }]}>
                  {actionMsg.text}
                </Text>
              )}
            </View>
          )}

          {/* Manage Subscription — opens App Store / Play Store subscription management.
              Only relevant for users with a native IAP subscription; web-only subscribers
              have no entry in the platform stores to manage. */}
          {isPaid && iapEnabled && (
            <View style={styles.actionSection}>
              <Button
                title={t.accountManageSubscription}
                variant="ghost"
                onPress={manageSubscription}
              />
            </View>
          )}

          {/* Subscribe CTA — monthly plan only */}
          {showSubscribeCTA && (
            <View style={styles.actionSection}>
              {iapEnabled ? (
                <Button
                  title={t.accountMonthly}
                  onPress={() => purchase(IAP_PRODUCTS.MONTHLY)}
                  loading={purchasing}
                />
              ) : (
                // No IAP: show coming-soon notice (store-safe, no external link)
                <View style={styles.iapComingSoon}>
                  <Text style={styles.iapComingSoonText}>{t.accountIapSoon}</Text>
                </View>
              )}
              {iapError && <Text style={styles.error}>{iapError}</Text>}
            </View>
          )}

          {/* Refresh access */}
          <View style={[styles.actionSection, { marginTop: spacing.xs }]}>
            <Button
              title={t.accountRefreshAccess}
              variant="outline"
              onPress={async () => {
                setRefreshingAccess(true)
                setRefreshError(null)
                setRefreshDone(false)
                try {
                  // Run bootstrap and Android purchase recovery concurrently.
                  // syncExistingPurchases is a no-op on iOS / when IAP is disabled.
                  await Promise.all([
                    refreshAccess(),
                    syncExistingPurchases().catch(() => {}),
                  ])
                  setRefreshDone(true)
                  setTimeout(() => setRefreshDone(false), 2_500)
                } catch {
                  setRefreshError(t.accountRefreshError)
                } finally {
                  setRefreshingAccess(false)
                }
              }}
              loading={refreshingAccess}
              style={{ marginTop: spacing.sm }}
            />
            {refreshError && (
              <Text style={styles.error}>{refreshError}</Text>
            )}
            {refreshDone && !refreshError && (
              <Text style={[styles.actionFeedback, { color: colors.success }]}>
                {t.accountRefreshDone}
              </Text>
            )}
          </View>

          {/* Promo code input */}
          <View style={styles.promoSection}>
            <Text style={styles.promoSectionTitle}>{t.accountApplyPromo}</Text>
            <View style={styles.promoRow}>
              <TextInput
                style={styles.promoInput}
                value={promoCode}
                onChangeText={setPromoCode}
                placeholder={t.accountPromoPlaceholder}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!promoLoading}
              />
              <Button
                title={t.accountPromoApply}
                onPress={handleApplyPromo}
                loading={promoLoading}
                disabled={!promoCode.trim()}
                style={styles.promoApplyBtn}
                textStyle={{ fontSize: fontSize.sm }}
              />
            </View>
            {promoMsg && (
              <Text style={[styles.promoFeedback, { color: promoMsg.ok ? colors.success : colors.error }]}>
                {promoMsg.text}
              </Text>
            )}
          </View>

          {/* EXPO_PUBLIC_DEBUG diagnostics — only visible when DEBUG_ENABLED=true */}
          {DEBUG_ENABLED && (
            <View style={styles.debugBox}>
              <Text style={styles.debugTitle}>🛠 Debug · Access state</Text>
              <Text style={styles.debugRow} selectable>
                {`access:    ${accessInfo?.access ?? "—"}\n`}
                {`unlimited: ${accessInfo?.unlimited ?? false}\n`}
                {`trialLeft: ${accessInfo?.trialLeft ?? "—"}\n`}
                {`paidUntil: ${accessInfo?.paidUntil ?? "null"}\n`}
                {`promoUntil:${accessInfo?.promoUntil ?? "null"}`}
              </Text>
              {lastPromoRedeem && (
                <>
                  <Text style={[styles.debugTitle, { marginTop: 8 }]}>📋 lastPromoRedeem</Text>
                  <Text style={styles.debugRow} selectable>
                    {`httpStatus: ${lastPromoRedeem.httpStatus}\n`}
                    {`ok:         ${lastPromoRedeem.ok}\n`}
                    {lastPromoRedeem.error ? `error:      ${lastPromoRedeem.error}\n` : ""}
                    {`fetchedAt:  ${lastPromoRedeem.fetchedAt}`}
                  </Text>
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxxl },
  screenTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  avatarLetter: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.primary },
  email: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center" },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  langRow: { flexDirection: "row", gap: spacing.sm },
  langBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  langBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  langLabel: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary },
  langLabelActive: { color: colors.primary },

  // Status boxes
  activeBox: {
    backgroundColor: colors.successLight,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  activeLabel: { fontSize: fontSize.md, fontWeight: "700", color: colors.success },
  activeDate: { fontSize: fontSize.sm, color: colors.success, marginTop: 4 },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  detailLabel: { fontSize: fontSize.sm, color: colors.success, marginRight: spacing.xs },
  detailValue: { fontSize: fontSize.sm, fontWeight: "600" },
  promoBox: {
    backgroundColor: "#fef3c7",
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  promoLabel: { fontSize: fontSize.md, fontWeight: "700", color: "#d97706" },
  promoDate: { fontSize: fontSize.sm, color: "#d97706", marginTop: 4 },
  trialBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  trialLabel: { fontSize: fontSize.md, fontWeight: "700", color: colors.primary },
  trialCount: { fontSize: fontSize.sm, color: colors.primary, marginTop: 4 },
  noAccessBox: {
    backgroundColor: colors.errorLight,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  noAccessLabel: { fontSize: fontSize.md, fontWeight: "700", color: colors.error },
  noAccessDesc: { fontSize: fontSize.sm, color: colors.error, marginTop: 4 },

  // Action sections
  actionSection: { marginTop: spacing.lg },
  actionFeedback: {
    fontSize: fontSize.sm,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  error: {
    fontSize: fontSize.sm,
    color: colors.error,
    marginTop: spacing.md,
    textAlign: "center",
  },

  // Store-safe coming-soon notice
  iapComingSoon: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  iapComingSoonText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    lineHeight: 20,
    textAlign: "center",
  },

  // Promo section
  promoSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  promoSectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  promoRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.background,
  },
  promoApplyBtn: {
    paddingHorizontal: spacing.lg,
  },
  promoFeedback: {
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },

  // EXPO_PUBLIC_DEBUG diagnostics panel
  debugBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  debugTitle: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  debugRow: {
    fontSize: fontSize.xs,
    fontFamily: "monospace",
    color: colors.textSecondary,
    lineHeight: 18,
  },
})
