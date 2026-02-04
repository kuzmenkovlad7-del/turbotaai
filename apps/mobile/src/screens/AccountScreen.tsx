import React from "react"
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, TouchableOpacity } from "react-native"
import ScreenWrapper from "@/components/ScreenWrapper"
import Button from "@/components/Button"
import { useAuth } from "@/hooks/useAuth"
import { useT } from "@/hooks/useLanguage"
import { useSubscription } from "@/hooks/useSubscription"
import { IAP_PRODUCTS } from "@/constants/config"
import { LOCALE_LABELS, type Locale } from "@/constants/i18n"
import { colors, fontSize, spacing, radii } from "@/constants/theme"

const LOCALES: Locale[] = ["en", "uk", "ru"]

export default function AccountScreen() {
  const { user, accessInfo, logout, refreshAccess } = useAuth()
  const { t, locale, setLocale } = useT()
  const { purchasing, purchase, iapEnabled, error } = useSubscription()

  const handleLogout = () => {
    Alert.alert(t.accountSignOut, t.accountSignOutConfirm, [
      { text: t.accountCancel, style: "cancel" },
      { text: t.accountSignOut, style: "destructive", onPress: logout },
    ])
  }

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
          ) : accessInfo.unlimited ? (
            <View style={styles.activeBox}>
              <Text style={styles.activeLabel}>
                {accessInfo.access === "paid" ? t.accountPremium : t.accountPromo}
              </Text>
              {accessInfo.paidUntil && (
                <Text style={styles.activeDate}>
                  {t.accountUntil(new Date(accessInfo.paidUntil).toLocaleDateString())}
                </Text>
              )}
            </View>
          ) : accessInfo?.access === "trial" ? (
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

          {iapEnabled && !accessInfo?.unlimited && (
            <View style={styles.iapButtons}>
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
            </View>
          )}

          {!iapEnabled && !accessInfo?.unlimited && (
            <Text style={styles.iapDisabledNote}>{t.accountIapSoon}</Text>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
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
  activeBox: {
    backgroundColor: colors.successLight,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  activeLabel: { fontSize: fontSize.md, fontWeight: "700", color: colors.success },
  activeDate: { fontSize: fontSize.sm, color: colors.success, marginTop: 4 },
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
  iapButtons: { marginTop: spacing.lg },
  iapDisabledNote: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.lg,
    lineHeight: 20,
  },
  error: {
    fontSize: fontSize.sm,
    color: colors.error,
    marginTop: spacing.md,
    textAlign: "center",
  },
})
