import React, { useState, useCallback } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  ScrollView,
  ActivityIndicator,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAuth } from "@/hooks/useAuth"
import { useT } from "@/hooks/useLanguage"
import { API_BASE_URL } from "@/constants/config"
import { getAccessState } from "@/utils/accessState"
import { colors, fontSize, spacing, radii } from "@/constants/theme"
import { logEvent } from "@/services/analytics"

type Character = {
  id: string           // dr-* — what the backend reads
  avatarSlug: string   // mia | alex | leo
  nameKey: "assistantCharacterMia" | "assistantCharacterAlex" | "assistantCharacterLeo"
  gender: "female" | "male"
  emoji: string
  accent: string
  accentLight: string
}

const CHARACTERS: Character[] = [
  {
    id: "dr-maria",
    avatarSlug: "mia",
    nameKey: "assistantCharacterMia",
    gender: "female",
    emoji: "\uD83D\uDC69\u200D\u2695\uFE0F",
    accent: "#db2777",
    accentLight: "#fce7f3",
  },
  {
    id: "dr-sophia",
    avatarSlug: "alex",
    nameKey: "assistantCharacterAlex",
    gender: "female",
    emoji: "\uD83D\uDC69\u200D\uD83D\uDCBC",
    accent: "#0ea5e9",
    accentLight: "#e0f2fe",
  },
  {
    id: "dr-alexander",
    avatarSlug: "leo",
    nameKey: "assistantCharacterLeo",
    gender: "male",
    emoji: "\uD83D\uDC68\u200D\u2695\uFE0F",
    accent: "#7c3aed",
    accentLight: "#ede9fe",
  },
]

export default function VideoAssistantScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { accessInfo } = useAuth()
  const { t, locale } = useT()
  const accessState = getAccessState(accessInfo)

  const [selectedCharacter, setSelectedCharacter] = useState<Character>(CHARACTERS[0])
  const [starting, setStarting] = useState(false)
  const [permError, setPermError] = useState<string | null>(null)

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "android") return true
    try {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ])
      return (
        results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED &&
        results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED
      )
    } catch {
      return false
    }
  }, [])

  const handleStart = useCallback(async () => {
    if (starting) return
    setStarting(true)
    setPermError(null)

    try {
      // Access gate — same rules as web platform (paid | promo | trial with questions left)
      if (accessState.isLocked) {
        setPermError(t.accessLockedTitle)
        return
      }

      const granted = await requestPermissions()
      if (!granted) {
        // Show the more restrictive error (camera covers both)
        setPermError(t.permCameraDenied)
        return
      }

      logEvent("video_call_started", {
        characterId: selectedCharacter.id,
        avatarSlug: selectedCharacter.avatarSlug,
      })

      // Build embedded URL — character and gender are pre-selected on the web side
      const uri =
        `${API_BASE_URL}/app/video` +
        `?character=${selectedCharacter.id}` +
        `&avatar=${selectedCharacter.avatarSlug}` +
        `&gender=${selectedCharacter.gender}` +
        `&lang=${locale}`
      ;(navigation as any).navigate("WebView", { uri, title: t.videoTitle })
    } finally {
      setStarting(false)
    }
  }, [starting, selectedCharacter, locale, t, navigation, requestPermissions, accessState.isLocked])

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>{"\uD83C\uDFA5"}</Text>
          <Text style={styles.heroTitle}>{t.videoTitle}</Text>
          <Text style={styles.heroDesc}>{t.videoCallDesc}</Text>
        </View>

        {/* Character cards */}
        <Text style={styles.sectionLabel}>{"\uD83E\uDDB8"} {t.videoTitle}</Text>
        <View style={styles.characterGrid}>
          {CHARACTERS.map((char) => {
            const isActive = selectedCharacter.id === char.id
            return (
              <TouchableOpacity
                key={char.id}
                style={[
                  styles.characterCard,
                  isActive && {
                    borderColor: char.accent,
                    backgroundColor: char.accentLight,
                  },
                ]}
                onPress={() => setSelectedCharacter(char)}
                activeOpacity={0.75}
              >
                {isActive && (
                  <View style={[styles.selectedBadge, { backgroundColor: char.accent }]}>
                    <Text style={styles.selectedBadgeText}>✓</Text>
                  </View>
                )}
                <Text style={styles.charEmoji}>{char.emoji}</Text>
                <Text style={[styles.charName, isActive && { color: char.accent }]}>
                  {t[char.nameKey]}
                </Text>
                <Text style={styles.charGender}>
                  {char.gender === "female" ? t.voiceGenderFemale : t.voiceGenderMale}
                </Text>
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

      {/* CTA bar */}
      {accessState.isLocked ? (
        /* Paywall — user has no access */
        <View style={[styles.paywallBar, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View>
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
        <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          {accessState.isTrial && (
            <Text style={styles.trialChip}>{t.accessTrialRemaining(accessState.trialLeft)}</Text>
          )}
          <TouchableOpacity
            style={[
              styles.startBtn,
              { backgroundColor: selectedCharacter.accent },
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
                <Text style={styles.startBtnIcon}>{"\uD83C\uDFA5"}</Text>
                <Text style={styles.startBtnText}>{t.videoStartCall}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
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

  // Character grid
  characterGrid: { flexDirection: "row", gap: spacing.sm },
  characterCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    position: "relative",
  },
  selectedBadge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  charEmoji: { fontSize: 28, marginBottom: spacing.xs },
  charName: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  charGender: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },

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
  trialChip: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: spacing.xs,
  },

  // Paywall bar — shown when access is "none"
  paywallBar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.errorLight,
    borderTopWidth: 1,
    borderTopColor: colors.error,
    gap: spacing.md,
  },
  paywallTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.error },
  paywallDesc: { fontSize: fontSize.sm, color: colors.error, lineHeight: 18, marginTop: 2 },
  paywallBtn: {
    backgroundColor: colors.error,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: "center" as const,
  },
  paywallBtnText: { color: "#fff", fontWeight: "700", fontSize: fontSize.sm },
})
