import React, { useRef, useState, useCallback } from "react"
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native"
import { WebView, type WebViewMessageEvent } from "react-native-webview"
import { useNavigation } from "@react-navigation/native"
import { useAuth } from "@/hooks/useAuth"
import { useT } from "@/hooks/useLanguage"
import { getAuthToken, getDeviceHash } from "@/services/storage"
import { API_BASE_URL } from "@/constants/config"
import { colors, fontSize, spacing, radii } from "@/constants/theme"

/**
 * Voice Assistant — dedicated embedded WebView.
 *
 * Loads /app/voice (embedded route with no site chrome: no header,
 * no footer, no menu, no CTA). The WebView receives auth token and
 * device hash via injected JS so the user session is preserved.
 *
 * Query params:
 *   embedded=1  — signals the web layout to strip all chrome
 *   theme=light — force light theme
 *   hideChrome=1 — explicit flag for hiding header/footer
 *   mobile=1   — mark as mobile client
 *   lang=XX    — locale
 */
export default function VoiceAssistantScreen() {
  const { user } = useAuth()
  const { t, locale } = useT()
  const navigation = useNavigation()
  const webViewRef = useRef<WebView>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const uri = `${API_BASE_URL}/app/voice?embedded=1&theme=light&hideChrome=1&mobile=1&lang=${locale}`

  const getInjectedJS = useCallback(async () => {
    const token = await getAuthToken()
    const deviceHash = await getDeviceHash()
    return `
      (function() {
        try {
          document.cookie = 'ta_device_hash=${deviceHash || ""}; path=/; SameSite=Lax';
          window.__MOBILE_AUTH_TOKEN = '${token || ""}';
          window.__MOBILE_DEVICE_HASH = '${deviceHash || ""}';
          window.__MOBILE_LANG = '${locale}';
          window.__IS_MOBILE_WEBVIEW = true;

          var origFetch = window.fetch;
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
          console.warn('[VoiceAssistant] inject error:', e);
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

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data)
      if (msg.type === "close") {
        navigation.goBack()
      }
    } catch {}
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>{"\uD83C\uDF99\uFE0F"}</Text>
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
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        mediaCapturePermissionGrantType="grant"
        startInLoadingState={false}
        style={loading ? styles.hidden : styles.webview}
        overScrollMode="never"
        bounces={false}
        scrollEnabled={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#ffffff" },
  webview: { flex: 1 },
  hidden: { flex: 1, opacity: 0 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: spacing.xxl,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
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
