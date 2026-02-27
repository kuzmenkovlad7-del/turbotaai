/**
 * NativeVideoCallScreen — fully native in-app video call.
 *
 * Architecture:
 *   - expo-av Video component renders the pre-recorded avatar loop (idle MP4).
 *   - When the AI is speaking (phase === "speaking") the video source switches
 *     to the speaking animation MP4.
 *   - Microphone recording → STT → agent (mode:"video") → TTS runs in
 *     useVideoSession (same pipeline as voice, different agent payload).
 *   - Camera permission is requested for future use / parity with web; the
 *     user's camera feed is not streamed (consistent with the web experience).
 *
 * Avatar video URLs:
 *   dr-maria    → /avatars/avatar1_{idle|speaking}.mp4?v2
 *   dr-sophia   → /avatars/avatar2_{idle|speaking}.mp4?v2
 *   dr-alexander → /avatars/avatar3_{idle|speaking}.mp4?v2
 */

import React, { useEffect, useRef, useCallback, useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  StatusBar,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Audio, Video, ResizeMode } from "expo-av"
import { useT } from "@/hooks/useLanguage"
import { useVideoSession, type VideoPhase } from "@/hooks/useVideoSession"
import { logEvent } from "@/services/analytics"
import { API_BASE_URL } from "@/constants/config"
import { colors, fontSize, spacing, radii } from "@/constants/theme"
import type { Locale } from "@/constants/i18n"

// ── Character metadata ────────────────────────────────────────────────────────

type CharacterInfo = {
  avatarNum: 1 | 2 | 3
  nameKey: "assistantCharacterMia" | "assistantCharacterAlex" | "assistantCharacterLeo"
  accent: string
}

const CHARACTER_META: Record<string, CharacterInfo> = {
  "dr-maria":     { avatarNum: 1, nameKey: "assistantCharacterMia",  accent: "#db2777" },
  "dr-sophia":    { avatarNum: 2, nameKey: "assistantCharacterAlex", accent: "#0ea5e9" },
  "dr-alexander": { avatarNum: 3, nameKey: "assistantCharacterLeo",  accent: "#7c3aed" },
}

function avatarUri(avatarNum: 1 | 2 | 3, variant: "idle" | "speaking"): string {
  return `${API_BASE_URL}/avatars/avatar${avatarNum}_${variant}.mp4?v2`
}

// ── Route params ──────────────────────────────────────────────────────────────

export type NativeVideoCallParams = {
  characterId: string           // "dr-maria" | "dr-sophia" | "dr-alexander"
  avatarSlug: string            // "mia" | "alex" | "leo"
  gender: "female" | "male"
  locale: Locale
}

// ── Phase → status label key ──────────────────────────────────────────────────

