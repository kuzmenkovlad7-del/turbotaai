import React, { useEffect, useRef } from "react"
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView } from "react-native"
import { StatusBar } from "expo-status-bar"
import { NavigationContainer, DefaultTheme } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { useAuth } from "@/hooks/useAuth"
import { useT } from "@/hooks/useLanguage"
import { colors, fontSize, spacing, radii } from "@/constants/theme"
import { ENV_OK, ENV_ISSUES } from "@/constants/config"
import { logEvent } from "@/services/analytics"

/** Force light theme — never inherit device dark mode */
const LightTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
}

import LoginScreen from "@/screens/LoginScreen"
import RegisterScreen from "@/screens/RegisterScreen"
import HomeScreen from "@/screens/HomeScreen"
import ChatScreen from "@/screens/ChatScreen"
import HistoryScreen from "@/screens/HistoryScreen"
import ConversationDetailScreen from "@/screens/ConversationDetailScreen"
import AccountScreen from "@/screens/AccountScreen"
import VideoAssistantScreen from "@/screens/VideoAssistantScreen"
import VoiceAssistantScreen from "@/screens/VoiceAssistantScreen"
import NativeVoiceCallScreen, { type NativeVoiceCallParams } from "@/screens/NativeVoiceCallScreen"
import NativeVideoCallScreen, { type NativeVideoCallParams } from "@/screens/NativeVideoCallScreen"
import ForgotPasswordScreen from "@/screens/ForgotPasswordScreen"
import WebViewScreen, { type WebViewScreenParams } from "@/screens/WebViewScreen"

/* ── Type definitions ── */

export type AuthStackParams = {
  Login: undefined
  Register: undefined
  ForgotPassword: undefined
}

export type AppStackParams = {
  MainTabs: { screen?: string } | undefined
  Chat: undefined
  VideoAssistant: undefined
  VoiceAssistant: undefined
  NativeVoiceCall: NativeVoiceCallParams
  NativeVideoCall: NativeVideoCallParams
  ConversationDetail: { id: string; title?: string }
  WebView: WebViewScreenParams
}

type TabParams = {
  HomeTab: undefined
  HistoryTab: undefined
  AccountTab: undefined
}

const AuthStack = createNativeStackNavigator<AuthStackParams>()
const AppStack = createNativeStackNavigator<AppStackParams>()
const Tab = createBottomTabNavigator<TabParams>()

/* ── Tab icons (simple text, no external icon lib needed) ── */

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: "\u2302",
    History: "\u2630",
    Account: "\u2699",
  }
  return (
    <Text style={{ fontSize: 20, color: focused ? colors.primary : colors.textMuted }}>
      {icons[label] || "\u25CB"}
    </Text>
  )
}

/* ── Main tab navigator ── */

function MainTabs() {
  const { t } = useT()
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: 4,
          height: 56,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIcon: ({ focused }) => {
          const label = route.name.replace("Tab", "")
          return <TabIcon label={label} focused={focused} />
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        options={{ tabBarLabel: t.homeTabLabel }}
      >
        {(props) => <HomeScreen navigation={props.navigation.getParent() ?? props.navigation} />}
      </Tab.Screen>
      <Tab.Screen
        name="HistoryTab"
        options={{ tabBarLabel: t.historyTitle }}
      >
        {(props) => <HistoryScreen navigation={props.navigation.getParent() ?? props.navigation} />}
      </Tab.Screen>
      <Tab.Screen
        name="AccountTab"
        component={AccountScreen}
        options={{ tabBarLabel: t.accountTitle }}
      />
    </Tab.Navigator>
  )
}

/* ── Root navigator ── */

