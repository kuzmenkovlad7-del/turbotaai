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
import { useT } from "@/hooks/useLanguage"
import * as api from "@/services/api"
import { generateUUID, getDeviceHash } from "@/services/storage"
import { colors, fontSize, spacing, radii } from "@/constants/theme"

type Message = {
  id: string
  role: "user" | "assistant"
  text: string
  isError?: boolean
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets()
  const { user, refreshAccess } = useAuth()
  const { t, locale } = useT()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const flatListRef = useRef<FlatList>(null)
  const conversationIdRef = useRef<string | null>(null)
  const sessionIdRef = useRef<string>(generateUUID())
  const sendingRef = useRef(false)
  const isNearBottomRef = useRef(true)

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || sendingRef.current) return

    sendingRef.current = true
    setSending(true)

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text }
    setMessages((prev) => [...prev, userMsg])
    setInput("")

    try {
      const deviceId = await getDeviceHash() || ""
      const data = await api.sendMessage({
        query: text,
        language: locale,
        mode: "chat",
        userId: user?.id || null,
        sessionId: sessionIdRef.current,
        deviceId,
        clientMessageId: generateUUID(),
        timestamp: new Date().toISOString(),
        email: user?.email,
      })
      const reply = api.extractReplyText(data)
      const isError = data?.ok === false

      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: reply,
        isError,
      }
      setMessages((prev) => [...prev, aiMsg])

      // Refresh access state so trial counter stays in sync (fire-and-forget)
      refreshAccess().catch(() => {})

      // Save to history (fire-and-forget, don't block UI)
      if (!isError) {
        const isFirstMessage = !conversationIdRef.current
        const convId = conversationIdRef.current || generateUUID()
        conversationIdRef.current = convId
        api
          .saveConversation({
            conversationId: convId,
            messages: [
              { role: "user", content: text },
              { role: "assistant", content: reply },
            ],
            title: isFirstMessage ? text.slice(0, 64) : undefined,
          })
          .catch(() => {})
      }
    } catch (e: any) {
      const errText =
        e?.message === "Network request failed"
          ? t.chatNoInternet
          : t.chatError
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: "assistant", text: errText, isError: true },
      ])
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }, [input, user, t, locale])

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <View
        style={[
          styles.bubble,
          item.role === "user" ? styles.userBubble : styles.aiBubble,
          item.isError && styles.errorBubble,
        ]}
      >
        {item.role === "assistant" && !item.isError && (
          <Text style={styles.aiLabel}>TurbotaAI</Text>
        )}
        {item.isError && <Text style={styles.errorLabel}>Error</Text>}
        <Text style={item.role === "user" ? styles.userText : styles.aiText}>{item.text}</Text>
      </View>
    ),
    [],
  )

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
          contentContainerStyle={[styles.list, messages.length === 0 && styles.listEmpty]}
          onContentSizeChange={() => {
            if (isNearBottomRef.current) {
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          }}
          onScroll={({ nativeEvent }) => {
            const { contentOffset, layoutMeasurement, contentSize } = nativeEvent
            isNearBottomRef.current =
              contentOffset.y + layoutMeasurement.height >= contentSize.height - 80
          }}
          scrollEventThrottle={100}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>{"\uD83D\uDCAC"}</Text>
              <Text style={styles.emptyTitle}>{t.chatStart}</Text>
              <Text style={styles.emptySubtitle}>{t.chatSubtitle}</Text>
            </View>
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t.chatPlaceholder}
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
  errorBubble: {
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.error,
  },
  aiLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.success,
    marginBottom: 4,
  },
  errorLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.error,
    marginBottom: 4,
  },
  userText: { color: "#fff", fontSize: fontSize.md, lineHeight: 22 },
  aiText: { color: colors.text, fontSize: fontSize.md, lineHeight: 22 },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
  },
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
