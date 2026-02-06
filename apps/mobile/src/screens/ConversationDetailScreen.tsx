import React, { useEffect, useState, useCallback } from "react"
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native"
import ScreenWrapper from "@/components/ScreenWrapper"
import Button from "@/components/Button"
import * as api from "@/services/api"
import { useT } from "@/hooks/useLanguage"
import { colors, fontSize, spacing, radii } from "@/constants/theme"

type Props = {
  route: { params: { id: string; title?: string } }
}

export default function ConversationDetailScreen({ route }: Props) {
  const { id } = route.params
  const { t } = useT()
  const [messages, setMessages] = useState<api.HistoryMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getConversation(id)
      if (!data.ok && data.error) {
        setError(data.error)
      }
      setMessages(data.messages)
    } catch (e: any) {
      setError(
        e?.message === "Network request failed"
          ? t.historyNoInternet
          : t.historyLoadError,
      )
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <ScreenWrapper>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      </ScreenWrapper>
    )
  }

  if (error && messages.length === 0) {
    return (
      <ScreenWrapper>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title={t.retry} variant="outline" onPress={load} style={{ marginTop: spacing.md }} />
        </View>
      </ScreenWrapper>
    )
  }

  return (
    <ScreenWrapper padBottom={false}>
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === "user" ? styles.userBubble : styles.aiBubble,
            ]}
          >
            {item.role !== "user" && <Text style={styles.aiLabel}>TurbotaAI</Text>}
            <Text style={item.role === "user" ? styles.userText : styles.aiText}>
              {item.content}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t.historyEmpty}</Text>
          </View>
        }
      />
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  bubble: {
    maxWidth: "82%",
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.userBubble },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.aiBubble,
    borderWidth: 1,
    borderColor: colors.aiBubbleBorder,
  },
  aiLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.success,
    marginBottom: 4,
  },
  userText: { color: "#fff", fontSize: fontSize.md, lineHeight: 22 },
  aiText: { color: colors.text, fontSize: fontSize.md, lineHeight: 22 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: colors.textMuted, fontSize: fontSize.md },
  errorWrap: { alignItems: "center", paddingTop: 60, paddingHorizontal: spacing.xxl },
  errorText: { fontSize: fontSize.md, color: colors.error, textAlign: "center" },
})
