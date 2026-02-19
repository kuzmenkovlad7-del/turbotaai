import React from "react"
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, useColorScheme } from "react-native"
import { StatusBar } from "expo-status-bar"
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { useAuth } from "@/hooks/useAuth"
import { useT } from "@/hooks/useLanguage"
import { colors, darkColors, fontSize, spacing, radii } from "@/constants/theme"
import { ENV_OK, ENV_ISSUES } from "@/constants/config"

/** Light nav theme */
const LightNavTheme = {
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

/** Dark nav theme */
const DarkNavTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: darkColors.primary,
    background: darkColors.background,
    card: darkColors.surface,
    text: darkColors.text,
    border: darkColors.border,
    notification: darkColors.primary,
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
import ForgotPasswordScreen from "@/screens/ForgotPasswordScreen"

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
  ConversationDetail: { id: string; title?: string }
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

function TabIcon({ label, focused, isDark }: { label: string; focused: boolean; isDark: boolean }) {
  const c = isDark ? darkColors : colors
  const iconMap: Record<string, string> = {
    Home: "\u2302",
    History: "\u2630",
    Account: "\u2699",
  }
  return (
    <Text style={{ fontSize: 20, color: focused ? c.primary : c.textMuted }}>
      {iconMap[label] || "\u25CB"}
    </Text>
  )
}

/* ── Main tab navigator ── */

function MainTabs({ isDark }: { isDark: boolean }) {
  const { t } = useT()
  const c = isDark ? darkColors : colors
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          paddingBottom: 4,
          height: 56,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIcon: ({ focused }) => {
          const label = route.name.replace("Tab", "")
          return <TabIcon label={label} focused={focused} isDark={isDark} />
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        options={{ tabBarLabel: t.homeWelcome }}
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
  const scheme = useColorScheme()
  const isDark = scheme === "dark"
  const c = isDark ? darkColors : colors
  const navTheme = isDark ? DarkNavTheme : LightNavTheme

  // Missing environment variables — show clear error instead of crashing silently
  if (!ENV_OK) {
    return (
      <View style={[styles.splash, { backgroundColor: c.background }]}>
        <Text style={[styles.splashLogo, { color: c.primary }]}>TurbotaAI</Text>
        <ScrollView style={styles.configErrorScroll} contentContainerStyle={styles.configErrorContent}>
          <Text style={[styles.configTitle, { color: c.error }]}>Configuration Error</Text>
          <Text style={[styles.configDesc, { color: c.textSecondary }]}>
            Required environment variables are missing. Copy .env.example to .env and fill in the values.
          </Text>
          {ENV_ISSUES.map((issue) => (
            <View key={issue.name} style={styles.configRow}>
              <Text style={[styles.configSeverity, { color: c.error }]}>
                {issue.severity === "error" ? "MISSING" : "WARN"}
              </Text>
              <Text style={[styles.configVar, { color: c.text }]}>{issue.name}</Text>
            </View>
          ))}
          <Text style={[styles.configHint, { color: c.textMuted }]}>
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
      <View style={[styles.splash, { backgroundColor: c.background }]}>
        <Text style={[styles.splashLogo, { color: c.primary }]}>TurbotaAI</Text>
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 24 }} />
      </View>
    )
  }

  // Bootstrap failed with no user — show error with retry
  if (bootstrapFailed && !user && error) {
    return (
      <View style={[styles.splash, { backgroundColor: c.background }]}>
        <Text style={[styles.splashLogo, { color: c.primary }]}>TurbotaAI</Text>
        <View style={styles.errorBox}>
          <Text style={[styles.errorText, { color: c.error }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: c.primary }]} onPress={retryBootstrap} activeOpacity={0.7}>
            <Text style={styles.retryText}>{t.retry}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="auto" />
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
            options={{ headerShown: false }}
          >
            {() => <MainTabs isDark={isDark} />}
          </AppStack.Screen>
          <AppStack.Screen
            name="Chat"
            component={ChatScreen}
            options={{
              headerShown: true,
              title: t.homeChat,
              headerTintColor: c.primary,
              headerStyle: { backgroundColor: c.surface },
              headerTitleStyle: { fontWeight: "600" },
            }}
          />
          <AppStack.Screen
            name="VideoAssistant"
            component={VideoAssistantScreen}
            options={{
              headerShown: true,
              title: t.homeVideo,
              headerTintColor: c.primary,
              headerStyle: { backgroundColor: c.surface },
              headerTitleStyle: { fontWeight: "600" },
            }}
          />
          <AppStack.Screen
            name="VoiceAssistant"
            component={VoiceAssistantScreen}
            options={{
              headerShown: true,
              title: t.homeVoice,
              headerTintColor: c.primary,
              headerStyle: { backgroundColor: c.surface },
              headerTitleStyle: { fontWeight: "600" },
            }}
          />
          <AppStack.Screen
            name="ConversationDetail"
            component={ConversationDetailScreen}
            options={({ route }) => ({
              headerShown: true,
              title: (route.params as any)?.title || "Conversation",
              headerTintColor: c.primary,
              headerStyle: { backgroundColor: c.surface },
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
  },
  splashLogo: {
    fontSize: fontSize.hero,
    fontWeight: "800",
  },
  errorBox: {
    marginTop: spacing.xxl,
    alignItems: "center",
    paddingHorizontal: spacing.xxxl,
  },
  errorText: {
    fontSize: fontSize.md,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  retryBtn: {
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
    marginBottom: spacing.sm,
  },
  configDesc: {
    fontSize: fontSize.sm,
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
    width: 60,
  },
  configVar: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  configHint: {
    marginTop: spacing.lg,
    fontSize: fontSize.xs,
    textAlign: "center",
    lineHeight: 18,
  },
})
