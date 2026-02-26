"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import VoiceCallDialog from "@/components/voice-call-dialog"
import { useLanguage } from "@/lib/i18n/language-context"

/**
 * Embedded voice assistant page — /app/voice
 *
 * Rendered inside mobile WebView with no site chrome.
 * The dialog is always open and onClose triggers a postMessage
 * so the native app can handle navigation back.
 *
 * URL params (set by mobile launcher):
 *   ?gender=female|male   — pre-selects voice gender, passed to VoiceCallDialog
 *   ?autostart=1          — auto-starts the call without user tapping
 *   ?lang=uk|ru|en        — overrides language context so mobile locale is respected
 */
export default function EmbeddedVoicePage() {
  const searchParams = useSearchParams()
  const gender = (searchParams.get("gender") as "female" | "male") ?? "female"
  const autoStart = searchParams.get("autostart") === "1"
  const lang = searchParams.get("lang")

  const { changeLanguage } = useLanguage()

  // Apply mobile locale on mount so the dialog speaks the same language as the app.
  // Only fires when ?lang= is present; otherwise the stored preference is kept.
  useEffect(() => {
    if (lang) changeLanguage(lang)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
