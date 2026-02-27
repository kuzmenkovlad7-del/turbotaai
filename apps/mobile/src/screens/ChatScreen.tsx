import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react"
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
import { useNavigation } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAuth } from "@/hooks/useAuth"
import { useT } from "@/hooks/useLanguage"
import * as api from "@/services/api"
import { generateUUID, getSessionId, setSessionId } from "@/services/storage"
import { buildMessagePayload } from "@/services/messagePayload"
import { getAccessState } from "@/utils/accessState"
import { colors, fontSize, spacing, radii } from "@/constants/theme"
import { logEvent } from "@/services/analytics"

type Message = {
  id: string
  role: "user" | "assistant"
  text: string
  isError?: boolean
}

/* ── Typewriter reveal for AI responses ── */

const STREAM_CHARS = 3
const STREAM_MS = 20

function StreamingText({ fullText, onComplete }: { fullText: string; onComplete: () => void }) {
  const [len, setLen] = useState(0)
  const doneRef = useRef(false)

  useEffect(() => {
    if (doneRef.current) return
    if (len >= fullText.length) {
      doneRef.current = true
      onComplete()
      return
    }
    const t = setTimeout(() => setLen((l) => Math.min(l + STREAM_CHARS, fullText.length)), STREAM_MS)
    return () => clearTimeout(t)
  }, [len, fullText.length, onComplete])

  return (
    <Text style={styles.aiText}>
      {fullText.slice(0, len)}
      {len < fullText.length ? "\u2588" : ""}
    </Text>
  )
}

/* ── Typing indicator (pulsing dots) ── */

function TypingIndicator() {
  const [dots, setDots] = useState("")

  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 400)
    return () => clearInterval(t)
  }, [])

  return (
    <View style={[styles.bubble, styles.aiBubble]}>
      <Text style={styles.aiLabel}>TurbotaAI</Text>
      <Text style={styles.typingDots}>{dots || "."}</Text>
    </View>
  )
}

/* ── Main screen ── */

export default function ChatScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { user, accessInfo, decrementTrialLeft, refreshAccess } = useAuth()
  const { t, locale } = useT()
  const accessState = getAccessState(accessInfo)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null)
  const flatListRef = useRef<FlatList>(null)
  const conversationIdRef = useRef<string | null>(null)
  const sessionIdRef = useRef<string>("")
  const sendingRef = useRef(false)
  const isNearBottomRef = useRef(true)

  // Load or create persistent sessionId
  useEffect(() => {
    ;(async () => {
      const stored = await getSessionId("chat")
      if (stored) {
        sessionIdRef.current = stored
      } else {
        const newId = generateUUID()
        sessionIdRef.current = newId
        await setSessionId("chat", newId)
      }
    })()
  }, [])

  // New Chat — reset session, messages, conversation
  const resetSession = useCallback(async () => {
    const newId = generateUUID()
    sessionIdRef.current = newId
    await setSessionId("chat", newId)
    conversationIdRef.current = null
    setMessages([])
    setInput("")
    setStreamingMsgId(null)
  }, [])

  // Add New Chat button to header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={resetSession} style={styles.newChatBtn} activeOpacity={0.7}>
          <Text style={styles.newChatText}>{t.newChat}</Text>
        </TouchableOpacity>
      ),
    })
  }, [navigation, resetSession, t])

  const handleStreamComplete = useCallback(() => {
    setStreamingMsgId(null)
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || sendingRef.current) return
    // Session ID may not have loaded from storage yet on very first tap — generate inline
    if (!sessionIdRef.current) {
      const newId = generateUUID()
      sessionIdRef.current = newId
      setSessionId("chat", newId).catch(() => {})
    }

    sendingRef.current = true
    setSending(true)

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text }
    setMessages((prev) => [...prev, userMsg])
    setInput("")

    try {
      const payload = await buildMessagePayload({
        query: text,
        language: locale,
        mode: "chat",
        userId: user?.id || null,
        sessionId: sessionIdRef.current,
        email: user?.email,
      })
      const data = await api.sendMessage(payload)

      // Payment required — trial exhausted server-side
      if (data.paymentRequired) {
        // Sync access state so all screens immediately show the paywall
        refreshAccess().catch(() => {})
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            text: t.chatPaymentRequired,
            isError: true,
          },
        ])
        return
      }

      const reply = api.extractReplyText(data)
      const isError = data?.ok === false

      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: reply,
        isError,
      }
      setMessages((prev) => [...prev, aiMsg])

      // Trigger typewriter animation for non-error responses
      if (!isError) {
        setStreamingMsgId(aiMsg.id)
        // Optimistically decrement trial count — keeps badge/account screen in sync
        // without waiting for the next bootstrap refresh
        decrementTrialLeft()
      }

      // Track analytics
      if (!isError) {
        const isFirstMessage = !conversationIdRef.current
        if (isFirstMessage) logEvent("chat_started", { mode: "chat" })
        logEvent("message_sent", { mode: "chat" })
      }

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
  }, [input, user, t, locale, decrementTrialLeft, refreshAccess])

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isStreaming = item.id === streamingMsgId && !item.isError

      return (
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
          {isStreaming ? (
            <StreamingText fullText={item.text} onComplete={handleStreamComplete} />
          ) : (
            <Text style={item.role === "user" ? styles.userText : styles.aiText}>{item.text}</Text>
          )}
        </View>
      )
    },
    [streamingMsgId, handleStreamComplete],
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
          extraData={streamingMsgId}
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
              <Text style={styles.emptySubtitle}>
                {accessState.isTrial
                  ? t.accessTrialRemaining(accessState.trialLeft)
                  : t.chatSubtitle}
              </Text>
            </View>
          }
          ListFooterComponent={sending ? <TypingIndicator /> : null}
        />

        {/* Paywall bar — replaces input when user has no access */}
        {accessState.isLocked ? (
          <View style={styles.paywallBar}>
            <View style={styles.paywallText}>
              <Text style={styles.paywallTitle}>{t.accessLockedTitle}</Text>
              <Text style={styles.paywallDesc}>{t.accessLockedDesc}</Text>
            </View>
            <TouchableOpacity
              style={styles.paywallBtn}
              onPress={() => (navigation as any).navigate("MainTabs", { screen: "AccountTab" })}
              activeOpacity={0.8}
            >
              <Text style={styles.paywallBtnText}>{t.accessGoToAccount}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputRow}>
            {/* Trial counter chip above input when on trial */}
            {accessState.isTrial && (
              <Text style={styles.trialChip}>
                {t.accessTrialRemaining(accessState.trialLeft)}
              </Text>
            )}
            <View style={styles.inputRowInner}>
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
          </View>
        )}
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
  typingDots: {
    color: colors.textMuted,
    fontSize: fontSize.lg,
    fontWeight: "600",
    letterSpacing: 2,
  },
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
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  trialChip: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: "600",
    paddingTop: spacing.xs,
    paddingBottom: 2,
    textAlign: "center",
  },
  inputRowInner: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingTop: spacing.sm,
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
  newChatBtn: { marginRight: 12 },
  newChatText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: "600" },

  // Paywall bar — shown when access is "none"
  paywallBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.errorLight,
    padding: spacing.lg,
    gap: spacing.md,
  },
  paywallText: { gap: spacing.xs },
  paywallTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.error },
  paywallDesc: { fontSize: fontSize.sm, color: colors.error, lineHeight: 18 },
  paywallBtn: {
    backgroundColor: colors.error,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
  },
  paywallBtnText: { color: "#fff", fontWeight: "700", fontSize: fontSize.sm },
})
