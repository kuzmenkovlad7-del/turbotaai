import React from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from "react-native"
import { useAuth } from "@/hooks/useAuth"
import { useSubscription } from "@/hooks/useSubscription"
import { IAP_PRODUCTS } from "@/constants/config"

export default function AccountScreen() {
  const { user, loading: authLoading, logout } = useAuth()
  const { hasAccess, accessUntil, loading: subLoading, purchasing, purchase, error } = useSubscription()

  if (authLoading || subLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 40 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        {user ? (
          <>
            <Text style={styles.email}>{user.email}</Text>
            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.info}>Not signed in</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        {hasAccess ? (
          <View style={styles.activeBox}>
            <Text style={styles.activeText}>Active</Text>
            {accessUntil && (
              <Text style={styles.info}>
                Access until: {new Date(accessUntil).toLocaleDateString()}
              </Text>
            )}
          </View>
        ) : (
          <>
            <Text style={styles.info}>No active subscription</Text>
            <TouchableOpacity
              style={[styles.purchaseBtn, purchasing && styles.purchaseBtnDisabled]}
              onPress={() => purchase(IAP_PRODUCTS.MONTHLY)}
              disabled={purchasing}
            >
              {purchasing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.purchaseText}>Subscribe Monthly</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.purchaseBtn, styles.yearlyBtn, purchasing && styles.purchaseBtnDisabled]}
              onPress={() => purchase(IAP_PRODUCTS.YEARLY)}
              disabled={purchasing}
            >
              <Text style={styles.purchaseText}>Subscribe Yearly (Best Value)</Text>
            </TouchableOpacity>
          </>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  section: { paddingHorizontal: 24, paddingTop: 24 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#1e293b", marginBottom: 12 },
  email: { fontSize: 16, color: "#475569" },
  info: { fontSize: 14, color: "#64748b", marginTop: 4 },
  logoutBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dc2626",
    alignSelf: "flex-start",
  },
  logoutText: { color: "#dc2626", fontWeight: "600" },
  activeBox: {
    backgroundColor: "#dcfce7",
    borderRadius: 12,
    padding: 16,
  },
  activeText: { fontSize: 18, fontWeight: "700", color: "#16a34a" },
  purchaseBtn: {
    backgroundColor: "#7c3aed",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
  },
  yearlyBtn: { backgroundColor: "#4f46e5" },
  purchaseBtnDisabled: { opacity: 0.6 },
  purchaseText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#dc2626", fontSize: 14, marginTop: 8 },
})
