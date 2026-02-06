import React, { forwardRef } from "react"
import { TextInput, View, Text, StyleSheet, type TextInputProps } from "react-native"
import { colors, radii, fontSize, spacing } from "@/constants/theme"

type Props = TextInputProps & {
  label?: string
  error?: string
}

const Input = forwardRef<TextInput, Props>(({ label, error, style, ...rest }, ref) => {
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        ref={ref}
        style={[styles.input, error ? styles.inputError : undefined, style]}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        {...rest}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
})

Input.displayName = "Input"
export default Input

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.md,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing.xs,
  },
})
