import React, { useCallback, useRef, useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { WebView, type WebViewMessageEvent } from "react-native-webview"
import { getDeviceHash } from "@/services/storage"
import { colors, fontSize, spacing, radii } from "@/constants/theme"
import { useT } from "@/hooks/useLanguage"

export type WebViewScreenParams = {
  uri: string
  title?: string
}

export default function WebViewScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const insets = useSafeAreaInsets()
  const { t } = useT()
  const { uri } = route.params as WebViewScreenParams

  const webViewRef = useRef<WebView>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // Inject ta_device_hash cookie so the web session is tied to the same device
  // as the native app — ensures trial/promo/paid access is correctly applied.
  const [cookieScript, setCookieScript] = useState<string>("")
  React.useEffect(() => {
    getDeviceHash()
      .then((hash) => {
        if (hash) {
          setCookieScript(
            `document.cookie = 'ta_device_hash=${hash}; path=/; SameSite=Lax'; true;`,
          )
        }
      })
      .catch(() => {})
  }, [])

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data)
        if (msg?.type === "close") {
          navigation.goBack()
        }
      } catch {
        // ignore non-JSON messages
      }
    },
    [navigation],
  )

  const handleLoadEnd = useCallback(() => setLoading(false), [])
  const handleLoadStart = useCallback(() => {
    setLoading(true)
    setLoadError(false)
  }, [])
  const handleError = useCallback(() => {
    setLoading(false)
    setLoadError(true)
  }, [])

  const handleRetry = useCallback(() => {
    setLoadError(false)
    setLoading(true)
    webViewRef.current?.reload()
  }, [])

  // Android-only: grant camera/mic permissions when the embedded page requests them.
  // Typed as `any` because the prop exists at runtime but is absent from the shared
  // TypeScript types for this version of react-native-webview.
  const androidPermissionProps: Record<string, any> = Platform.OS === "android"
    ? { onPermissionRequest: (request: any) => request.grant(request.resources) }
    : {}

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {!loadError && (
        <WebView
          ref={webViewRef}
          source={{ uri }}
          style={styles.webView}
          // Cookie injection so device hash is recognised by backend
          injectedJavaScriptBeforeContentLoaded={cookieScript || undefined}
          // Events
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          onMessage={handleMessage}
          // iOS: auto-grant camera/mic for pages on the same host
          mediaCapturePermissionGrantType="grantIfSameHostElseDeny"
          // Media settings
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          // Prevent external navigation from hijacking the screen
          setSupportMultipleWindows={false}
          // Android camera/mic permission grant (spread to bypass TS type limitation)
          {...androidPermissionProps}
        />
      )}

      {/* Loading overlay */}
      {loading && !loadError && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Error state */}
      {loadError && (
        <View style={styles.errorWrap}>
          <Text style={styles.errorIcon}>{"\u26A0\uFE0F"}</Text>
          <Text style={styles.errorText}>{t.webViewLoadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.8}>
            <Text style={styles.retryText}>{t.retry}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.backText}>{t.close}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  webView: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  errorWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxxl,
    gap: spacing.md,
  },
  errorIcon: { fontSize: 40, marginBottom: spacing.sm },
  errorText: {
    fontSize: fontSize.md,
    color: colors.error,
    textAlign: "center",
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.md,
  },
  retryText: { color: "#fff", fontSize: fontSize.md, fontWeight: "600" },
  backBtn: { marginTop: spacing.xs },
  backText: { color: colors.textMuted, fontSize: fontSize.sm },
})
