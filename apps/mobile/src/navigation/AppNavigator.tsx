import React from "react"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { useAuth } from "@/hooks/useAuth"
import { ActivityIndicator, View } from "react-native"

import LoginScreen from "@/screens/LoginScreen"
import HomeScreen from "@/screens/HomeScreen"
import ChatScreen from "@/screens/ChatScreen"
import HistoryScreen from "@/screens/HistoryScreen"
import AccountScreen from "@/screens/AccountScreen"

type RootStackParamList = {
  Login: undefined
  Register: undefined
  Main: undefined
  Chat: undefined
  ConversationDetail: { id: string }
}

type TabParamList = {
  Home: undefined
  History: undefined
  Account: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<TabParamList>()

function MainTabs({ navigation }: any) {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: "#7c3aed",
        tabBarInactiveTintColor: "#94a3b8",
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        options={{ tabBarLabel: "Home" }}
      >
        {() => (
          <HomeScreen
            onStartChat={() => navigation.navigate("Chat")}
            onOpenHistory={() => navigation.navigate("Main", { screen: "History" })}
            onOpenAccount={() => navigation.navigate("Main", { screen: "Account" })}
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="History"
        options={{ tabBarLabel: "History" }}
      >
        {() => (
          <HistoryScreen
            onSelectConversation={(id) =>
              navigation.navigate("ConversationDetail", { id })
            }
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login">
            {({ navigation }) => (
              <LoginScreen
                onNavigateToRegister={() => {}}
                onLoginSuccess={() => {}}
              />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{ headerShown: true, title: "AI Assistant" }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
