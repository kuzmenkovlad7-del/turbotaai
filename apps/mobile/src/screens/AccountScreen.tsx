import React, { useState, useCallback, useRef } from "react"
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
} from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import ScreenWrapper from "@/components/ScreenWrapper"
import Button from "@/components/Button"
import { useAuth } from "@/hooks/useAuth"
import { useT } from "@/hooks/useLanguage"
import { useSubscription } from "@/hooks/useSubscription"
import { redeemPromo, cancelAutoRenew, resumeAutoRenew } from "@/services/api"
import { logEvent } from "@/services/analytics"
import { API_BASE_URL, IAP_PRODUCTS } from "@/constants/config"
import { LOCALE_LABELS, type Locale } from "@/constants/i18n"
import { colors, fontSize, spacing, radii } from "@/constants/theme"

const LOCALES: Locale[] = ["en", "uk", "ru"]

export default function AccountScreen() {
  const { user, accessInfo, logout, refreshAccess } = useAuth()
  const { t, locale, setLocale } = useT()
  const {
    purchasing,
    restoring,
    purchase,
    restorePurchases,
    manageSubscription,
    iapEnabled,
    error: iapError,
  } = useSubscription()

  // Promo code state
  const [promoCode, setPromoCode] = useState("")
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoMsg, setPromoMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Subscription action state
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Refresh access state
  const [refreshingAccess, setRefreshingAccess] = useState(false)

  // Refresh access when tab gains focus (e.g. returning from web browser after purchase/promo).
  // Debounced to 30 s so repeated tab switches don't spam the API.
  const lastFocusRefreshRef = useRef<number>(0)
  useFocusEffect(
    useCallback(() => {
      const now = Date.now()
      if (now - lastFocusRefreshRef.current > 30_000) {
        lastFocusRefreshRef.current = now
        console.log("[AccountScreen] FOCUS REFRESH triggered — current accessInfo BEFORE:", JSON.stringify({
          access: accessInfo?.access ?? "null",
          trialLeft: accessInfo?.trialLeft ?? "null",
          unlimited: accessInfo?.unlimited ?? "null",
          paidUntil: accessInfo?.paidUntil ?? "null",
          promoUntil: accessInfo?.promoUntil ?? "null",
        }))
        refreshAccess().catch(() => {})
      }
    }, [refreshAccess, accessInfo]),
  )

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
      console.log("[Account] applying promo code:", code)
      const result = await redeemPromo(code)
      if (result.ok) {
        logEvent("subscription_started", { method: "promo" })
        setPromoMsg({ text: t.accountPromoSuccess, ok: true })
        setPromoCode("")
        await refreshAccess()
      } else {
        setPromoMsg({ text: result.error || "Invalid code", ok: false })
      }
    } catch (e: any) {
      setPromoMsg({ text: e?.message || "Failed", ok: false })
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

          {/* Manage Subscription — opens platform subscription management */}
          {isPaid && (
            <View style={styles.actionSection}>
              <Button
                title={t.accountManageSubscription}
                variant="ghost"
                onPress={manageSubscription}
              />
            </View>
          )}

          {/* Subscribe CTAs for non-unlimited users */}
          {showSubscribeCTA && (
            <View style={styles.actionSection}>
              {iapEnabled ? (
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
              ) : (
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
          <View style={styles.actionSection}>
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
                try { await refreshAccess() } finally { setRefreshingAccess(false) }
              }}
              loading={refreshingAccess}
              style={{ marginTop: spacing.sm }}
            />
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
})
