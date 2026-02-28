/**
 * NativeVoiceCallScreen — fully native in-app voice call.
 *
 * Receives { gender, locale } from VoiceAssistantScreen via route params.
 * Requests microphone permission (iOS: expo-av; Android: already gated in the
 * previous screen), then runs the STT → Agent → TTS loop via useVoiceSession.
 *
 * Primary flow: silence detection auto-submits after 1.5 s of quiet.
 * No "Send Now" button — matches web voice experience.
 *
 * Error debug box: any API error (STT / Agent / TTS) is shown in full in a
 * red card at the bottom of the screen so failures are immediately visible
 * during QA without having to inspect logs.
 */

import React, { useEffect, useRef, useCallback, useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Audio } from "expo-av"
import { useT } from "@/hooks/useLanguage"
import { useVoiceSession, type VoicePhase, type VoiceGender } from "@/hooks/useVoiceSession"
import { logEvent } from "@/services/analytics"
import { colors, fontSize, spacing, radii } from "@/constants/theme"
import type { Locale } from "@/constants/i18n"

export type NativeVoiceCallParams = {
  gender: VoiceGender
  locale: Locale
}

// ── Orb colour per phase ──────────────────────────────────────────────────────
const ORB_COLOR: Record<VoicePhase, string> = {
  idle:       colors.border,
  listening:  colors.primary,
  processing: "#f59e0b",
  speaking:   "#16a34a",
  error:      colors.error,
}

const ORB_ICON: Record<VoicePhase, string> = {
  idle:       "🎙️",
  listening:  "🎙️",
  processing: "⏳",
  speaking:   "🔊",
  error:      "⚠️",
}

