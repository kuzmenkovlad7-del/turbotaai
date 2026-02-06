import React from "react"
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native"
import ScreenWrapper from "@/components/ScreenWrapper"
import { useAuth, type AccessInfo } from "@/hooks/useAuth"
import { useT } from "@/hooks/useLanguage"
import { colors, fontSize, spacing, radii } from "@/constants/theme"

type Props = {
  navigation: any
}

function AccessBadge({ info }: { info: AccessInfo | null }) {
  const { t } = useT()
  if (!info) return null
  const map = {
    paid: { bg: colors.successLight, fg: colors.success, label: t.badgePremium },
    promo: { bg: "#fef3c7", fg: "#d97706", label: t.badgePromo },
    trial: { bg: colors.primaryLight, fg: colors.primary, label: t.badgeTrial(info.trialLeft) },
    none: { bg: colors.errorLight, fg: colors.error, label: t.badgeNone },
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
  const { t } = useT()

  const cards = [
    {
      key: "chat",
      icon: "\uD83D\uDCAC",
      title: t.homeChat,
      desc: t.homeChatDesc,
      onPress: () => navigation.navigate("Chat"),
      accent: colors.primary,
    },
    {
      key: "video",
      icon: "\uD83C\uDFA5",
      title: t.homeVideo,
      desc: t.homeVideoDesc,
      onPress: () => navigation.navigate("VideoAssistant"),
      accent: "#0ea5e9",
    },
    {
      key: "voice",
      icon: "\uD83C\uDF99\uFE0F",
      title: t.homeVoice,
      desc: t.homeVoiceDesc,
      onPress: () => navigation.navigate("VoiceAssistant"),
      accent: "#10b981",
    },
    {
      key: "history",
      icon: "\uD83D\uDCCB",
      title: t.homeHistory,
      desc: t.homeHistoryDesc,
      onPress: () => navigation.navigate("MainTabs", { screen: "HistoryTab" }),
      accent: "#f59e0b",
    },
    {
      key: "account",
      icon: "\uD83D\uDC64",
      title: t.homeAccount,
      desc: t.homeAccountDesc,
      onPress: () => navigation.navigate("MainTabs", { screen: "AccountTab" }),
      accent: "#8b5cf6",
    },
  ]

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>
                {user?.email ? t.homeGreeting(user.email.split("@")[0]) : t.homeWelcome}
              </Text>
              <Text style={styles.subtitle}>{t.appName}</Text>
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
