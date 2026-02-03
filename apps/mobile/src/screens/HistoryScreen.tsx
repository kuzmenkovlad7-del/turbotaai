import React, { useEffect, useState, useCallback } from "react"
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native"
import ScreenWrapper from "@/components/ScreenWrapper"
import EmptyState from "@/components/EmptyState"
import Button from "@/components/Button"
import * as api from "@/services/api"
import { colors, fontSize, spacing, radii } from "@/constants/theme"

type Props = {
  navigation: any
}

export default function HistoryScreen({ navigation }: Props) {
  const [conversations, setConversations] = useState<api.ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const data = await api.getHistory()
      setConversations(data.conversations)
    } catch (e: any) {
      const msg =
        e?.message === "Network request failed"
          ? "No internet connection."
          : "Could not load history."
      setError(msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      const now = new Date()
      const diffMs = now.getTime() - d.getTime()
      const diffH = diffMs / (1000 * 60 * 60)
      if (diffH < 1) return "Just now"
      if (diffH < 24) return `${Math.floor(diffH)}h ago`
      if (diffH < 48) return "Yesterday"
      return d.toLocaleDateString()
    } catch {
      return ""
    }
  }

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
        </View>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      </ScreenWrapper>
    )
  }

  if (error && conversations.length === 0) {
    return (
      <ScreenWrapper>
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
        </View>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" variant="outline" onPress={() => load()} style={{ marginTop: spacing.md }} />
        </View>
      </ScreenWrapper>
    )
  }

  return (
    <ScreenWrapper padBottom={false}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
      </View>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, conversations.length === 0 && styles.listEmpty]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() =>
              navigation.navigate("ConversationDetail", {
                id: item.id,
                title: item.title,
              })
            }
          >
            <View style={styles.cardRow}>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title || "Untitled conversation"}
                </Text>
                <Text style={styles.cardDate}>
                  {formatDate(item.updated_at || item.created_at)}
                </Text>
              </View>
              <Text style={styles.chevron}>{"\u203A"}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={"\uD83D\uDCDD"}
            title="No conversations yet"
            subtitle="Start chatting and your history will appear here."
          />
        }
      />
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  listEmpty: { flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  cardDate: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 },
  chevron: { fontSize: 24, color: colors.textMuted, marginLeft: spacing.sm },
  errorWrap: { alignItems: "center", paddingTop: 40, paddingHorizontal: spacing.xxl },
  errorText: {
    fontSize: fontSize.md,
    color: colors.error,
    textAlign: "center",
  },
})
