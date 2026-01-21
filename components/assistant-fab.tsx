"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { X, RotateCcw, ChevronLeft, MessageCircle, Phone, Video, Sparkles } from "lucide-react"

type AiChatDialogProps = { open?: boolean; onOpenChange?: (v: boolean) => void }

type Lang = "uk" | "ru" | "en"
type Screen = "home" | "pick"

const AiChatDialog = dynamic<AiChatDialogProps>(
  () => import("@/components/ai-chat-dialog").then((m: any) => m.AiChatDialog ?? m.default),
  { ssr: false }
)

const VoiceCallDialog = dynamic<AiChatDialogProps>(
  () => import("@/components/voice-call-dialog").then((m: any) => m.VoiceCallDialog ?? m.default),
  { ssr: false }
)

const VideoCallDialog = dynamic<AiChatDialogProps>(
  () => import("@/components/video-call-dialog").then((m: any) => m.VideoCallDialog ?? m.default),
  { ssr: false }
)

export default function AssistantFab() {
  const router = useRouter()

  const [panelOpen, setPanelOpen] = useState(false)
  const [screen, setScreen] = useState<Screen>("home")
  const [showHint, setShowHint] = useState(true)
  const [lang, setLang] = useState<Lang>("uk")

  const [chatOpen, setChatOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)

  const copy = useMemo(() => {
    const c = {
      uk: {
        hintTitle: "3 режими асистента · чат · голос · відео",
        hintText: "Обирайте формат, у якому вам комфортніше говорити.",
        fab: "TurbotaAI",
        headerTitle: "TurbotaAI Agent",
        headerSub: "Your assistant",
        msg1: "Привіт! Я допоможу з навігацією по TurbotaAI та вибором формату.",
        msg2: "Оберіть, що вам потрібно:",
        actionPick: "Вибрати асистента",
        actionPricing: "Ціни та пробний період",
        actionSupport: "Контакти та підтримка",
        back: "Назад",
        pickTitle: "Виберіть формат",
        pickChat: "Чат",
        pickChatSub: "Текстовий діалог",
        pickVoice: "Голос",
        pickVoiceSub: "Поговорити зараз",
        pickVideo: "Відео",
        pickVideoSub: "Формат з аватаром",
      },
      ru: {
        hintTitle: "3 режима ассистента · чат · голос · видео",
        hintText: "Выбирайте формат, в котором вам комфортнее говорить.",
        fab: "TurbotaAI",
        headerTitle: "TurbotaAI Agent",
        headerSub: "Your assistant",
        msg1: "Привет! Я помогу с навигацией по TurbotaAI и выбором формата.",
        msg2: "Выберите, что вам нужно:",
        actionPick: "Выбрать ассистента",
        actionPricing: "Цены и пробный период",
        actionSupport: "Контакты и поддержка",
        back: "Назад",
        pickTitle: "Выберите формат",
        pickChat: "Чат",
        pickChatSub: "Текстовый диалог",
        pickVoice: "Голос",
        pickVoiceSub: "Поговорить сейчас",
        pickVideo: "Видео",
        pickVideoSub: "Формат с аватаром",
      },
      en: {
        hintTitle: "3 modes · chat · voice · video",
        hintText: "Choose the format that feels most comfortable.",
        fab: "TurbotaAI",
        headerTitle: "TurbotaAI Agent",
        headerSub: "Your assistant",
        msg1: "Hi! I can help you navigate TurbotaAI and choose a format.",
        msg2: "Choose what you need:",
        actionPick: "Choose assistant",
        actionPricing: "Pricing & trial",
        actionSupport: "Contacts & support",
        back: "Back",
        pickTitle: "Choose a mode",
        pickChat: "Chat",
        pickChatSub: "Text conversation",
        pickVoice: "Voice",
        pickVoiceSub: "Talk now",
        pickVideo: "Video",
        pickVideoSub: "Avatar format",
      },
    }
    return c[lang]
  }, [lang])

  useEffect(() => {
    const raw = (document.documentElement.lang || "uk").toLowerCase()
    const v = raw.startsWith("ru") ? "ru" : raw.startsWith("en") ? "en" : "uk"
    setLang(v)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 9000)
    return () => clearTimeout(t)
  }, [])

  const closeAll = () => {
    setPanelOpen(false)
    setScreen("home")
  }

  const openPick = () => {
    setShowHint(false)
    setScreen("pick")
    setPanelOpen(true)
  }

  const openChat = () => {
    closeAll()
    setChatOpen(true)
  }

  const openVoice = () => {
    closeAll()
    setVoiceOpen(true)
  }

  const openVideo = () => {
    closeAll()
    setVideoOpen(true)
  }

  const goPricing = () => {
    closeAll()
    router.push("/pricing")
  }

  const goContacts = () => {
    closeAll()
    router.push("/contacts")
  }

  const resetHome = () => {
    setScreen("home")
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={[
          "fixed inset-0 z-[9998] bg-black/30 backdrop-blur-[1px] transition-opacity duration-200",
          panelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={closeAll}
      />

      {/* Floating widget */}
      <div className="fixed bottom-5 right-5 z-[9999] flex items-end gap-3">
        {/* Hint bubble */}
        <div
          className={[
            "max-w-[340px] rounded-2xl bg-white/95 px-4 py-3 shadow-xl ring-1 ring-black/5 transition-all duration-200",
            showHint && !panelOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none",
          ].join(" ")}
        >
          <div className="text-sm font-semibold text-slate-900">{copy.hintTitle}</div>
          <div className="mt-1 text-xs text-slate-600">{copy.hintText}</div>
        </div>

        {/* FAB */}
        <button
          type="button"
          onClick={() => {
            setShowHint(false)
            setPanelOpen((v) => !v)
            setScreen("home")
          }}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-white shadow-2xl ring-1 ring-white/30 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold">{copy.fab}</span>
        </button>
      </div>

      {/* Panel */}
      <div
        className={[
          "fixed bottom-5 right-5 z-[9999] w-[420px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 transition-all duration-200",
          panelOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-[0.98] pointer-events-none",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">{copy.headerTitle}</div>
              <div className="text-xs text-white/80">{copy.headerSub}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-white/15"
              onClick={() => {
                setScreen("home")
              }}
              aria-label="reset"
              title="reset"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              className="rounded-lg p-2 hover:bg-white/15"
              onClick={closeAll}
              aria-label="close"
              title="close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-4">
          {screen === "home" && (
            <>
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-800">
                <div>{copy.msg1}</div>
                <div className="mt-2 font-medium">{copy.msg2}</div>
              </div>

              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={openPick}
                  className="flex w-full items-center justify-between rounded-xl bg-violet-50 px-4 py-3 text-left text-sm font-medium text-violet-700 ring-1 ring-violet-100 hover:bg-violet-100"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    {copy.actionPick}
                  </span>
                  <span className="text-violet-400">↗</span>
                </button>

                <button
                  type="button"
                  onClick={goPricing}
                  className="flex w-full items-center justify-between rounded-xl bg-violet-50 px-4 py-3 text-left text-sm font-medium text-violet-700 ring-1 ring-violet-100 hover:bg-violet-100"
                >
                  <span className="flex items-center gap-2">
                    💰 {copy.actionPricing}
                  </span>
                  <span className="text-violet-400">↗</span>
                </button>

                <button
                  type="button"
                  onClick={goContacts}
                  className="flex w-full items-center justify-between rounded-xl bg-violet-50 px-4 py-3 text-left text-sm font-medium text-violet-700 ring-1 ring-violet-100 hover:bg-violet-100"
                >
                  <span className="flex items-center gap-2">
                    📞 {copy.actionSupport}
                  </span>
                  <span className="text-violet-400">↗</span>
                </button>
              </div>
            </>
          )}

          {screen === "pick" && (
            <>
              <button
                type="button"
                onClick={resetHome}
                className="mb-3 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                <ChevronLeft className="h-4 w-4" />
                {copy.back}
              </button>

              <div className="text-sm font-semibold text-slate-900">{copy.pickTitle}</div>

              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={openChat}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span className="flex items-center gap-3">
                    <MessageCircle className="h-5 w-5 text-slate-900" />
                    <span>
                      <div className="font-medium">{copy.pickChat}</div>
                      <div className="text-xs text-slate-600">{copy.pickChatSub}</div>
                    </span>
                  </span>
                  <span className="text-slate-400">↗</span>
                </button>

                <button
                  type="button"
                  onClick={openVoice}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-slate-900" />
                    <span>
                      <div className="font-medium">{copy.pickVoice}</div>
                      <div className="text-xs text-slate-600">{copy.pickVoiceSub}</div>
                    </span>
                  </span>
                  <span className="text-slate-400">↗</span>
                </button>

                <button
                  type="button"
                  onClick={openVideo}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span className="flex items-center gap-3">
                    <Video className="h-5 w-5 text-slate-900" />
                    <span>
                      <div className="font-medium">{copy.pickVideo}</div>
                      <div className="text-xs text-slate-600">{copy.pickVideoSub}</div>
                    </span>
                  </span>
                  <span className="text-slate-400">↗</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer input mock like Voiceflow */}
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2 rounded-full bg-slate-50 px-4 py-3 text-sm text-slate-400 ring-1 ring-slate-100">
            <span className="flex-1">Message...</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-600">
              ↑
            </span>
          </div>
          <div className="mt-2 text-center text-xs text-slate-400">Powered by TurbotaAI Team</div>
        </div>
      </div>

      {/* Assistant dialogs */}
      <AiChatDialog open={chatOpen} onOpenChange={(v: boolean) => setChatOpen(v)} />
      <VoiceCallDialog open={voiceOpen} onOpenChange={(v: boolean) => setVoiceOpen(v)} />
      <VideoCallDialog open={videoOpen} onOpenChange={(v: boolean) => setVideoOpen(v)} />
    </>
  )
}
