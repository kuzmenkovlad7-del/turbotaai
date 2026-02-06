import React from "react"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider } from "react-native-safe-area-context"
import AppNavigator from "@/navigation/AppNavigator"
import { LanguageContext, useLanguageProvider } from "@/hooks/useLanguage"

export default function App() {
  const lang = useLanguageProvider()

  return (
    <LanguageContext.Provider value={lang}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AppNavigator />
      </SafeAreaProvider>
    </LanguageContext.Provider>
  )
}