export default function NativeVoiceCallScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const insets = useSafeAreaInsets()
  const { t } = useT()

  const { gender, locale } = route.params as NativeVoiceCallParams

  const [permGranted, setPermGranted] = useState<boolean | null>(null)

  // decrementTrialLeft is now called inside useVoiceSession after each AI reply
  const { phase, transcript, reply, error, unheard, start, stop, retryFromError } =
    useVoiceSession(gender, locale)

  // ── Pulse animation during listening ───────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    if (phase === "listening") {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.18,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      )
      pulseRef.current.start()
    } else {
      pulseRef.current?.stop()
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start()
    }
  }, [phase, pulseAnim])

  // ── Permission request + session start ────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function requestAndStart() {
      // expo-av handles both iOS and Android
      const { granted } = await Audio.requestPermissionsAsync()
      if (cancelled) return
      if (!granted) {
        setPermGranted(false)
        return
      }
      // Double-check Android RECORD_AUDIO (belt-and-suspenders with expo-av)
      if (Platform.OS === "android") {
        try {
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          )
          if (cancelled) return
          if (result !== PermissionsAndroid.RESULTS.GRANTED) {
            setPermGranted(false)
            return
          }
        } catch {
          // expo-av grant already succeeded — proceed
        }
      }
      setPermGranted(true)
      logEvent("native_voice_call_started", { gender, locale })
      start()
    }

    requestAndStart()
    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── End call ──────────────────────────────────────────────────────────────
  const handleEnd = useCallback(async () => {
    logEvent("native_voice_call_ended", { turns: !!reply ? 1 : 0 })
    await stop()
    navigation.goBack()
  }, [stop, navigation, reply])

  // ── Payment required error ─────────────────────────────────────────────────
  const isPaymentError = error === "payment_required"

  // ── Phase label ────────────────────────────────────────────────────────────
  function phaseLabel(): string {
    switch (phase) {
      case "listening":  return t.voiceListening
      case "processing": return t.voiceProcessing
      case "speaking":   return t.voiceSpeaking
      case "error":      return isPaymentError ? t.chatPaymentRequired : t.voiceSessionError
      default:           return t.voiceTitle
    }
  }

  // ── Permission denied ─────────────────────────────────────────────────────
  if (permGranted === false) {
    return (
      <View style={[styles.root, styles.centered, { paddingBottom: insets.bottom }]}>
        <Text style={styles.errorIcon}>🎙️</Text>
        <Text style={styles.errorText}>{t.permMicDenied}</Text>
        <TouchableOpacity style={styles.endBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.endBtnText}>{t.close}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── Waiting for permission ────────────────────────────────────────────────
  if (permGranted === null) {
    return (
      <View style={[styles.root, styles.centered, { paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  const orbColor = ORB_COLOR[phase]
  const orbIcon = ORB_ICON[phase]

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>

      {/* ── Orb ─────────────────────────────────────────────────────────── */}
      <View style={styles.orbWrap}>
        <Animated.View
          style={[
            styles.orb,
            { backgroundColor: orbColor, transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Text style={styles.orbIcon}>{orbIcon}</Text>
        </Animated.View>

        <Text style={styles.phaseText} numberOfLines={2}>
          {phaseLabel()}
        </Text>
      </View>

      {/* ── Conversation transcript ──────────────────────────────────────── */}
      <ScrollView
        style={styles.conversation}
        contentContainerStyle={styles.conversationContent}
        showsVerticalScrollIndicator={false}
      >
        {transcript ? (
          <View style={styles.userBubble}>
            <Text style={styles.bubbleLabel}>{t.voiceYou}</Text>
            <Text style={styles.userBubbleText}>{transcript}</Text>
          </View>
        ) : null}

        {reply ? (
          <View style={styles.aiBubble}>
            <Text style={styles.bubbleLabel}>{t.voiceAI}</Text>
            <Text style={styles.aiBubbleText}>{reply}</Text>
          </View>
        ) : null}

        {phase === "listening" && !transcript && !reply && (
          <Text style={unheard ? styles.hintRepeat : styles.hint}>
            {unheard ? t.voiceRepeat : t.voiceHint}
          </Text>
        )}

        {unheard && phase === "listening" && !!(transcript || reply) && (
          <Text style={styles.hintRepeat}>{t.voiceRepeat}</Text>
        )}

        {/* ── Debug error box — shows full error string with status code ── */}
        {phase === "error" && error && !isPaymentError && (
          <View style={styles.debugBox}>
            <Text style={styles.debugTitle}>⚠ API error</Text>
            <Text style={styles.debugMsg} selectable>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <View style={styles.controls}>
        {phase === "error" && (
          isPaymentError ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                stop()
                ;(navigation as any).navigate("MainTabs", { screen: "AccountTab" })
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>{t.accessGoToAccount}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={retryFromError}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>{t.retry}</Text>
            </TouchableOpacity>
          )
        )}

        <TouchableOpacity
          style={styles.endBtn}
          onPress={handleEnd}
          activeOpacity={0.8}
        >
          <Text style={styles.endBtnText}>{t.voiceEndCall}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const ORB_SIZE = 140

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    gap: spacing.lg,
  },

  // Orb + phase label
  orbWrap: {
    alignItems: "center",
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  orbIcon: {
    fontSize: 48,
  },
  phaseText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    paddingHorizontal: spacing.xxxl,
    lineHeight: 26,
  },

  // Conversation area
  conversation: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  conversationContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xl,
    lineHeight: 20,
  },
  hintRepeat: {
    fontSize: fontSize.sm,
    color: "#f59e0b",
    textAlign: "center",
    marginTop: spacing.xl,
    lineHeight: 20,
    fontWeight: "600",
  },

  // Bubbles
  bubbleLabel: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  userBubble: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + "33",
  },
  userBubbleText: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
  },
  aiBubble: {
    backgroundColor: colors.aiBubble,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.aiBubbleBorder,
  },
  aiBubbleText: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
  },

  // Debug error box
  debugBox: {
    backgroundColor: "#fee2e2",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#fca5a5",
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  debugTitle: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: "#b91c1c",
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  debugMsg: {
    fontSize: fontSize.sm,
    color: "#7f1d1d",
    fontFamily: "monospace",
    lineHeight: 18,
  },

  // Controls
  controls: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  actionBtn: {
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    alignItems: "center",
  },
  actionBtnText: {
    color: "#fff",
    fontSize: fontSize.md,
    fontWeight: "700",
  },
  endBtn: {
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    alignItems: "center",
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.error,
  },
  endBtnText: {
    color: colors.error,
    fontSize: fontSize.md,
    fontWeight: "700",
  },

  // Permission denied
  errorIcon: {
    fontSize: 48,
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.error,
    textAlign: "center",
    lineHeight: 22,
  },
})
