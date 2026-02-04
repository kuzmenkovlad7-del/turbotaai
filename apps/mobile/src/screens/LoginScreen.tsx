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
import { colors, fontSize, spacing } from "@/constants/theme"

type Props = {
  onLogin: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  onGoToRegister: () => void
  loading: boolean
  error: string | null
}

export default function LoginScreen({ onLogin, onGoToRegister, loading, error }: Props) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [localError, setLocalError] = useState("")
  const passwordRef = useRef<TextInput>(null)

  const handleSubmit = async () => {
    setLocalError("")
    if (!email.trim()) return setLocalError("Please enter your email")
    if (!password) return setLocalError("Please enter your password")
    try {
      const result = await onLogin(email.trim().toLowerCase(), password)
      if (!result.ok && result.error) setLocalError(result.error)
    } catch (e: any) {
      setLocalError(e?.message || "Login failed. Check your connection.")
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
            <Text style={styles.logo}>TurbotaAI</Text>
            <Text style={styles.tagline}>Your AI companion</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Input
              ref={passwordRef}
              label="Password"
              placeholder="Your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />

            {displayError ? <Text style={styles.error}>{displayError}</Text> : null}

            <Button
              title="Sign In"
              onPress={handleSubmit}
              loading={loading}
              style={{ marginTop: spacing.sm }}
            />

            <TouchableOpacity onPress={onGoToRegister} style={styles.link}>
              <Text style={styles.linkText}>
                Don't have an account? <Text style={styles.linkBold}>Create one</Text>
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
  link: { alignItems: "center", marginTop: spacing.xl },
  linkText: { fontSize: fontSize.sm, color: colors.textSecondary },
  linkBold: { color: colors.primary, fontWeight: "600" },
})
