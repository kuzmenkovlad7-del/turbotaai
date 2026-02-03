import React from "react"
import { View, Text, ActivityIndicator, StyleSheet } from "react-native"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { useAuth } from "@/hooks/useAuth"
import { colors, fontSize } from "@/constants/theme"

import LoginScreen from "@/screens/LoginScreen"
import RegisterScreen from "@/screens/RegisterScreen"
import HomeScreen from "@/screens/HomeScreen"
import ChatScreen from "@/screens/ChatScreen"
import HistoryScreen from "@/screens/HistoryScreen"
import ConversationDetailScreen from "@/screens/ConversationDetailScreen"
import AccountScreen from "@/screens/AccountScreen"

/* ── Type definitions ── */

type AuthStackParams = {
  Login: undefined
  Register: undefined
}

type AppStackParams = {
  MainTabs: { screen?: string } | undefined
  Chat: undefined
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
        options={{ tabBarLabel: "Home" }}
      >
        {(props) => <HomeScreen navigation={props.navigation.getParent()} />}
      </Tab.Screen>
      <Tab.Screen
        name="HistoryTab"
        options={{ tabBarLabel: "History" }}
      >
        {(props) => <HistoryScreen navigation={props.navigation.getParent()} />}
      </Tab.Screen>
      <Tab.Screen
        name="AccountTab"
        component={AccountScreen}
        options={{ tabBarLabel: "Account" }}
      />
    </Tab.Navigator>
  )
}

/* ── Root navigator ── */

export default function AppNavigator() {
  const { ready, user, login, register, loading, error } = useAuth()

  // Splash / loading state
  if (!ready) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashLogo}>TurbotaAI</Text>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
      </View>
    )
  }

  return (
    <NavigationContainer>
      {!user ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login">
            {({ navigation }) => (
              <LoginScreen
                onLogin={login}
                onGoToRegister={() => navigation.navigate("Register")}
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
              title: "AI Assistant",
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.surface },
              headerTitleStyle: { fontWeight: "600" },
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
})
