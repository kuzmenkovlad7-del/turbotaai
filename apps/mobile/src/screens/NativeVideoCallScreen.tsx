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
  useColorScheme,
} from "react-native"
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Audio, Video, ResizeMode } from "expo-av"
import { useT } from "@/hooks/useLanguage"
import { useVideoSession, type VideoPhase } from "@/hooks/useVideoSession"
import { logEvent } from "@/services/analytics"
import { API_BASE_URL, DEBUG_ENABLED } from "@/constants/config"
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

// ── Phase → accent colors (idle resolved from theme at runtime) ───────────────

const PHASE_PILL_COLOR: Record<VideoPhase, string> = {
  idle:       "",               // overridden by theme at runtime
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
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== "light"

  const { characterId, avatarSlug, gender, locale } = route.params as NativeVideoCallParams

  const meta = CHARACTER_META[characterId] ?? CHARACTER_META["dr-maria"]

  // Video refs — idle + speaking videos pre-loaded
  const idleVideoRef = useRef<Video | null>(null)
  const speakingVideoRef = useRef<Video | null>(null)

  const [permGranted, setPermGranted] = useState<boolean | null>(null)
  const [videoReady, setVideoReady] = useState(false)

  // decrementTrialLeft is now called inside useVideoSession after each AI reply
  const { phase, turns, error, diagLog, start, stop, retryFromError } =
    useVideoSession(characterId, avatarSlug, gender, locale)

  // ── Theme tokens ─────────────────────────────────────────────────────────────
  // Light: clean neutral surface matching the web's slate-100/200 stage.
  // Dark:  deep graphite, no harsh black void.
  const th = {
    rootBg:        isDark ? "#0f172a"                 : "#f1f5f9",
    stageBg:       isDark ? "#1e293b"                 : "#e8ecf1",
    stageBorder:   isDark ? "rgba(255,255,255,0.08)"  : "rgba(0,0,0,0.07)",
    panelBg:       isDark ? "#0d1829"                 : "#ffffff",
    panelBorder:   isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.06)",
    idlePillBg:    isDark ? "rgba(255,255,255,0.18)"  : "rgba(0,0,0,0.08)",
    idlePillText:  isDark ? "#fff"                    : "rgba(0,0,0,0.60)",
    hintColor:     isDark ? "rgba(255,255,255,0.55)"  : "rgba(0,0,0,0.45)",
    labelColor:    isDark ? "rgba(255,255,255,0.50)"  : "rgba(0,0,0,0.40)",
    aiBubbleBg:    isDark ? "rgba(255,255,255,0.10)"  : "rgba(0,0,0,0.05)",
    aiBubbleText:  isDark ? "rgba(255,255,255,0.92)"  : "#1e293b",
  }

  // Stop session when the screen loses focus (e.g. Android hardware back while
  // session is active). The hook's unmount cleanup also fires, but this runs
  // earlier — during the blur animation — ensuring audio is released promptly.
  useFocusEffect(
    useCallback(() => {
      return () => {
        stop().catch(() => {})
      }
    }, [stop]),
  )

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
      <View style={[styles.root, styles.centered, { paddingBottom: insets.bottom, backgroundColor: th.rootBg }]}>
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
      <View style={[styles.root, styles.centered, { paddingBottom: insets.bottom, backgroundColor: th.rootBg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  const isSpeaking = phase === "speaking"
  const accentColor = meta.accent
  // Idle pill uses theme-aware background + text; all other phases use colored bg + white text
  const statusPillBg    = phase === "idle" ? th.idlePillBg    : PHASE_PILL_COLOR[phase]
  const statusPillText  = phase === "idle" ? th.idlePillText  : "#fff"

  return (
    <View style={[styles.root, { backgroundColor: th.rootBg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* ── Stage section — padded wrapper containing the rounded avatar card ── */}
      {/* flex:3 gives ~60 % of the body height to the video, mirroring the web  */}
      {/* grid-rows-[minmax(200px,1.5fr)_minmax(0,1fr)] split used on mobile web  */}
      <View style={[styles.stageSection, { paddingTop: insets.top + spacing.sm }]}>
        <View style={[styles.stageCard, { backgroundColor: th.stageBg, borderColor: th.stageBorder }]}>

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

          {/* Speaking video — on top; transparent when not speaking */}
          <Video
            ref={speakingVideoRef}
            source={{ uri: avatarUri(meta.avatarNum, "speaking") }}
            style={[StyleSheet.absoluteFillObject, { opacity: isSpeaking ? 1 : 0 }]}
            resizeMode={ResizeMode.CONTAIN}
            isLooping
            shouldPlay={isSpeaking}
            isMuted
          />

          {/* Loading indicator while first video loads */}
          {!videoReady && (
            <View style={[styles.videoLoadingOverlay, { backgroundColor: th.stageBg }]}>
              <ActivityIndicator size="large" color={isDark ? "#fff" : colors.primary} />
              <Text style={styles.videoLoadingText}>{t.loading}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Bottom panel — chat + controls, fills remaining ~40 % ────────────── */}
      <View style={[
        styles.bottomPanel,
        {
          paddingBottom: Math.max(insets.bottom, spacing.md),
          backgroundColor: th.panelBg,
          borderTopColor: th.panelBorder,
        },
      ]}>

        {/* Character name + phase status row */}
        <View style={styles.statusRow}>
          <View style={[styles.namePill, { backgroundColor: accentColor }]}>
            <Text style={styles.namePillText}>{t[meta.nameKey]}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusPillBg }]}>
            <Text style={[styles.statusPillText, { color: statusPillText }]} numberOfLines={1}>
              {phaseLabel()}
            </Text>
          </View>
        </View>

        {/* Conversation bubbles — scrollable, fills available flex space */}
        {turns.length > 0 ? (
          <ScrollView
            style={styles.convoScroll}
            contentContainerStyle={styles.convoContent}
            showsVerticalScrollIndicator={false}
          >
            {turns.map((turn, i) =>
              turn.role === "user" ? (
                <View key={i} style={styles.userBubble}>
                  <Text style={[styles.bubbleLabel, { color: th.labelColor }]}>{t.voiceYou}</Text>
                  <Text style={styles.userBubbleText}>{turn.text}</Text>
                </View>
              ) : (
                <View key={i} style={[styles.aiBubble, { backgroundColor: th.aiBubbleBg }]}>
                  <Text style={[styles.bubbleLabel, { color: th.labelColor }]}>{t.voiceAI}</Text>
                  <Text style={[styles.aiBubbleText, { color: th.aiBubbleText }]}>{turn.text}</Text>
                </View>
              )
            )}
          </ScrollView>
        ) : (
          phase === "listening" && (
            <Text style={[styles.hint, { color: th.hintColor }]}>{t.videoSpeakHint}</Text>
          )
        )}

        {/* Error box — always visible when phase=error */}
        {phase === "error" && error && !isPaymentError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxTitle}>⚠ {error}</Text>
          </View>
        )}

        {/* Diagnostic log — DEBUG builds only */}
        {DEBUG_ENABLED && diagLog ? (
          <View style={styles.debugBox}>
            <Text style={styles.debugTitle}>📋 Diagnostics</Text>
            <Text style={styles.debugMsg} selectable>{diagLog}</Text>
          </View>
        ) : null}

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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // backgroundColor applied dynamically via th.rootBg
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    gap: spacing.lg,
  },

  // Stage section — auto-height wrapper; height is driven by the card's
  // aspectRatio, not by flex, so it never balloons on tall phones.
  stageSection: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  // Stage card — width-driven 16:9 frame.  CONTAIN letterbox bars are clipped
  // inside the rounded border so they read as part of the stage, not loose chrome.
  stageCard: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
  },
  videoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  videoLoadingText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },

  // Bottom panel — fills all remaining height after the fixed-ratio stage card
  bottomPanel: {
    flex: 1,
    borderTopWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
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
    fontSize: fontSize.xs,
    fontWeight: "600",
    // color applied dynamically
  },

  // Conversation area — flex:1 fills available space between statusRow and controls
  convoScroll: {
    flex: 1,
    marginBottom: spacing.sm,
  },
  convoContent: {
    gap: spacing.xs,
  },
  hint: {
    fontSize: fontSize.sm,
    textAlign: "center",
    marginBottom: spacing.sm,
    lineHeight: 20,
    // color applied dynamically
  },

  // Bubbles
  bubbleLabel: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    // color applied dynamically
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
    borderRadius: radii.md,
    padding: spacing.sm,
    // backgroundColor applied dynamically
  },
  aiBubbleText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    // color applied dynamically
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

  // Error box (inline, inside bottom panel)
  errorBox: {
    backgroundColor: "rgba(220,38,38,0.2)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.5)",
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  errorBoxTitle: {
    fontSize: fontSize.sm,
    color: colors.error,
    lineHeight: 18,
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
