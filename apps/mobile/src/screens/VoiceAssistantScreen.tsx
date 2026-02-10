import React, { useState, useRef, useCallback, useEffect } from "react"
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
  useColorScheme,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAuth } from "@/hooks/useAuth"
import { useT } from "@/hooks/useLanguage"
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder"
import * as api from "@/services/api"
import { generateUUID, getDeviceHash, getSessionId } from "@/services/storage"
import { colors, darkColors, fontSize, spacing, radii } from "@/constants/theme"

type Message = {
  id: string
  role: "user" | "assistant"
  text: string
  isError?: boolean
}

/**
 * Voice Assistant — voice-first native screen.
 *
 * Primary interaction: tap-to-speak mic button with live STT transcript.
 * Fallback: text input for typing.
 * No WebView, no embedded web page — purely native RN UI.
 */
export default function VoiceAssistantScreen() {
  const insets = useSafeAreaInsets()
  const { user, refreshAccess } = useAuth()
  const { t, locale } = useT()
  const scheme = useColorScheme()
  const isDark = scheme === "dark"
  const c = isDark ? darkColors : colors

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const flatListRef = useRef<FlatList>(null)
  const conversationIdRef = useRef<string | null>(null)
  const sessionIdRef = useRef<string>("")
  const sendingRef = useRef(false)
  const isNearBottomRef = useRef(true)

  // Load persistent sessionId on mount (no new ID on remount)
  useEffect(() => {
    getSessionId().then((id) => { sessionIdRef.current = id })
  }, [])

  const {
    voiceState,
    liveTranscript,
    finalTranscript,
    error: voiceError,
    startListening,
    stopListening,
    reset: resetVoice,
  } = useVoiceRecorder(locale)

  // Auto-send when we get a final transcript
  useEffect(() => {
    if (finalTranscript && !sendingRef.current) {
      doSend(finalTranscript)
      resetVoice()
    }
  }, [finalTranscript])

  const doSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sendingRef.current) return

      sendingRef.current = true
      setSending(true)

      const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text: trimmed }
      setMessages((prev) => [...prev, userMsg])
      setInput("")

      try {
        const deviceId = (await getDeviceHash()) || ""
        if (!sessionIdRef.current) sessionIdRef.current = await getSessionId()
        const payload = api.buildMessagePayload({
          query: trimmed,
          language: locale,
          mode: "voice",
          userId: user?.id,
          sessionId: sessionIdRef.current,
          deviceId,
          email: user?.email,
        })
        const data = await api.sendMessage(payload)
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

        // Save to history (fire-and-forget)
        if (!isError) {
          const isFirstMessage = !conversationIdRef.current
          const convId = conversationIdRef.current || generateUUID()
          conversationIdRef.current = convId
          api
            .saveConversation({
              conversationId: convId,
              messages: [
                { role: "user", content: trimmed },
                { role: "assistant", content: reply },
              ],
              mode: "voice",
              title: isFirstMessage ? trimmed.slice(0, 64) : undefined,
            })
            .catch(() => {})
        }
      } catch (e: any) {
        const errText =
          e?.message === "Network request failed" ? t.chatNoInternet : t.chatError
        setMessages((prev) => [
          ...prev,
          { id: `e-${Date.now()}`, role: "assistant", text: errText, isError: true },
        ])
      } finally {
        sendingRef.current = false
        setSending(false)
      }
    },
    [user, t, locale, refreshAccess],
  )

  const handleSendText = useCallback(() => {
    doSend(input)
  }, [input, doSend])

  const handleMicPress = useCallback(() => {
    if (voiceState === "listening") {
      stopListening()
    } else if (voiceState === "idle" || voiceState === "error") {
      startListening()
    }
  }, [voiceState, startListening, stopListening])

  const voiceErrorLabel = voiceError === "not-allowed"
    ? t.voiceMicDenied
    : voiceError === "too_short"
    ? t.voiceTooShort
    : voiceError
    ? t.voiceSttError
    : null

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <View
        style={[
          styles.bubble,
          item.role === "user"
            ? [styles.userBubble, { backgroundColor: c.userBubble }]
            : [styles.aiBubble, { backgroundColor: c.aiBubble, borderColor: c.aiBubbleBorder }],
          item.isError && [styles.errorBubble, { backgroundColor: c.errorLight, borderColor: c.error }],
        ]}
      >
        {item.role === "assistant" && !item.isError && (
          <Text style={[styles.aiLabel, { color: c.success }]}>TurbotaAI</Text>
        )}
        {item.isError && <Text style={[styles.errorLabel, { color: c.error }]}>Error</Text>}
        <Text style={item.role === "user" ? styles.userText : [styles.aiText, { color: c.text }]}>
          {item.text}
        </Text>
      </View>
    ),
    [c],
  )

  // Mic button color/icon based on state
  const micBg =
    voiceState === "listening" ? "#ef4444" : // red while recording
    voiceState === "requesting" || voiceState === "processing" ? c.textMuted :
    "#10b981" // green idle
  const micDisabled = voiceState === "requesting" || voiceState === "processing" || sending

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingBottom: insets.bottom }]}>
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
              <Text style={styles.emptyIcon}>{"\uD83C\uDF99\uFE0F"}</Text>
              <Text style={[styles.emptyTitle, { color: c.textSecondary }]}>{t.voiceStart}</Text>
              <Text style={[styles.emptySubtitle, { color: c.textMuted }]}>{t.voiceTapToSpeak}</Text>
            </View>
          }
        />

        {/* Live transcript preview */}
        {voiceState === "listening" && liveTranscript.length > 0 && (
          <View style={[styles.transcriptBar, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
            <Text style={[styles.transcriptText, { color: c.text }]} numberOfLines={2}>
              {liveTranscript}
            </Text>
          </View>
        )}

        {/* Voice status / error */}
        {voiceState === "listening" && liveTranscript.length === 0 && (
          <View style={styles.statusBar}>
            <Text style={[styles.statusText, { color: c.primary }]}>{t.voiceListening}</Text>
          </View>
        )}
        {voiceErrorLabel && voiceState !== "listening" && (
          <View style={styles.statusBar}>
            <Text style={[styles.statusText, { color: c.error }]}>{voiceErrorLabel}</Text>
          </View>
        )}

        {/* Input area: mic button + text fallback */}
        <View style={[styles.inputRow, { borderTopColor: c.border, backgroundColor: c.surface }]}>
          {/* Mic button */}
          <TouchableOpacity
            style={[styles.micBtn, { backgroundColor: micBg }, micDisabled && styles.micBtnDisabled]}
            onPress={handleMicPress}
            disabled={micDisabled}
            activeOpacity={0.7}
          >
            {voiceState === "requesting" || (voiceState === "processing" && !sending) ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.micIcon}>
                {voiceState === "listening" ? "\u23F9" : "\uD83C\uDF99"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Text fallback input */}
          <TextInput
            style={[styles.input, { backgroundColor: c.surfaceAlt, color: c.text }]}
            value={input}
            onChangeText={setInput}
            placeholder={t.voicePlaceholder}
            placeholderTextColor={c.textMuted}
            multiline
            maxLength={2000}
            editable={!sending && voiceState !== "listening"}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSendText}
          />

          {/* Send text button */}
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: c.primary }, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSendText}
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
  root: { flex: 1 },
  flex: { flex: 1 },
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  listEmpty: { flexGrow: 1 },
  bubble: {
    maxWidth: "82%",
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  userBubble: { alignSelf: "flex-end" },
  aiBubble: {
    alignSelf: "flex-start",
    borderWidth: 1,
  },
  errorBubble: {
    borderWidth: 1,
  },
  aiLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    marginBottom: 4,
  },
  errorLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    marginBottom: 4,
  },
  userText: { color: "#fff", fontSize: fontSize.md, lineHeight: 22 },
  aiText: { fontSize: fontSize.md, lineHeight: 22 },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "600" },
  emptySubtitle: {
    fontSize: fontSize.sm,
    textAlign: "center",
    marginTop: spacing.xs,
    maxWidth: 260,
  },

  // Live transcript
  transcriptBar: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  transcriptText: {
    fontSize: fontSize.md,
    fontStyle: "italic",
  },

  // Status
  statusBar: {
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },

  // Input row
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  micBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  micBtnDisabled: { opacity: 0.4 },
  micIcon: { fontSize: 22 },
  input: {
    flex: 1,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: fontSize.md,
    maxHeight: 100,
  },
  sendBtn: {
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
