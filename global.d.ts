interface Window {
  ReactNativeWebView?: {
    postMessage(message: string): void
  }
  __IS_MOBILE_WEBVIEW?: boolean
  __MOBILE_AUTH_TOKEN?: string
  __MOBILE_DEVICE_HASH?: string
  __MOBILE_LANG?: string
}
