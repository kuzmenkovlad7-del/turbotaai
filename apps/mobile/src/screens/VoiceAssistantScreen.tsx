import React, { useState, useCallback } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  PermissionsAndroid,
  ScrollView,
  ActivityIndicator,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useT } from "@/hooks/useLanguage"
import { API_BASE_URL } from "@/constants/config"
import { colors, fontSize, spacing, radii } from "@/constants/theme"
import { logEvent } from "@/services/analytics"

type VoiceGender = "female" | "male"

type GenderOption = {
  id: VoiceGender
  emoji: string
  labelKey: "voiceGenderFemale" | "voiceGenderMale"
  accent: string
  accentLight: string
}

const GENDER_OPTIONS: GenderOption[] = [
  {
    id: "female",
    emoji: "\u2640\uFE0F",
    labelKey: "voiceGenderFemale",
    accent: "#db2777",
    accentLight: "#fce7f3",
  },
  {
    id: "male",
    emoji: "\u2642\uFE0F",
    labelKey: "voiceGenderMale",
    accent: "#2563eb",
    accentLight: "#dbeafe",
  },
]

export default function VoiceAssistantScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { t, locale } = useT()

  const [gender, setGender] = useState<VoiceGender>("female")
  const [starting, setStarting] = useState(false)
  const [permError, setPermError] = useState<string | null>(null)

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "android") return true
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: t.permMicTitle,
          message: t.permMicMessage,
          buttonPositive: "OK",
        },
      )
      return result === PermissionsAndroid.RESULTS.GRANTED
    } catch {
      return false
    }
  }, [t])

  const handleStart = useCallback(async () => {
    if (starting) return
    setStarting(true)
    setPermError(null)

    try {
      const granted = await requestMicPermission()
      if (!granted) {
        setPermError(t.permMicDenied)
        return
      }

      logEvent("voice_call_started", { gender })

      // Build embedded URL — autostart=1 tells the web dialog to begin the call immediately
      const uri = `${API_BASE_URL}/app/voice?gender=${gender}&lang=${locale}&autostart=1`
      ;(navigation as any).navigate("WebView", { uri, title: t.voiceTitle })
    } finally {
      setStarting(false)
    }
  }, [starting, gender, locale, t, navigation, requestMicPermission])

  const selectedOption = GENDER_OPTIONS.find((g) => g.id === gender)!

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero section */}
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>{"\uD83C\uDF99\uFE0F"}</Text>
          <Text style={styles.heroTitle}>{t.voiceTitle}</Text>
          <Text style={styles.heroDesc}>{t.voiceCallDesc}</Text>
        </View>

        {/* Gender selector */}
        <Text style={styles.sectionLabel}>{"\uD83C\uDFA4"} {t.voiceTitle}</Text>
        <View style={styles.genderRow}>
          {GENDER_OPTIONS.map((opt) => {
            const isActive = gender === opt.id
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.genderCard,
                  isActive && { borderColor: opt.accent, backgroundColor: opt.accentLight },
                ]}
                onPress={() => setGender(opt.id)}
                activeOpacity={0.75}
              >
                <Text style={styles.genderEmoji}>{opt.emoji}</Text>
                <Text style={[styles.genderLabel, isActive && { color: opt.accent }]}>
                  {t[opt.labelKey]}
                </Text>
                {isActive && (
                  <View style={[styles.genderCheck, { backgroundColor: opt.accent }]}>
                    <Text style={styles.genderCheckMark}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Permission error */}
        {permError && (
          <View style={styles.permErrorBox}>
            <Text style={styles.permErrorText}>{permError}</Text>
          </View>
        )}

      </ScrollView>

      {/* Start CTA */}
      <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <TouchableOpacity
          style={[
            styles.startBtn,
            { backgroundColor: selectedOption.accent },
            starting && styles.startBtnDisabled,
          ]}
          onPress={handleStart}
          disabled={starting}
          activeOpacity={0.85}
        >
          {starting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.startBtnIcon}>{"\uD83D\uDCDE"}</Text>
              <Text style={styles.startBtnText}>{t.voiceStartCall}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Hero
  hero: { alignItems: "center", paddingVertical: spacing.xl },
  heroIcon: { fontSize: 56, marginBottom: spacing.md },
  heroTitle: {
    fontSize: fontSize.xxl,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  heroDesc: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },

  // Section label
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },

  // Gender cards
  genderRow: { flexDirection: "row", gap: spacing.md },
  genderCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: spacing.xl,
    alignItems: "center",
    position: "relative",
  },
  genderEmoji: { fontSize: 32, marginBottom: spacing.sm },
  genderLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
  },
  genderCheck: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  genderCheckMark: { color: "#fff", fontSize: 11, fontWeight: "700" },

  // Permission error
  permErrorBox: {
    marginTop: spacing.md,
    backgroundColor: colors.errorLight,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  permErrorText: { fontSize: fontSize.sm, color: colors.error, lineHeight: 20 },

  // CTA bar
  ctaBar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    borderRadius: radii.xl,
    gap: spacing.sm,
  },
  startBtnDisabled: { opacity: 0.6 },
  startBtnIcon: { fontSize: 20 },
  startBtnText: { color: "#fff", fontSize: fontSize.lg, fontWeight: "700" },
})
