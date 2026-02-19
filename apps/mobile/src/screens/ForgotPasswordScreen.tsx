import React, { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native"
import ScreenWrapper from "@/components/ScreenWrapper"
import Button from "@/components/Button"
import Input from "@/components/Input"
import { useT } from "@/hooks/useLanguage"
import { resetPassword, isSupabaseConfigured } from "@/services/supabase"
import { colors, fontSize, spacing } from "@/constants/theme"

type Props = {
  onBack: () => void
}

export default function ForgotPasswordScreen({ onBack }: Props) {
  const { t } = useT()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    setError("")
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return setError(t.loginErrEmail)

    if (!isSupabaseConfigured()) {
      return setError("Supabase is not configured.")
    }

    setLoading(true)
    try {
      const result = await resetPassword(trimmed)
      if (result.ok) {
        setSent(true)
      } else {
        setError(result.error || t.forgotPasswordError)
      }
    } catch (e: any) {
      setError(e?.message || t.forgotPasswordError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.header}>
            <Text style={styles.logo}>{t.appName}</Text>
            <Text style={styles.tagline}>{t.forgotPasswordTitle}</Text>
          </View>

          {sent ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{t.forgotPasswordSent}</Text>
              <Button title={t.forgotPasswordBackToLogin} onPress={onBack} style={{ marginTop: spacing.lg }} />
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.desc}>{t.forgotPasswordDesc}</Text>
              <Input
                label={t.loginEmail}
                placeholder={t.loginEmailPlaceholder}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button
                title={t.forgotPasswordSubmit}
                onPress={handleSubmit}
                loading={loading}
                style={{ marginTop: spacing.sm }}
              />

              <TouchableOpacity onPress={onBack} style={styles.link}>
                <Text style={styles.linkText}>{t.forgotPasswordBackToLogin}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.xxl },
  header: { alignItems: "center", marginBottom: spacing.xxxl },
  logo: { fontSize: fontSize.hero, fontWeight: "800", color: colors.primary },
  tagline: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs },
  desc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  form: {},
  successBox: { alignItems: "center", padding: spacing.lg },
  successText: {
    fontSize: fontSize.md,
    color: colors.success,
    textAlign: "center",
    lineHeight: 22,
  },
  error: {
    fontSize: fontSize.sm,
    color: colors.error,
    textAlign: "center",
    marginBottom: spacing.sm,
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    borderRadius: 8,
    overflow: "hidden",
  },
  link: { alignItems: "center", marginTop: spacing.xl },
  linkText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: "600" },
})
