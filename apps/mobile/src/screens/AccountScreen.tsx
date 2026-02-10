import React, { useState, useCallback } from "react"
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
  useColorScheme,
} from "react-native"
import ScreenWrapper from "@/components/ScreenWrapper"
import Button from "@/components/Button"
import { useAuth } from "@/hooks/useAuth"
import { useT } from "@/hooks/useLanguage"
import { useSubscription } from "@/hooks/useSubscription"
import { redeemPromo, cancelAutoRenew, resumeAutoRenew } from "@/services/api"
import { API_BASE_URL, IAP_PRODUCTS } from "@/constants/config"
import { LOCALE_LABELS, type Locale } from "@/constants/i18n"
import { colors, darkColors, fontSize, spacing, radii } from "@/constants/theme"

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
  const scheme = useColorScheme()
  const isDark = scheme === "dark"
  const c = isDark ? darkColors : colors

  // Promo code state
  const [promoCode, setPromoCode] = useState("")
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoMsg, setPromoMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Subscription action state
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Refresh access state
  const [refreshingAccess, setRefreshingAccess] = useState(false)

  const handleLogout = () => {
    Alert.alert(t.accountSignOut, t.accountSignOutConfirm, [
      { text: t.accountCancel, style: "cancel" },
      { text: t.accountSignOut, style: "destructive", onPress: logout },
    ])
  }

  const handleSubscribeWeb = useCallback(() => {
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
  // Only show subscribe CTA for users without unlimited/paid/promo access
  const showSubscribeCTA = !isPaid && !isPromo && !accessInfo?.unlimited

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.screenTitle, { color: c.text }]}>{t.accountTitle}</Text>

        {/* Profile card */}
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={[styles.avatarCircle, { backgroundColor: c.primaryLight }]}>
            <Text style={[styles.avatarLetter, { color: c.primary }]}>
              {user?.email ? user.email[0].toUpperCase() : "?"}
            </Text>
          </View>
          <Text style={[styles.email, { color: c.textSecondary }]}>{user?.email ?? t.guest}</Text>
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
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>{t.accountLanguage}</Text>
          <View style={styles.langRow}>
            {LOCALES.map((l) => (
              <TouchableOpacity
                key={l}
                style={[
                  styles.langBtn,
                  { borderColor: c.border },
                  l === locale && { borderColor: c.primary, backgroundColor: c.primaryLight },
                ]}
                onPress={() => setLocale(l)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.langLabel,
                  { color: c.textSecondary },
                  l === locale && { color: c.primary },
                ]}>
                  {LOCALE_LABELS[l]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Subscription card */}
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>{t.accountSubscription}</Text>

          {!accessInfo ? (
            <ActivityIndicator size="small" color={c.primary} style={{ marginVertical: spacing.lg }} />
          ) : isPaid ? (
            <View style={[styles.activeBox, { backgroundColor: c.successLight }]}>
              <Text style={[styles.activeLabel, { color: c.success }]}>{t.accountPremium}</Text>
              {accessInfo.paidUntil && (
                <Text style={[styles.activeDate, { color: c.success }]}>
                  {t.accountUntil(fmtDate(accessInfo.paidUntil)!)}
                </Text>
              )}
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: c.success }]}>{t.accountAutoRenew}:</Text>
                <Text style={[styles.detailValue, { color: accessInfo.autoRenew ? c.success : c.textMuted }]}>
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
            <View style={[styles.trialBox, { backgroundColor: c.primaryLight }]}>
              <Text style={[styles.trialLabel, { color: c.primary }]}>{t.accountTrial}</Text>
              <Text style={[styles.trialCount, { color: c.primary }]}>
                {t.accountTrialCount(accessInfo.trialLeft)}
              </Text>
            </View>
          ) : (
            <View style={[styles.noAccessBox, { backgroundColor: c.errorLight }]}>
              <Text style={[styles.noAccessLabel, { color: c.error }]}>{t.accountNoPlan}</Text>
              <Text style={[styles.noAccessDesc, { color: c.error }]}>{t.accountNoPlanDesc}</Text>
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
                <Text style={[styles.actionFeedback, { color: actionMsg.ok ? c.success : c.error }]}>
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
              {iapError && <Text style={[styles.error, { color: c.error }]}>{iapError}</Text>}
            </View>
          )}

          {/* Restore purchases + Refresh access */}
          <View style={styles.actionSection}>
            <Button
              title={t.accountRestorePurchases}
              variant="ghost"
              onPress={restorePurchases}
              loading={restoring}
            />
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
          <View style={[styles.promoSection, { borderTopColor: c.border }]}>
            <Text style={[styles.promoSectionTitle, { color: c.textSecondary }]}>{t.accountApplyPromo}</Text>
            <View style={styles.promoRow}>
              <TextInput
                style={[styles.promoInput, { borderColor: c.border, color: c.text, backgroundColor: c.background }]}
                value={promoCode}
                onChangeText={setPromoCode}
                placeholder={t.accountPromoPlaceholder}
                placeholderTextColor={c.textMuted}
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
              <Text style={[styles.promoFeedback, { color: promoMsg.ok ? c.success : c.error }]}>
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  card: {
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
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  avatarLetter: { fontSize: fontSize.xxl, fontWeight: "700" },
  email: { fontSize: fontSize.md, textAlign: "center" },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", marginBottom: spacing.md },
  langRow: { flexDirection: "row", gap: spacing.sm },
  langBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: "center",
  },
  langLabel: { fontSize: fontSize.sm, fontWeight: "600" },

  // Status boxes
  activeBox: {
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  activeLabel: { fontSize: fontSize.md, fontWeight: "700" },
  activeDate: { fontSize: fontSize.sm, marginTop: 4 },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  detailLabel: { fontSize: fontSize.sm, marginRight: spacing.xs },
  detailValue: { fontSize: fontSize.sm, fontWeight: "600" },
  promoBox: {
    backgroundColor: "#fef3c7",
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  promoLabel: { fontSize: fontSize.md, fontWeight: "700", color: "#d97706" },
  promoDate: { fontSize: fontSize.sm, color: "#d97706", marginTop: 4 },
  trialBox: {
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  trialLabel: { fontSize: fontSize.md, fontWeight: "700" },
  trialCount: { fontSize: fontSize.sm, marginTop: 4 },
  noAccessBox: {
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  noAccessLabel: { fontSize: fontSize.md, fontWeight: "700" },
  noAccessDesc: { fontSize: fontSize.sm, marginTop: 4 },

  // Action sections
  actionSection: { marginTop: spacing.lg },
  actionFeedback: {
    fontSize: fontSize.sm,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  error: {
    fontSize: fontSize.sm,
    marginTop: spacing.md,
    textAlign: "center",
  },

  // Promo section
  promoSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
  },
  promoSectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  promoRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
  },
  promoApplyBtn: {
    paddingHorizontal: spacing.lg,
  },
  promoFeedback: {
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
})
