import React from "react"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider } from "react-native-safe-area-context"
import AppNavigator from "@/navigation/AppNavigator"
import { LanguageContext, useLanguageProvider } from "@/hooks/useLanguage"
import { AuthContext, useAuthProvider } from "@/hooks/useAuth"

export default function App() {
  const lang = useLanguageProvider()
  const auth = useAuthProvider()

  return (
    <AuthContext.Provider value={auth}>
      <LanguageContext.Provider value={lang}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <AppNavigator />
        </SafeAreaProvider>
      </LanguageContext.Provider>
    </AuthContext.Provider>
  )
}
