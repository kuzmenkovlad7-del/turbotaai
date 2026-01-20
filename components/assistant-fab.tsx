"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { MessageCircle, Mic, Video, X } from "lucide-react"

type Mode = "chat" | "voice" | "video"

// Поддерживаем и default export, и named export из модулей, чтобы ничего не ломалось
const AiChatDialog: any = dynamic(
  () => import("./ai-chat-dialog").then((m: any) => m.default ?? m.AiChatDialog),
  { ssr: false }
)

const VoiceCallDialog: any = dynamic(
  () => import("./voice-call-dialog").then((m: any) => m.default ?? m.VoiceCallDialog),
  { ssr: false }
)

const VideoCallDialog: any = dynamic(
  () => import("./video-call-dialog").then((m: any) => m.default ?? m.VideoCallDialog),
  { ssr: false }
)

function AssistantFab() {
  const [panelOpen, setPanelOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)

  const closeAll = () => {
    setChatOpen(false)
    setVoiceOpen(false)
    setVideoOpen(false)
  }

  const openMode = (mode: Mode) => {
    setPanelOpen(false)
    closeAll()

    if (mode === "chat") setChatOpen(true)
    if (mode === "voice") setVoiceOpen(true)
    if (mode === "video") setVideoOpen(true)

    // якоря, чтобы можно было открывать по ссылке
    try {
      window.location.hash = mode
    } catch {}
  }

  useEffect(() => {
    const applyHash = () => {
      const h = (window.location.hash || "").replace("#", "").toLowerCase()
      if (h === "chat" || h === "voice" || h === "video") {
        openMode(h as Mode)
      }
    }

    applyHash()
    window.addEventListener("hashchange", applyHash)
    return () => window.removeEventListener("hashchange", applyHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {/* Внутренние диалоги ассистентов */}
      <AiChatDialog open={chatOpen} onOpenChange={(v: boolean) => setChatOpen(v)} />
      <VoiceCallDialog open={voiceOpen} onOpenChange={(v: boolean) => setVoiceOpen(v)} />
      <VideoCallDialog open={videoOpen} onOpenChange={(v: boolean) => setVideoOpen(v)} />

      {panelOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/20"
          onClick={() => setPanelOpen(false)}
        />
      )}

      <div className="fixed bottom-5 right-5 z-50">
        {panelOpen && (
          <div className="mb-3 w-[320px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/favicon.svg" alt="TurbotaAI" className="h-5 w-5" />
                <div className="text-sm font-semibold text-slate-900">TurbotaAI</div>
              </div>

              <button
                type="button"
                aria-label="Close"
                onClick={() => setPanelOpen(false)}
                className="rounded-xl p-2 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={() => openMode("chat")}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-5 w-5" />
                  <div>
                    <div className="font-medium">Чат</div>
                    <div className="text-xs text-slate-600">Напишіть, що відбувається</div>
                  </div>
                </div>
                <span className="text-slate-400">↗</span>
              </button>

              <button
                type="button"
                onClick={() => openMode("voice")}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <Mic className="h-5 w-5" />
                  <div>
                    <div className="font-medium">Голос</div>
                    <div className="text-xs text-slate-600">Коли хочеться поговорити</div>
                  </div>
                </div>
                <span className="text-slate-400">↗</span>
              </button>

              <button
                type="button"
                onClick={() => openMode("video")}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5" />
                  <div>
                    <div className="font-medium">Відео</div>
                    <div className="text-xs text-slate-600">Формат з аватаром</div>
                  </div>
                </div>
                <span className="text-slate-400">↗</span>
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-white shadow-xl hover:opacity-95"
        >
          <span className="text-sm font-semibold">Поговорити зараз</span>
        </button>
      </div>
    </>
  )
}

export default AssistantFab
export { AssistantFab }
