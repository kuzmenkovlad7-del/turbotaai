import React from "react"
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native"
import ScreenWrapper from "@/components/ScreenWrapper"
import { useAuth, type AccessInfo } from "@/hooks/useAuth"
import { colors, fontSize, spacing, radii } from "@/constants/theme"

type Props = {
  navigation: any
}

function AccessBadge({ info }: { info: AccessInfo | null }) {
  if (!info) return null
  const map = {
    paid: { bg: colors.successLight, fg: colors.success, label: "Premium" },
    promo: { bg: "#fef3c7", fg: "#d97706", label: "Promo" },
    trial: { bg: colors.primaryLight, fg: colors.primary, label: `Trial (${info.trialLeft} left)` },
    none: { bg: colors.errorLight, fg: colors.error, label: "No access" },
  }
  const badge = map[info.access]
  return (
    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
      <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
    </View>
  )
}

export default function HomeScreen({ navigation }: Props) {
  const { user, accessInfo } = useAuth()

  const cards = [
    {
      key: "chat",
      icon: "\uD83D\uDCAC",
      title: "Chat with AI",
      desc: "Start a conversation with your companion",
      onPress: () => navigation.navigate("Chat"),
      accent: colors.primary,
    },
    {
      key: "history",
      icon: "\uD83D\uDCCB",
      title: "History",
      desc: "View your past conversations",
      onPress: () => navigation.navigate("MainTabs", { screen: "HistoryTab" }),
      accent: "#0ea5e9",
    },
    {
      key: "account",
      icon: "\uD83D\uDC64",
      title: "Account",
      desc: "Manage your profile and subscription",
      onPress: () => navigation.navigate("MainTabs", { screen: "AccountTab" }),
      accent: "#f59e0b",
    },
  ]

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>
                {user ? `Hello, ${user.email.split("@")[0]}` : "Welcome"}
              </Text>
              <Text style={styles.subtitle}>TurbotaAI</Text>
            </View>
            <AccessBadge info={accessInfo} />
          </View>
        </View>

        <View style={styles.cards}>
          {cards.map((card) => (
            <TouchableOpacity
              key={card.key}
              style={styles.card}
              activeOpacity={0.7}
              onPress={card.onPress}
            >
              <View style={[styles.cardIcon, { backgroundColor: card.accent + "15" }]}>
                <Text style={styles.cardEmoji}>{card.icon}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardDesc}>{card.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxxl },
  header: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greeting: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
  subtitle: { fontSize: fontSize.xxl, fontWeight: "800", color: colors.primary, marginTop: 2 },
  badge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full },
  badgeText: { fontSize: fontSize.xs, fontWeight: "700" },
  cards: { paddingHorizontal: spacing.xxl, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.lg,
  },
  cardEmoji: { fontSize: 26 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  cardDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
})
