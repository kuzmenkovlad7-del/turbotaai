import React from "react"
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native"

type Props = {
  onStartChat: () => void
  onOpenHistory: () => void
  onOpenAccount: () => void
}

export default function HomeScreen({ onStartChat, onOpenHistory, onOpenAccount }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>TurbotaAI</Text>
        <Text style={styles.subtitle}>Your AI companion</Text>
      </View>

      <View style={styles.cards}>
        <TouchableOpacity style={styles.card} onPress={onStartChat}>
          <Text style={styles.cardEmoji}>💬</Text>
          <Text style={styles.cardTitle}>Start Chat</Text>
          <Text style={styles.cardDesc}>Talk with your AI assistant</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={onOpenHistory}>
          <Text style={styles.cardEmoji}>📋</Text>
          <Text style={styles.cardTitle}>History</Text>
          <Text style={styles.cardDesc}>View past conversations</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={onOpenAccount}>
          <Text style={styles.cardEmoji}>👤</Text>
          <Text style={styles.cardTitle}>Account</Text>
          <Text style={styles.cardDesc}>Manage subscription</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: "700", color: "#7c3aed" },
  subtitle: { fontSize: 16, color: "#64748b", marginTop: 4 },
  cards: { paddingHorizontal: 24, gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardEmoji: { fontSize: 28, marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: "600", color: "#1e293b" },
  cardDesc: { fontSize: 14, color: "#64748b", marginTop: 4 },
})
