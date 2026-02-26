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
import { API_BASE_URL } from "@/constants/config"
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
  const [pageLoading, setPageLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // null = device-hash fetch still in-flight → show spinner and DO NOT render WebView yet.
  // string (even "") = fetch complete → render WebView with the cookie already set.
  //
  // This eliminates the race where `injectedJavaScriptBeforeContentLoaded` was `undefined`
  // on first render (hash not ready), causing the web app to receive no ta_device_hash
  // cookie and treat the device as unknown — which can trigger a redirect to login and
  // ultimately open an external browser window.
  const [cookieScript, setCookieScript] = useState<string | null>(null)

  React.useEffect(() => {
    getDeviceHash()
      .then((hash) => {
        setCookieScript(
          hash
            ? `document.cookie = 'ta_device_hash=${hash}; path=/; SameSite=Lax'; true;`
            : "",
        )
      })
      .catch(() => {
        // Render without cookie on error rather than blocking indefinitely
        setCookieScript("")
      })
  }, [])

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data)
        if (msg?.type === "close") navigation.goBack()
      } catch {
        // ignore non-JSON messages
      }
    },
    [navigation],
  )

  const handleLoadEnd = useCallback(() => setPageLoading(false), [])
  const handleLoadStart = useCallback(() => {
    setPageLoading(true)
    setLoadError(false)
  }, [])
  const handleError = useCallback(() => {
    setPageLoading(false)
    setLoadError(true)
  }, [])
  const handleRetry = useCallback(() => {
    setLoadError(false)
    setPageLoading(true)
    webViewRef.current?.reload()
  }, [])

  // Prevent the WebView from opening external HTTP(S) URLs in the system browser.
  //
  // Key Android bug: returning `true` for `intent://` or other non-HTTP schemes tells
  // the Android WebView to "follow" the URL. Since it can't load non-HTTP schemes, it
  // fires an Android Intent which Chrome (the default browser) picks up and opens.
  // Fix: only return `true` for the small set of safe non-navigational schemes
  // (about:, blob:, data:, javascript:) that WebRTC/inline-media genuinely need;
  // everything else that is not http(s) on our own host gets blocked (return false).
  //
  // Sub-frame loads (iframes, analytics pixels, etc.) are always allowed so we don't
  // accidentally break page content — only top-frame navigations are guarded.
  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string; isTopFrame: boolean }): boolean => {
      const { url, isTopFrame } = request

      // Only guard top-frame navigations; sub-frames (iframes, etc.) are always allowed.
      if (!isTopFrame) return true

      // Safe non-navigational schemes used by WebRTC, inline media, and bridge scripts.
      if (
        url.startsWith("about:") ||
        url.startsWith("blob:") ||
        url.startsWith("data:") ||
        url.startsWith("javascript:")
      ) {
        return true
      }

      // ALL other non-HTTP schemes — including intent://, market://, tel:, mailto:, etc.
      // — must be blocked. On Android, returning `true` for intent:// fires a system
      // Intent which causes Chrome to open. Returning `false` cancels silently.
      if (!url.startsWith("http://") && !url.startsWith("https://")) return false

      // Unconfigured env: allow all http(s) to avoid breaking dev builds.
      if (!API_BASE_URL) return true

      // Only allow navigation within our own domain.
      return url.startsWith(API_BASE_URL)
    },
    [],
  )

  // Android-only: grant camera/mic permissions when the embedded page requests them.
  // Typed as `any` because the prop exists at runtime but is absent from the shared
  // TypeScript types for this version of react-native-webview.
  const androidPermissionProps: Record<string, any> =
    Platform.OS === "android"
      ? { onPermissionRequest: (request: any) => request.grant(request.resources) }
      : {}

  // Show a spinner while we wait for the device hash so the WebView is only mounted
  // once the cookie script is ready. This guarantees the hash cookie is set on the
  // very first page load rather than arriving after content is already visible.
  if (cookieScript === null) {
    return (
      <View style={[styles.root, styles.centered, { paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {!loadError && (
        <WebView
          ref={webViewRef}
          source={{ uri }}
          style={styles.webView}
          // Cookie is guaranteed set before first render — no race condition
          injectedJavaScriptBeforeContentLoaded={cookieScript || undefined}
          // Events
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          onMessage={handleMessage}
          // Block external navigation so the system browser never opens
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          // iOS: auto-grant camera/mic for pages on the same host
          mediaCapturePermissionGrantType="grantIfSameHostElseDeny"
          // Media settings
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          // Prevent window.open() from spawning a new browser window
          setSupportMultipleWindows={false}
          // Android camera/mic permission grant (spread to bypass TS type limitation)
          {...androidPermissionProps}
        />
      )}

      {/* Loading overlay */}
      {pageLoading && !loadError && (
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
  centered: { alignItems: "center", justifyContent: "center" },
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
