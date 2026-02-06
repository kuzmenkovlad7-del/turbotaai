import React from "react"
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from "react-native"
import { colors, radii, fontSize } from "@/constants/theme"

type Variant = "primary" | "secondary" | "outline" | "danger" | "ghost"

type Props = {
  title: string
  onPress: () => void
  variant?: Variant
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
}

export default function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  textStyle,
}: Props) {
  const isDisabled = disabled || loading
  const bg = variantBg[variant]
  const fg = variantFg[variant]
  const border = variantBorder[variant]

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        { backgroundColor: bg },
        border ? { borderWidth: 1.5, borderColor: border } : undefined,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={[styles.text, { color: fg }, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  )
}

const variantBg: Record<Variant, string> = {
  primary: colors.primary,
  secondary: colors.primaryLight,
  outline: "transparent",
  danger: colors.error,
  ghost: "transparent",
}
const variantFg: Record<Variant, string> = {
  primary: "#ffffff",
  secondary: colors.primary,
  outline: colors.primary,
  danger: "#ffffff",
  ghost: colors.primary,
}
const variantBorder: Record<Variant, string | null> = {
  primary: null,
  secondary: null,
  outline: colors.border,
  danger: null,
  ghost: null,
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  text: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
})
