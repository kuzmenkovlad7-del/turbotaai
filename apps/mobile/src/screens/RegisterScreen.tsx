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
  onRegister: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  onGoToLogin: () => void
  loading: boolean
  error: string | null
}

export default function RegisterScreen({ onRegister, onGoToLogin, loading, error }: Props) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [localError, setLocalError] = useState("")
  const passRef = useRef<TextInput>(null)
  const confirmRef = useRef<TextInput>(null)

  const handleSubmit = async () => {
    setLocalError("")
    if (!email.trim()) return setLocalError("Please enter your email")
    if (password.length < 6) return setLocalError("Password must be at least 6 characters")
    if (password !== confirm) return setLocalError("Passwords do not match")
    try {
      const result = await onRegister(email.trim().toLowerCase(), password)
      if (result.error) setLocalError(result.error) // covers both ok+error ("Check email") and !ok+error
    } catch (e: any) {
      setLocalError(e?.message || "Registration failed. Check your connection.")
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
            <Text style={styles.tagline}>Create your account</Text>
          </View>

          <View>
            <Input
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
              onSubmitEditing={() => passRef.current?.focus()}
            />
            <Input
              ref={passRef}
              label="Password"
              placeholder="At least 6 characters"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
            <Input
              ref={confirmRef}
              label="Confirm password"
              placeholder="Repeat your password"
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />

            {displayError ? <Text style={styles.error}>{displayError}</Text> : null}

            <Button
              title="Create Account"
              onPress={handleSubmit}
              loading={loading}
              style={{ marginTop: spacing.sm }}
            />

            <TouchableOpacity onPress={onGoToLogin} style={styles.link}>
              <Text style={styles.linkText}>
                Already have an account? <Text style={styles.linkBold}>Sign in</Text>
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
