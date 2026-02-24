"use client"

import { useSearchParams } from "next/navigation"
import VoiceCallDialog from "@/components/voice-call-dialog"

/**
 * Embedded voice assistant page — /app/voice
 *
 * Rendered inside mobile WebView with no site chrome.
 * The dialog is always open and onClose triggers a postMessage
 * so the native app can handle navigation back.
 *
 * URL params (set by mobile launcher):
 *   ?gender=female|male   — pre-selects voice gender
 *   ?autostart=1          — auto-starts the call without user tapping
 *   ?lang=uk|ru|en        — locale hint (dialog uses its own language context)
 */
export default function EmbeddedVoicePage() {
  const searchParams = useSearchParams()
  const gender = (searchParams.get("gender") as "female" | "male") ?? "female"
  const autoStart = searchParams.get("autostart") === "1"

  const handleClose = () => {
    try {
      if ((window as any).ReactNativeWebView) {
        ;(window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "close" }))
      }
    } catch {}
  }

  return (
    <div style={{ flex: 1, minHeight: "100vh" }}>
      <VoiceCallDialog
        isOpen={true}
        onClose={handleClose}
        defaultGender={gender}
        autoStart={autoStart}
      />
    </div>
  )
}
