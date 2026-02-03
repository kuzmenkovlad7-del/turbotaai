import React, { useEffect, useState } from "react"
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native"
import ScreenWrapper from "@/components/ScreenWrapper"
import * as api from "@/services/api"
import { colors, fontSize, spacing, radii } from "@/constants/theme"

type Msg = { id: string; role: string; content: string; created_at?: string }

type Props = {
  route: { params: { id: string; title?: string } }
}

export default function ConversationDetailScreen({ route }: Props) {
  const { id } = route.params
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await api.getConversation(id)
        setMessages(data?.messages || [])
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading) {
    return (
      <ScreenWrapper>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
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
            <Text style={styles.emptyText}>No messages in this conversation</Text>
          </View>
        }
      />
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  bubble: { maxWidth: "82%", borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.userBubble },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.aiBubble,
    borderWidth: 1,
    borderColor: colors.aiBubbleBorder,
  },
  aiLabel: { fontSize: fontSize.xs, fontWeight: "600", color: colors.success, marginBottom: 4 },
  userText: { color: "#fff", fontSize: fontSize.md, lineHeight: 22 },
  aiText: { color: colors.text, fontSize: fontSize.md, lineHeight: 22 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: colors.textMuted, fontSize: fontSize.md },
})
