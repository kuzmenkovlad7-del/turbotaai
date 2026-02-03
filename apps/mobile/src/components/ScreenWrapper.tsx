import React from "react"
import { View, StyleSheet, type ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { colors } from "@/constants/theme"

type Props = {
  children: React.ReactNode
  style?: ViewStyle
  padBottom?: boolean
}

/** Full-screen wrapper with safe area insets and themed background */
export default function ScreenWrapper({ children, style, padBottom = true }: Props) {
  const insets = useSafeAreaInsets()
  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top,
          paddingBottom: padBottom ? insets.bottom : 0,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
})
