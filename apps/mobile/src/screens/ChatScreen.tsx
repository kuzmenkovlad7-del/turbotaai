import React, { useState, useRef } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native"
import * as api from "@/services/api"

type Message = {
  id: string
  role: "user" | "assistant"
  text: string
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const data = await api.sendMessage(text, "uk")
      const reply =
        data?.text || data?.response || data?.[0]?.text || "..."
      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: String(reply).trim(),
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: "assistant", text: "Error. Please try again." },
      ])
    } finally {
      setLoading(false)
    }
  }

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.bubble,
        item.role === "user" ? styles.userBubble : styles.aiBubble,
      ]}
    >
      <Text style={item.role === "user" ? styles.userText : styles.aiText}>
        {item.text}
      </Text>
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                Start a conversation with your AI companion
              </Text>
            </View>
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            multiline
            maxLength={2000}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  flex: { flex: 1 },
  list: { paddingHorizontal: 16, paddingVertical: 12 },
  bubble: { maxWidth: "80%", borderRadius: 16, padding: 12, marginBottom: 8 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#7c3aed" },
  aiBubble: { alignSelf: "flex-start", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  userText: { color: "#fff", fontSize: 15 },
  aiText: { color: "#1e293b", fontSize: 15 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  emptyText: { color: "#94a3b8", fontSize: 16, textAlign: "center" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: "#7c3aed",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginLeft: 8,
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendText: { color: "#fff", fontWeight: "600", fontSize: 15 },
})
