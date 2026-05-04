import React from "react"
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native"
import { useT } from "@/hooks/useLanguage"
import { colors, fontSize, spacing, radii } from "@/constants/theme"

type Props = {
  /** Show the modal. Pass true when consentGiven === false and loading is done. */
  visible: boolean
  /** Called when the user taps "I Agree". Caller must persist consent. */
  onAccept: () => void
  /** Called when the user taps "Not Now" — dismisses without storing consent. */
  onLater: () => void
}

/**
 * Full-screen modal explaining that AI responses are powered by OpenAI and
 * asking for explicit consent before any data is sent.
 *
 * Apple guideline 5.1.1(i) / 5.1.2(i): must clearly identify the AI provider,
 * what data is sent, and obtain permission before sharing personal data.
 */
export default function AiConsentModal({ visible, onAccept, onLater }: Props) {
  const { t } = useT()

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onLater}
    >
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Icon */}
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>{"🔒"}</Text>
          </View>

          {/* Heading */}
          <Text style={styles.title}>{t.aiConsentTitle}</Text>
          <Text style={styles.subtitle}>{t.aiConsentSubtitle}</Text>

          {/* Body text */}
          <Text style={styles.body}>{t.aiConsentBody}</Text>

          {/* Bullet points */}
          <View style={styles.pointsBox}>
            {[
              t.aiConsentPoint1,
              t.aiConsentPoint2,
              t.aiConsentPoint3,
              t.aiConsentPoint4,
            ].map((point, i) => (
              <View key={i} style={styles.pointRow}>
                <Text style={styles.bullet}>{"•"}</Text>
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={onAccept}
            activeOpacity={0.8}
          >
            <Text style={styles.acceptText}>{t.aiConsentAccept}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.laterBtn}
            onPress={onLater}
            activeOpacity={0.7}
          >
            <Text style={styles.laterText}>{t.aiConsentLater}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
    alignItems: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  iconText: { fontSize: 32 },
  title: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  body: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
    textAlign: "left",
    alignSelf: "stretch",
    marginBottom: spacing.lg,
  },
  pointsBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bullet: {
    fontSize: fontSize.md,
    color: colors.primary,
    marginRight: spacing.sm,
    lineHeight: 22,
  },
  pointText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 22,
  },
  actions: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  acceptBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  acceptText: {
    color: "#fff",
    fontSize: fontSize.md,
    fontWeight: "700",
  },
  laterBtn: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  laterText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
})
