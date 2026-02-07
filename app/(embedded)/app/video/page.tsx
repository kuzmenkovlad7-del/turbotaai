"use client"

import VideoCallDialog from "@/components/video-call-dialog"

/**
 * Embedded video assistant page — /app/video
 *
 * Rendered inside mobile WebView with no site chrome.
 * The dialog is always open and onClose triggers a postMessage
 * so the native app can handle navigation back.
 */
export default function EmbeddedVideoPage() {
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
      <VideoCallDialog isOpen={true} onClose={handleClose} />
    </div>
  )
}
