"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { MessageCircle, Phone, Video, Sparkles, ChevronDown, X } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context";

type Lang = "uk" | "ru" | "en"
type ControlledDialogProps = { open?: boolean; onOpenChange?: (v: boolean) => void }

const AiChatDialog = dynamic<ControlledDialogProps>(
  () => import("@/components/ai-chat-dialog").then((m: any) => m.AiChatDialog ?? m.default),
  { ssr: false }
)

const VoiceCallDialog = dynamic<ControlledDialogProps>(
  () => import("@/components/voice-call-dialog").then((m: any) => m.VoiceCallDialog ?? m.default),
  { ssr: false }
)

const VideoCallDialog = dynamic<ControlledDialogProps>(
  () => import("@/components/video-call-dialog").then((m: any) => m.VideoCallDialog ?? m.default),
  { ssr: false }
)

export default function AssistantFab() {
  const { t } = useLanguage()
  const [lang, setLang] = useState<Lang>("uk")

  const [panelOpen, setPanelOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)

  useEffect(() => {
    const raw = (document.documentElement.lang || "uk").toLowerCase()
    const v: Lang = raw.startsWith("ru") ? "ru" : raw.startsWith("en") ? "en" : "uk"
    setLang(v)
  }, [])

  const copy = useMemo(() => {
    const c = {
      uk: {
        fab: "Поговорити зараз",
        title: "Як тобі зараз зручніше почати розмову?",
        chat: "Чат",
        voice: "Голос",
        video: "Відео",
        chatSub: "Текстова розмова",
        voiceSub: "Поговорити зараз",
        videoSub: "Формат з аватаром",
      },
      ru: {
        fab: "Поговорить сейчас",
        title: "Как тебе сейчас удобнее начать разговор?",
        chat: "Чат",
        voice: "Голос",
        video: "Видео",
        chatSub: "Текстовый диалог",
        voiceSub: "Поговорить сейчас",
        videoSub: "Формат с аватаром",
      },
      en: {
        fab: "Talk now",
        title: "How would you like to start?",
        chat: "Chat",
        voice: "Voice",
        video: "Video",
        chatSub: "Text conversation",
        voiceSub: "Talk now",
        videoSub: "Avatar format",
      },
    }
    return c[lang]
  }, [lang])

  const openChat = () => {
    setPanelOpen(false)
    setChatOpen(true)
  }
  const openVoice = () => {
    setPanelOpen(false)
    setVoiceOpen(true)
  }
  const openVideo = () => {
    setPanelOpen(false)
    setVideoOpen(true)
  }

  return (
    <>
      {/* Panel (почти весь экран, оставляем место снизу для кнопки-стрелки) */}
      {panelOpen && (
        <div className="fixed inset-0 z-[1] pointer-events-none">
          <div className="absolute inset-0 bg-black/20 pointer-events-auto" onClick={() => setPanelOpen(false)} />

          <div className="absolute right-4 top-4 bottom-[76px] w-[380px] max-w-[calc(100vw-32px)] rounded-2xl bg-white shadow-2xl border border-black/5 pointer-events-auto overflow-hidden">
            <div className="h-14 px-4 flex items-center justify-between bg-gradient-to-r from-violet-500 to-indigo-500 text-white">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-semibold">TurbotaAI</div>
                  <div className="text-[12px] opacity-90">{copy.title}</div>
                </div>
              </div>

              <button
                onClick={() => setPanelOpen(false)}
                className="h-9 w-9 rounded-xl hover:bg-white/15 inline-flex items-center justify-center"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 h-[calc(100%-56px)] flex flex-col gap-3">
              <button
                onClick={openChat}
                className="w-full rounded-2xl border border-black/10 bg-white hover:bg-black/[0.02] p-4 text-left flex items-center gap-3"
              >
                <span className="h-11 w-11 rounded-2xl bg-violet-50 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-violet-600" />
                </span>
                <div>
                  <div className="font-semibold">{copy.chat}</div>
                  <div className="text-sm text-black/60">{copy.chatSub}</div>
                </div>
              </button>

              <button
                onClick={openVoice}
                className="w-full rounded-2xl border border-black/10 bg-white hover:bg-black/[0.02] p-4 text-left flex items-center gap-3"
              >
                <span className="h-11 w-11 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-indigo-600" />
                </span>
                <div>
                  <div className="font-semibold">{copy.voice}</div>
                  <div className="text-sm text-black/60">{copy.voiceSub}</div>
                </div>
              </button>

              <button
                onClick={openVideo}
                className="w-full rounded-2xl border border-black/10 bg-white hover:bg-black/[0.02] p-4 text-left flex items-center gap-3"
              >
                <span className="h-11 w-11 rounded-2xl bg-sky-50 flex items-center justify-center">
                  <Video className="h-5 w-5 text-sky-600" />
                </span>
                <div>
                  <div className="font-semibold">{copy.video}</div>
                  <div className="text-sm text-black/60">{copy.videoSub}</div>
                </div>
              </button>

              <div className="mt-auto text-center text-xs text-black/35">{t("Created by TurbotaAI Team")}</div>
            </div>
          </div>
        </div>
      )}

      {/* FAB / Collapse button */}
      <div className="fixed bottom-4 right-4 z-[1]">
        {!panelOpen ? (
          <button
            onClick={() => setPanelOpen(true)}
            className="h-14 px-5 rounded-full shadow-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white flex items-center gap-3 hover:opacity-95"
          >
            <span className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="font-semibold">{copy.fab}</span>
          </button>
        ) : (
          <button
            onClick={() => setPanelOpen(false)}
            className="h-14 w-14 rounded-full shadow-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white flex items-center justify-center hover:opacity-95"
            aria-label="Collapse"
          >
            <ChevronDown className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Dialogs */}
      <AiChatDialog open={chatOpen} onOpenChange={setChatOpen} />
      <VoiceCallDialog open={voiceOpen} onOpenChange={setVoiceOpen} />
      <VideoCallDialog open={videoOpen} onOpenChange={setVideoOpen} />
    </>
  )
}
