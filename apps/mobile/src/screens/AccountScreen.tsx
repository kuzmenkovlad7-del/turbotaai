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
  Linking,
  Platform,
} from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import ScreenWrapper from "@/components/ScreenWrapper"
import Button from "@/components/Button"
import { useAuth } from "@/hooks/useAuth"
import { useT } from "@/hooks/useLanguage"
import { useSubscription } from "@/hooks/useSubscription"
import { redeemPromo, cancelAutoRenew, resumeAutoRenew } from "@/services/api"
import { logEvent } from "@/services/analytics"
import { API_BASE_URL, IAP_PRODUCTS, DEBUG_ENABLED } from "@/constants/config"
import { LOCALE_LABELS, type Locale } from "@/constants/i18n"
import { colors, fontSize, spacing, radii } from "@/constants/theme"

const LOCALES: Locale[] = ["en", "uk", "ru"]

export default function AccountScreen() {
  const { user, accessInfo, lastBootstrap, logout, refreshAccess, setAccessFromPromo } = useAuth()
  const { t, locale, setLocale } = useT()
  const {
    purchasing,
    restoring,
    purchase,
    restorePurchases,
    manageSubscription,
    iapEnabled,
    storeBuild,
    error: iapError,
  } = useSubscription()

  // iOS App Store policy: external purchase CTAs are never permitted on iOS,
  // regardless of the EXPO_PUBLIC_STORE_BUILD flag.  Apply as a belt-and-
  // suspenders guard so the wrong flag cannot accidentally surface a
  // non-compliant UI during App Store review.
  const hideExternalCTA = storeBuild || Platform.OS === "ios"

  // Promo code state
  const [promoCode, setPromoCode] = useState("")
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoMsg, setPromoMsg] = useState<{ text: string; ok: boolean } | null>(null)

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
      }
    }, [refreshAccess]),
  )

  // Auto-dismiss the promo success message after 3 s so it never stays stale
  useEffect(() => {
    if (!promoMsg?.ok) return
    const timer = setTimeout(() => setPromoMsg(null), 3_000)
    return () => clearTimeout(timer)
  }, [promoMsg])

  const handleLogout = () => {
    Alert.alert(t.accountSignOut, t.accountSignOutConfirm, [
      { text: t.accountCancel, style: "cancel" },
      { text: t.accountSignOut, style: "destructive", onPress: logout },
    ])
  }

  const handleSubscribeWeb = useCallback(() => {
    logEvent("subscription_cta_tapped", { method: "web" })
    Linking.openURL(`${API_BASE_URL}/pricing`).catch(() => {})
  }, [])

  const handleApplyPromo = useCallback(async () => {
    const code = promoCode.trim()
    if (!code) return
    setPromoLoading(true)
    setPromoMsg(null)
    try {
      const result = await redeemPromo(code)
      if (result.ok) {
        logEvent("subscription_started", { method: "promo" })
        setPromoMsg({ text: t.accountPromoSuccess, ok: true })
        setPromoCode("")
        // Optimistic update: apply promo access immediately using the value
        // from the API response so every screen reflects the change at once,
        // without waiting for the background bootstrap round-trip.
        if (result.promo_until) {
          setAccessFromPromo(result.promo_until)
        }
        // Await server confirmation — spinner stays until the round-trip
        // completes so the subscription box reflects the confirmed state.
        try { await refreshAccess() } catch {}
      } else {
        setPromoMsg({ text: result.error || "Invalid code", ok: false })
      }
    } catch (e: any) {
      setPromoMsg({ text: e?.message || "Failed", ok: false })
    } finally {
      setPromoLoading(false)
    }
  }, [promoCode, refreshAccess, setAccessFromPromo, t])

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

          {/* Subscribe CTAs for non-unlimited users.
              Three modes, controlled by env + platform:
              1. iapEnabled=true     → native IAP buttons (Monthly / Yearly)
              2. hideExternalCTA     → store-safe info notice, no external link
                 (true when EXPO_PUBLIC_STORE_BUILD=true OR Platform.OS==="ios")
              3. default (preview)   → "Subscribe on turbotaai.com" (QA only,
                 Android non-store builds only) */}
          {showSubscribeCTA && (
            <View style={styles.actionSection}>
              {iapEnabled ? (
                // Native IAP — full billing integration required before enabling
                <>
                  <Button
                    title={t.accountMonthly}
                    onPress={() => purchase(IAP_PRODUCTS.MONTHLY)}
                    loading={purchasing}
                    style={{ marginBottom: spacing.sm }}
                  />
                  <Button
                    title={t.accountYearly}
                    variant="secondary"
                    onPress={() => purchase(IAP_PRODUCTS.YEARLY)}
                    loading={purchasing}
                  />
                </>
              ) : hideExternalCTA ? (
                // Store-build or iOS: no external purchase CTA (store guidelines)
                <View style={styles.iapComingSoon}>
                  <Text style={styles.iapComingSoonText}>{t.accountIapSoon}</Text>
                </View>
              ) : (
                // Android preview / QA only — opens external browser
                <Button
                  title={t.accountSubscribeWeb}
                  onPress={handleSubscribeWeb}
                  style={{ marginBottom: spacing.sm }}
                />
              )}
              {iapError && <Text style={styles.error}>{iapError}</Text>}
            </View>
          )}

          {/* Restore purchases + Refresh access */}
          <View style={[styles.actionSection, { marginTop: spacing.xs }]}>
            {iapEnabled && (
              <Button
                title={t.accountRestorePurchases}
                variant="ghost"
                onPress={restorePurchases}
                loading={restoring}
              />
            )}
            <Button
              title={t.accountRefreshAccess}
              variant="outline"
              onPress={async () => {
                setRefreshingAccess(true)
                setRefreshError(null)
                setRefreshDone(false)
                try {
                  await refreshAccess()
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
        </View>

        {/* ── Debug panel — visible only when EXPO_PUBLIC_DEBUG=true ── */}
        {DEBUG_ENABLED && (
          <View style={styles.debugCard}>
            <Text style={styles.debugHeading}>Debug — Access State</Text>

            <Text style={styles.debugSection}>Network</Text>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>api_base</Text>
              <Text style={styles.debugVal} numberOfLines={1}>{API_BASE_URL || "(not set)"}</Text>
            </View>

            <Text style={styles.debugSection}>Local (in-memory)</Text>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>access</Text>
              <Text style={styles.debugVal}>{accessInfo?.access ?? "—"}</Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>trialLeft</Text>
              <Text style={styles.debugVal}>{accessInfo?.trialLeft ?? "—"}</Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>promoUntil</Text>
              <Text style={styles.debugVal}>{accessInfo?.promoUntil ?? "—"}</Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>paidUntil</Text>
              <Text style={styles.debugVal}>{accessInfo?.paidUntil ?? "—"}</Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>hasAccess</Text>
              <Text style={styles.debugVal}>{String(accessInfo?.hasAccess ?? "—")}</Text>
            </View>
            <View style={styles.debugRow}>
              <Text style={styles.debugLabel}>unlimited</Text>
              <Text style={styles.debugVal}>{String(accessInfo?.unlimited ?? "—")}</Text>
            </View>

            <Text style={styles.debugSection}>Last Server Response</Text>
            {lastBootstrap ? (
              <>
                <View style={[styles.debugRow, lastBootstrap.access !== accessInfo?.access && styles.debugMismatchRow]}>
                  <Text style={styles.debugLabel}>access</Text>
                  <Text style={styles.debugVal}>{lastBootstrap.access}</Text>
                </View>
                <View style={styles.debugRow}>
                  <Text style={styles.debugLabel}>trialLeft</Text>
                  <Text style={styles.debugVal}>{lastBootstrap.trialLeft}</Text>
                </View>
                <View style={styles.debugRow}>
                  <Text style={styles.debugLabel}>promoUntil</Text>
                  <Text style={styles.debugVal}>{lastBootstrap.promoUntil ?? "—"}</Text>
                </View>
                <View style={styles.debugRow}>
                  <Text style={styles.debugLabel}>paidUntil</Text>
                  <Text style={styles.debugVal}>{lastBootstrap.paidUntil ?? "—"}</Text>
                </View>
                <View style={styles.debugRow}>
                  <Text style={styles.debugLabel}>hasAccess</Text>
                  <Text style={styles.debugVal}>{String(lastBootstrap.hasAccess)}</Text>
                </View>
                <View style={styles.debugRow}>
                  <Text style={styles.debugLabel}>unlimited</Text>
                  <Text style={styles.debugVal}>{String(lastBootstrap.unlimited)}</Text>
                </View>
                <View style={styles.debugRow}>
                  <Text style={styles.debugLabel}>isLoggedIn</Text>
                  <Text style={styles.debugVal}>{String(lastBootstrap.isLoggedIn)}</Text>
                </View>
                <View style={styles.debugRow}>
                  <Text style={styles.debugLabel}>httpStatus</Text>
                  <Text style={[styles.debugVal, lastBootstrap.httpStatus !== 200 && styles.debugError]}>
                    {lastBootstrap.httpStatus}
                  </Text>
                </View>
                <View style={styles.debugRow}>
                  <Text style={styles.debugLabel}>fetchedAt</Text>
                  <Text style={styles.debugVal}>{lastBootstrap.fetchedAt.replace("T", " ").slice(0, 19)}</Text>
                </View>
                {lastBootstrap.error && (
                  <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>error</Text>
                    <Text style={[styles.debugVal, styles.debugError]}>{lastBootstrap.error}</Text>
                  </View>
                )}
                {lastBootstrap.access !== accessInfo?.access && (
                  <Text style={styles.debugMismatchNote}>
                    ⚠ server.access "{lastBootstrap.access}" ≠ local.access "{accessInfo?.access}"
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.debugVal}>No bootstrap data yet</Text>
            )}
          </View>
        )}
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

  // Debug panel
  debugCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.xxxl,
    borderWidth: 1,
    borderColor: "#e74c3c",
  },
  debugHeading: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: "#e74c3c",
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  debugSection: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: "#aaaacc",
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  debugRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  debugMismatchRow: {
    backgroundColor: "#7c3a0044",
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  debugLabel: {
    fontSize: fontSize.xs,
    color: "#8888aa",
    fontFamily: "monospace",
    flex: 1,
  },
  debugVal: {
    fontSize: fontSize.xs,
    color: "#e0e0ff",
    fontFamily: "monospace",
    flex: 2,
    textAlign: "right",
  },
  debugError: {
    color: "#e74c3c",
  },
  debugMismatchNote: {
    fontSize: fontSize.xs,
    color: "#f39c12",
    marginTop: spacing.sm,
    fontWeight: "600",
  },
})
