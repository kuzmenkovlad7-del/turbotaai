import React from "react"
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native"
import ScreenWrapper from "@/components/ScreenWrapper"
import Button from "@/components/Button"
import { useAuth } from "@/hooks/useAuth"
import { useSubscription } from "@/hooks/useSubscription"
import { IAP_PRODUCTS } from "@/constants/config"
import { colors, fontSize, spacing, radii } from "@/constants/theme"

export default function AccountScreen() {
  const { user, accessInfo, logout } = useAuth()
  const { purchasing, purchase, iapEnabled, error } = useSubscription()

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ])
  }

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Account</Text>

        {/* Profile card */}
        <View style={styles.card}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>
              {user ? user.email[0].toUpperCase() : "?"}
            </Text>
          </View>
          <Text style={styles.email}>{user?.email ?? "Guest"}</Text>
          {user && (
            <Button
              title="Sign Out"
              variant="outline"
              onPress={handleLogout}
              style={{ marginTop: spacing.md, alignSelf: "center" }}
            />
          )}
        </View>

        {/* Subscription card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Subscription</Text>

          {accessInfo?.unlimited ? (
            <View style={styles.activeBox}>
              <Text style={styles.activeLabel}>
                {accessInfo.access === "paid" ? "Premium Active" : "Promo Active"}
              </Text>
              {accessInfo.paidUntil && (
                <Text style={styles.activeDate}>
                  Until {new Date(accessInfo.paidUntil).toLocaleDateString()}
                </Text>
              )}
            </View>
          ) : accessInfo?.access === "trial" ? (
            <View style={styles.trialBox}>
              <Text style={styles.trialLabel}>Free Trial</Text>
              <Text style={styles.trialCount}>
                {accessInfo.trialLeft} question{accessInfo.trialLeft !== 1 ? "s" : ""} remaining
              </Text>
            </View>
          ) : (
            <View style={styles.noAccessBox}>
              <Text style={styles.noAccessLabel}>No Active Plan</Text>
              <Text style={styles.noAccessDesc}>Subscribe to get unlimited access</Text>
            </View>
          )}

          {iapEnabled && !accessInfo?.unlimited && (
            <View style={styles.iapButtons}>
              <Button
                title="Monthly Subscription"
                onPress={() => purchase(IAP_PRODUCTS.MONTHLY)}
                loading={purchasing}
                style={{ marginBottom: spacing.sm }}
              />
              <Button
                title="Yearly Subscription (Best Value)"
                variant="secondary"
                onPress={() => purchase(IAP_PRODUCTS.YEARLY)}
                loading={purchasing}
              />
            </View>
          )}

          {!iapEnabled && !accessInfo?.unlimited && (
            <Text style={styles.iapDisabledNote}>
              In-app purchases will be available soon. Visit turbotaai.com to subscribe now.
            </Text>
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
