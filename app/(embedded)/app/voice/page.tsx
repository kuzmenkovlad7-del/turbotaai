"use client"

import VoiceCallDialog from "@/components/voice-call-dialog"

/**
 * Embedded voice assistant page — /app/voice
 *
 * Rendered inside mobile WebView with no site chrome.
 * The dialog is always open and onClose triggers a postMessage
 * so the native app can handle navigation back.
 */
export default function EmbeddedVoicePage() {
  const handleClose = () => {
    // Signal the native WebView to go back
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "close" }))
      }
    } catch {}
  }

  return (
    <div style={{ flex: 1, minHeight: "100vh" }}>
      <VoiceCallDialog isOpen={true} onClose={handleClose} />
    </div>
  )
}
