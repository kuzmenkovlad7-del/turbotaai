import React, { useEffect, useState } from "react"
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from "react-native"
import * as api from "@/services/api"

type Conversation = {
  id: string
  title: string | null
  created_at: string
  message_count?: number
}

type Props = {
  onSelectConversation: (id: string) => void
}

export default function HistoryScreen({ onSelectConversation }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await api.getHistory()
        setConversations(data?.conversations || [])
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 40 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => onSelectConversation(item.id)}
          >
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title || "Untitled conversation"}
            </Text>
            <Text style={styles.cardDate}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No conversations yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  list: { padding: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#1e293b" },
  cardDate: { fontSize: 13, color: "#94a3b8", marginTop: 4 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#94a3b8", fontSize: 16 },
})
