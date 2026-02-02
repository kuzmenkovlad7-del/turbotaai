import React, { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native"
import { useAuth } from "@/hooks/useAuth"

type Props = {
  onNavigateToRegister: () => void
  onLoginSuccess: () => void
}

export default function LoginScreen({ onNavigateToRegister, onLoginSuccess }: Props) {
  const { login, loading, error } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return
    const ok = await login(email.trim(), password)
    if (ok) onLoginSuccess()
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>TurbotaAI</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onNavigateToRegister} style={styles.link}>
          <Text style={styles.linkText}>Don't have an account? Register</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  title: {
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    color: "#7c3aed",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#64748b",
    marginBottom: 32,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#7c3aed",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#dc2626", fontSize: 14, textAlign: "center", marginBottom: 8 },
  link: { marginTop: 16, alignItems: "center" },
  linkText: { color: "#7c3aed", fontSize: 14 },
})
