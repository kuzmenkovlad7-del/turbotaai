"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import VideoCallDialog from "@/components/video-call-dialog"
import { useLanguage } from "@/lib/i18n/language-context"

/**
 * Embedded video assistant page — /app/video
 *
 * Rendered inside mobile WebView with no site chrome.
 * The dialog is always open and onClose triggers a postMessage
 * so the native app can handle navigation back.
 *
 * URL params (set by mobile launcher):
 *   ?character=dr-maria|dr-sophia|dr-alexander — pre-selects AI character via defaultCharacterId
 *   ?avatar=mia|alex|leo                        — avatar slug (informational; character ID is canonical)
 *   ?gender=female|male                         — gender hint (encoded in character definition)
 *   ?lang=uk|ru|en                              — overrides language context so mobile locale is respected
 */
export default function EmbeddedVideoPage() {
  const searchParams = useSearchParams()
  const characterId = searchParams.get("character") ?? undefined
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
      <VideoCallDialog
        isOpen={true}
        onClose={handleClose}
        defaultCharacterId={characterId}
      />
    </div>
  )
}
