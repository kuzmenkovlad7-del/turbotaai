import React from "react"
import { View, Text, StyleSheet } from "react-native"
import { colors, fontSize, spacing } from "@/constants/theme"

type Props = {
  icon?: string
  title: string
  subtitle?: string
}

export default function EmptyState({ icon, title, subtitle }: Props) {
  return (
    <View style={styles.root}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xxl },
  icon: { fontSize: 48, marginBottom: spacing.md },
  title: { fontSize: fontSize.lg, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
})
