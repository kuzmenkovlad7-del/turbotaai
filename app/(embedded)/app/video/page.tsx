"use client"

import { useSearchParams } from "next/navigation"
import VideoCallDialog from "@/components/video-call-dialog"

/**
 * Embedded video assistant page — /app/video
 *
 * Rendered inside mobile WebView with no site chrome.
 * The dialog is always open and onClose triggers a postMessage
 * so the native app can handle navigation back.
 *
 * URL params (set by mobile launcher):
 *   ?character=dr-maria|dr-sophia|dr-alexander — pre-selects AI character
 *   ?avatar=mia|alex|leo                        — avatar slug (informational)
 *   ?gender=female|male                         — gender hint
 *   ?lang=uk|ru|en                              — locale hint
 */
export default function EmbeddedVideoPage() {
  const searchParams = useSearchParams()
  const characterId = searchParams.get("character") ?? undefined

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