const STATUS_COLOR: Record<VideoPhase, string> = {
  idle:       "rgba(0,0,0,0.5)",
  listening:  colors.primary,
  processing: "#f59e0b",
  speaking:   "#16a34a",
  error:      colors.error,
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NativeVideoCallScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const insets = useSafeAreaInsets()
  const { t } = useT()

  const { characterId, avatarSlug, gender, locale } = route.params as NativeVideoCallParams

  const meta = CHARACTER_META[characterId] ?? CHARACTER_META["dr-maria"]

  // Video refs — idle + speaking videos pre-loaded
  const idleVideoRef = useRef<Video | null>(null)
  const speakingVideoRef = useRef<Video | null>(null)

  const [permGranted, setPermGranted] = useState<boolean | null>(null)
  const [videoReady, setVideoReady] = useState(false)

  // decrementTrialLeft is now called inside useVideoSession after each AI reply
  const { phase, transcript, reply, error, start, stop, retryFromError } =
    useVideoSession(characterId, avatarSlug, gender, locale)

  // ── Permission request + session start ────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function requestAndStart() {
      // expo-av handles both iOS and Android microphone
      const { granted: micGranted } = await Audio.requestPermissionsAsync()
      if (cancelled) return
      if (!micGranted) { setPermGranted(false); return }

      // Android: also request camera (belt-and-suspenders)
      if (Platform.OS === "android") {
        try {
          const results = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            PermissionsAndroid.PERMISSIONS.CAMERA,
          ])
          if (cancelled) return
          if (
            results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !==
            PermissionsAndroid.RESULTS.GRANTED
          ) {
            setPermGranted(false)
            return
          }
        } catch {
          // expo-av grant already succeeded — proceed
        }
      }

      setPermGranted(true)
      logEvent("native_video_call_started", { characterId, locale })
      start()
    }

    requestAndStart()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── End call ──────────────────────────────────────────────────────────────
  const handleEnd = useCallback(async () => {
    logEvent("native_video_call_ended", { characterId })
    await stop()
    navigation.goBack()
  }, [stop, navigation, characterId])

  // ── Phase label ────────────────────────────────────────────────────────────
  const isPaymentError = error === "payment_required"

  function phaseLabel(): string {
    switch (phase) {
      case "listening":  return t.voiceListening
      case "processing": return t.voiceProcessing
      case "speaking":   return t.voiceSpeaking
      case "error":      return isPaymentError ? t.chatPaymentRequired : t.voiceSessionError
      default:           return t[meta.nameKey]
    }
  }

  // ── Permission denied ─────────────────────────────────────────────────────
  if (permGranted === false) {
    return (
      <View style={[styles.root, styles.centered, { paddingBottom: insets.bottom }]}>
        <Text style={styles.permDeniedIcon}>🎙️</Text>
        <Text style={styles.permDeniedText}>{t.permMicDenied}</Text>
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

  const isSpeaking = phase === "speaking"
  const statusColor = STATUS_COLOR[phase]
  const accentColor = meta.accent

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Avatar video: idle + speaking stacked, only one plays ──────────── */}
      <View style={styles.videoContainer}>
        {/* Idle video — visible when NOT speaking */}
        <Video
          ref={idleVideoRef}
          source={{ uri: avatarUri(meta.avatarNum, "idle") }}
          style={StyleSheet.absoluteFillObject}
          resizeMode={ResizeMode.CONTAIN}
          isLooping
          shouldPlay={!isSpeaking && permGranted}
          isMuted
          onLoad={() => setVideoReady(true)}
        />

        {/* Speaking video — visible when speaking */}
        <Video
          ref={speakingVideoRef}
          source={{ uri: avatarUri(meta.avatarNum, "speaking") }}
          style={StyleSheet.absoluteFillObject}
          resizeMode={ResizeMode.CONTAIN}
          isLooping
          shouldPlay={isSpeaking}
          isMuted
        />

        {/* Loading indicator while first video loads */}
        {!videoReady && (
          <View style={styles.videoLoadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.videoLoadingText}>{t.loading}</Text>
          </View>
        )}

        {/* Gradient overlay at bottom for readability */}
        <View style={styles.gradient} pointerEvents="none" />
      </View>

      {/* ── Bottom overlay: status + conversation + controls ──────────────── */}
      <View
        style={[styles.overlay, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
        pointerEvents="box-none"
      >
        {/* Character name + phase status */}
        <View style={styles.statusRow} pointerEvents="none">
          <View style={[styles.namePill, { backgroundColor: accentColor }]}>
            <Text style={styles.namePillText}>{t[meta.nameKey]}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColor }]}>
            <Text style={styles.statusPillText} numberOfLines={1}>
              {phaseLabel()}
            </Text>
          </View>
        </View>

        {/* Conversation bubbles */}
        {(transcript || reply) ? (
          <ScrollView
            style={styles.convoScroll}
            contentContainerStyle={styles.convoContent}
            showsVerticalScrollIndicator={false}
            pointerEvents="none"
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
          </ScrollView>
        ) : (
          phase === "listening" && (
            <Text style={styles.hint} pointerEvents="none">
              {t.videoSpeakHint}
            </Text>
          )
        )}

        {/* ── Debug error box — shows full error string with status code ── */}
        {phase === "error" && error && !isPaymentError && (
          <View style={styles.debugBox}>
            <Text style={styles.debugTitle}>⚠ API error</Text>
            <Text style={styles.debugMsg} selectable>{error}</Text>
          </View>
        )}

        {/* Control buttons */}
        <View style={styles.controls}>
          {phase === "error" ? (
            isPaymentError ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: accentColor }]}
                onPress={() => {
                  stop()
                  ;(navigation as any).navigate("MainTabs", { screen: "AccountTab" })
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.actionBtnText}>{t.accessGoToAccount}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: accentColor }]}
                onPress={retryFromError}
                activeOpacity={0.85}
              >
                <Text style={styles.actionBtnText}>{t.retry}</Text>
              </TouchableOpacity>
            )
          ) : null}

          <TouchableOpacity
            style={styles.endBtn}
            onPress={handleEnd}
            activeOpacity={0.85}
          >
            <Text style={styles.endBtnText}>{t.voiceEndCall}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const OVERLAY_HEIGHT = 280

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    gap: spacing.lg,
  },

  // Video layer
  videoContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  videoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    gap: spacing.md,
  },
  videoLoadingText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: fontSize.sm,
  },
  // Semi-transparent dark gradient at the bottom so text is legible over the avatar
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: OVERLAY_HEIGHT + 40,
    // Simulated gradient via background (no expo-linear-gradient dependency)
    backgroundColor: "transparent",
    // On Android a simple semi-transparent bar works well enough:
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },

  // Bottom overlay — positioned absolutely over the video
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    // Dark frosted-glass effect
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  // Status row
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    flexWrap: "wrap",
  },
  namePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  namePillText: {
    color: "#fff",
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    maxWidth: 220,
  },
  statusPillText: {
    color: "#fff",
    fontSize: fontSize.xs,
    fontWeight: "600",
  },

  // Conversation area
  convoScroll: {
    maxHeight: 120,
    marginBottom: spacing.sm,
  },
  convoContent: {
    gap: spacing.xs,
  },
  hint: {
    color: "rgba(255,255,255,0.6)",
    fontSize: fontSize.sm,
    textAlign: "center",
    marginBottom: spacing.sm,
    lineHeight: 20,
  },

  // Bubbles
  bubbleLabel: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  userBubble: {
    backgroundColor: "rgba(124,58,237,0.6)",
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  userBubbleText: {
    color: "#fff",
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  aiBubble: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  aiBubbleText: {
    color: "rgba(255,255,255,0.95)",
    fontSize: fontSize.sm,
    lineHeight: 20,
  },

  // Buttons
  controls: {
    gap: spacing.sm,
    marginTop: spacing.xs,
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
    backgroundColor: "rgba(220,38,38,0.75)",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.5)",
  },
  endBtnText: {
    color: "#fff",
    fontSize: fontSize.md,
    fontWeight: "700",
  },

  // Debug error box
  debugBox: {
    backgroundColor: "rgba(220,38,38,0.85)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,100,100,0.5)",
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  debugTitle: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  debugMsg: {
    fontSize: fontSize.sm,
    color: "rgba(255,255,255,0.9)",
    fontFamily: "monospace",
    lineHeight: 18,
  },

  // Permission denied
  permDeniedIcon: { fontSize: 48 },
  permDeniedText: {
    fontSize: fontSize.md,
    color: colors.error,
    textAlign: "center",
    lineHeight: 22,
  },
})
