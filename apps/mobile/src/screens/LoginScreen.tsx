import React, { useState, useRef } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native"
import ScreenWrapper from "@/components/ScreenWrapper"
import Button from "@/components/Button"
import Input from "@/components/Input"
import { useT } from "@/hooks/useLanguage"
import { colors, fontSize, spacing, radii } from "@/constants/theme"

type Props = {
  onLogin: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  onGoToRegister: () => void
  onGoToForgotPassword: () => void
  loading: boolean
  error: string | null
}

export default function LoginScreen({ onLogin, onGoToRegister, onGoToForgotPassword, loading, error }: Props) {
  const { t } = useT()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [localError, setLocalError] = useState("")
  const passwordRef = useRef<TextInput>(null)

  const handleSubmit = async () => {
    setLocalError("")
    if (!email.trim()) return setLocalError(t.loginErrEmail)
    if (!password) return setLocalError(t.loginErrPassword)
    try {
      const result = await onLogin(email.trim().toLowerCase(), password)
      if (!result.ok && result.error) setLocalError(result.error)
    } catch (e: any) {
      setLocalError(e?.message || t.loginErrFailed)
    }
  }

  const displayError = localError || error

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
            <Text style={styles.tagline}>{t.loginTagline}</Text>
          </View>

          <View style={styles.form}>
            <Input
              label={t.loginEmail}
              placeholder={t.loginEmailPlaceholder}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Input
              ref={passwordRef}
              label={t.loginPassword}
              placeholder={t.loginPasswordPlaceholder}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />

            {displayError ? <Text style={styles.error}>{displayError}</Text> : null}

            <TouchableOpacity onPress={onGoToForgotPassword} style={styles.forgotLink}>
              <Text style={styles.forgotText}>{t.forgotPasswordLink}</Text>
            </TouchableOpacity>

            <Button
              title={t.loginSubmit}
              onPress={handleSubmit}
              loading={loading}
              style={{ marginTop: spacing.sm }}
            />

            {/* OAuth stub — TODO: wire expo-auth-session when backend OAuth redirect is ready */}
            <TouchableOpacity
              style={styles.oauthBtn}
              onPress={() => {
                // TODO: Implement with expo-auth-session + supabase.auth.signInWithOAuth
                alert(t.oauthComingSoon)
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.oauthText}>{t.oauthGoogle}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onGoToRegister} style={styles.link}>
              <Text style={styles.linkText}>
                {t.loginNoAccount} <Text style={styles.linkBold}>{t.loginCreate}</Text>
              </Text>
            </TouchableOpacity>
          </View>
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
  form: {},
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
  forgotLink: { alignSelf: "flex-end", marginTop: spacing.xs, marginBottom: spacing.xs },
  forgotText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: "500" },
  oauthBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  oauthText: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  link: { alignItems: "center", marginTop: spacing.xl },
  linkText: { fontSize: fontSize.sm, color: colors.textSecondary },
  linkBold: { color: colors.primary, fontWeight: "600" },
})
