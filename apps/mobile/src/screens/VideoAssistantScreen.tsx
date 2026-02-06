import React, { useRef, useState, useCallback } from "react"
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native"
import { WebView, type WebViewNavigation } from "react-native-webview"
import { useAuth } from "@/hooks/useAuth"
import { useT } from "@/hooks/useLanguage"
import { getAuthToken, getDeviceHash } from "@/services/storage"
import { API_BASE_URL } from "@/constants/config"
import { colors, fontSize, spacing, radii } from "@/constants/theme"

/**
 * Video Assistant screen.
 *
 * Opens the web video-call dialog inside an authenticated WebView.
 * The WebView receives the auth token and device hash via injected JS
 * so the user session is preserved — no re-login needed.
 *
 * This approach provides full web feature parity (avatar selection,
 * STT/TTS, animated video avatars) while keeping the native navigation.
 */
export default function VideoAssistantScreen() {
  const { user } = useAuth()
  const { t, locale } = useT()
  const webViewRef = useRef<WebView>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const uri = `${API_BASE_URL}/?mode=video&lang=${locale}&mobile=1`

  const getInjectedJS = useCallback(async () => {
    const token = await getAuthToken()
    const deviceHash = await getDeviceHash()
    return `
      (function() {
        try {
          // Set auth cookie for API requests from the WebView
          document.cookie = 'ta_device_hash=${deviceHash || ""}; path=/; SameSite=Lax';
          // Store token for fetch interceptor
          window.__MOBILE_AUTH_TOKEN = '${token || ""}';
          window.__MOBILE_DEVICE_HASH = '${deviceHash || ""}';
          window.__MOBILE_LANG = '${locale}';
          window.__IS_MOBILE_WEBVIEW = true;

          // Patch fetch to include auth headers
          const origFetch = window.fetch;
          window.fetch = function(input, init) {
            init = init || {};
            init.headers = init.headers || {};
            if (typeof init.headers.set === 'function') {
              if (window.__MOBILE_AUTH_TOKEN) init.headers.set('Authorization', 'Bearer ' + window.__MOBILE_AUTH_TOKEN);
              if (window.__MOBILE_DEVICE_HASH) init.headers.set('X-Device-Hash', window.__MOBILE_DEVICE_HASH);
              init.headers.set('X-Client', 'mobile-webview');
            } else {
              if (window.__MOBILE_AUTH_TOKEN) init.headers['Authorization'] = 'Bearer ' + window.__MOBILE_AUTH_TOKEN;
              if (window.__MOBILE_DEVICE_HASH) init.headers['X-Device-Hash'] = window.__MOBILE_DEVICE_HASH;
              init.headers['X-Client'] = 'mobile-webview';
            }
            return origFetch.call(this, input, init);
          };
        } catch(e) {
          console.warn('[VideoAssistant] inject error:', e);
        }
      })();
      true;
    `
  }, [locale])

  const [injectedJS, setInjectedJS] = useState<string | null>(null)

  React.useEffect(() => {
    getInjectedJS().then(setInjectedJS)
  }, [getInjectedJS])

  const handleError = () => {
    setError(true)
    setLoading(false)
  }

  const handleLoad = () => {
    setLoading(false)
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>{"\uD83C\uDFA5"}</Text>
        <Text style={styles.errorText}>{t.assistantError}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => { setError(false); setLoading(true); webViewRef.current?.reload() }}
          activeOpacity={0.7}
        >
          <Text style={styles.retryText}>{t.retry}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!injectedJS) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t.assistantLoading}</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t.assistantLoading}</Text>
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ uri }}
        injectedJavaScript={injectedJS}
        onLoad={handleLoad}
        onError={handleError}
        onHttpError={handleError}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        mediaCapturePermissionGrantType="grant"
        startInLoadingState={false}
        style={loading ? styles.hidden : styles.webview}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  webview: { flex: 1 },
  hidden: { flex: 1, opacity: 0 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: spacing.xxl,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    zIndex: 10,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  errorIcon: { fontSize: 48, marginBottom: spacing.lg },
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
  retryText: { color: "#fff", fontSize: fontSize.md, fontWeight: "600" },
})
