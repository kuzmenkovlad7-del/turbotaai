import React, { useState, useRef, useCallback } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAuth } from "@/hooks/useAuth"
import * as api from "@/services/api"
import { colors, fontSize, spacing, radii } from "@/constants/theme"

type Message = {
  id: string
  role: "user" | "assistant"
  text: string
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setSending(true)

    try {
      const data = await api.sendMessage(text, "uk", user?.email)
      const reply = data?.text || data?.response || data?.[0]?.text || "..."
      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: String(reply).trim(),
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: "assistant", text: "Something went wrong. Please try again." },
      ])
    } finally {
      setSending(false)
    }
  }, [input, sending, user])

  const renderMessage = useCallback(({ item }: { item: Message }) => (
    <View
      style={[
        styles.bubble,
        item.role === "user" ? styles.userBubble : styles.aiBubble,
      ]}
    >
      {item.role === "assistant" && (
        <Text style={styles.aiLabel}>TurbotaAI</Text>
      )}
      <Text style={item.role === "user" ? styles.userText : styles.aiText}>
        {item.text}
      </Text>
    </View>
  ), [])

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(m) => m.id}
          contentContainerStyle={[
            styles.list,
            messages.length === 0 && styles.listEmpty,
          ]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>{"\uD83D\uDCAC"}</Text>
              <Text style={styles.emptyTitle}>Start a conversation</Text>
              <Text style={styles.emptySubtitle}>
                Ask anything — your AI companion is here to help.
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
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={2000}
            editable={!sending}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendIcon}>{"\u2191"}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  listEmpty: { flexGrow: 1 },
  bubble: { maxWidth: "82%", borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm },
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
  emptyWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xxl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.textSecondary },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xs,
    maxWidth: 260,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: fontSize.md,
    color: colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: "#fff", fontSize: 20, fontWeight: "700" },
})