export default function AppNavigator() {
  const { ready, user, login, register, loading, error, bootstrapFailed, retryBootstrap } = useAuth()
  const { t } = useT()

  // Fire app_open once when bootstrap completes
  const appOpenFiredRef = useRef(false)
  useEffect(() => {
    if (ready && !appOpenFiredRef.current) {
      appOpenFiredRef.current = true
      logEvent("app_open", { logged_in: !!user })
    }
  }, [ready, user])

  // Missing environment variables — show clear error instead of crashing silently
  if (!ENV_OK) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashLogo}>TurbotaAI</Text>
        <ScrollView style={styles.configErrorScroll} contentContainerStyle={styles.configErrorContent}>
          <Text style={styles.configTitle}>Configuration Error</Text>
          <Text style={styles.configDesc}>
            Required environment variables are missing. Copy .env.example to .env and fill in the values.
          </Text>
          {ENV_ISSUES.map((issue) => (
            <View key={issue.name} style={styles.configRow}>
              <Text style={styles.configSeverity}>
                {issue.severity === "error" ? "MISSING" : "WARN"}
              </Text>
              <Text style={styles.configVar}>{issue.name}</Text>
            </View>
          ))}
          <Text style={styles.configHint}>
            File: apps/mobile/.env{"\n"}
            Then restart: npx expo start --clear
          </Text>
        </ScrollView>
      </View>
    )
  }

  // Splash / loading state
  if (!ready) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashLogo}>TurbotaAI</Text>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
      </View>
    )
  }

  // Bootstrap failed with no user — show localized error with retry
  if (bootstrapFailed && !user) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashLogo}>TurbotaAI</Text>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{t.bootstrapErrorDesc}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retryBootstrap} activeOpacity={0.7}>
            <Text style={styles.retryText}>{t.bootstrapRetry}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <NavigationContainer theme={LightTheme}>
      <StatusBar style="dark" />
      {!user ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login">
            {({ navigation }) => (
              <LoginScreen
                onLogin={login}
                onGoToRegister={() => navigation.navigate("Register")}
                onGoToForgotPassword={() => navigation.navigate("ForgotPassword")}
                loading={loading}
                error={error}
              />
            )}
          </AuthStack.Screen>
          <AuthStack.Screen name="Register">
            {({ navigation }) => (
              <RegisterScreen
                onRegister={register}
                onGoToLogin={() => navigation.goBack()}
                loading={loading}
                error={error}
              />
            )}
          </AuthStack.Screen>
          <AuthStack.Screen name="ForgotPassword">
            {({ navigation }) => (
              <ForgotPasswordScreen onBack={() => navigation.goBack()} />
            )}
          </AuthStack.Screen>
        </AuthStack.Navigator>
      ) : (
        <AppStack.Navigator>
          <AppStack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <AppStack.Screen
            name="Chat"
            component={ChatScreen}
            options={{
              headerShown: true,
              title: t.homeChat,
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { fontWeight: "600" },
            }}
          />
          <AppStack.Screen
            name="VideoAssistant"
            component={VideoAssistantScreen}
            options={{
              headerShown: true,
              title: t.homeVideo,
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { fontWeight: "600" },
            }}
          />
          <AppStack.Screen
            name="VoiceAssistant"
            component={VoiceAssistantScreen}
            options={{
              headerShown: true,
              title: t.homeVoice,
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { fontWeight: "600" },
            }}
          />
          <AppStack.Screen
            name="NativeVoiceCall"
            component={NativeVoiceCallScreen}
            options={{
              headerShown: true,
              title: t.voiceTitle,
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { fontWeight: "600" },
            }}
          />
          <AppStack.Screen
            name="NativeVideoCall"
            component={NativeVideoCallScreen}
            options={{
              headerShown: false,   // full-screen video call — no header bar
              orientation: "portrait",
            }}
          />
          <AppStack.Screen
            name="ConversationDetail"
            component={ConversationDetailScreen}
            options={({ route }) => ({
              headerShown: true,
              title: (route.params as any)?.title || "Conversation",
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { fontWeight: "600" },
            })}
          />
          <AppStack.Screen
            name="WebView"
            component={WebViewScreen}
            options={({ route }) => ({
              headerShown: true,
              title: (route.params as any)?.title || "TurbotaAI",
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { fontWeight: "600" },
            })}
          />
        </AppStack.Navigator>
      )}
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  splashLogo: {
    fontSize: fontSize.hero,
    fontWeight: "800",
    color: colors.primary,
  },
  errorBox: {
    marginTop: spacing.xxl,
    alignItems: "center",
    paddingHorizontal: spacing.xxxl,
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.error,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.md,
  },
  retryText: {
    color: "#fff",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  configErrorScroll: {
    marginTop: spacing.xxl,
    maxHeight: 400,
    width: "100%",
  },
  configErrorContent: {
    paddingHorizontal: spacing.xxl,
    alignItems: "center",
  },
  configTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.error,
    marginBottom: spacing.sm,
  },
  configDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  configRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
    width: "100%",
  },
  configSeverity: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.error,
    width: 60,
  },
  configVar: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "monospace",
  },
  configHint: {
    marginTop: spacing.lg,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
})
