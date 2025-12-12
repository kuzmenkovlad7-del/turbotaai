"use client"

import { useState, useRef, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Phone,
  Wifi,
  WifiOff,
  Brain,
  Mic,
  MicOff,
  Loader2,
  Sparkles,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { APP_NAME } from "@/lib/app-config"

interface VoiceCallDialogProps {
  isOpen: boolean
  onClose: () => void
  onError?: (error: Error) => void
  userEmail?: string
  webhookUrl?: string
}

type VoiceGender = "female" | "male"

type VoiceMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  gender?: VoiceGender
}

// основной вебхук TurbotaAI агента
const TURBOTA_AGENT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL || ""

// запасной бекенд-прокси
const FALLBACK_CHAT_API = "/api/chat"

// аккуратно вытаскиваем текст из любого формата ответа n8n
function extractAnswer(data: any): string {
  if (!data) return ""

  if (typeof data === "string") {
    return data.trim()
  }

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] ?? {}
    return (
      first.text ||
      first.response ||
      first.output ||
      first.message ||
      first.content ||
      first.result ||
      JSON.stringify(first)
    )
      ?.toString()
      .trim()
  }

  if (typeof data === "object") {
    return (
      data.text ||
      data.response ||
      data.output ||
      data.message ||
      data.content ||
      data.result ||
      JSON.stringify(data)
    )
      ?.toString()
      .trim()
  }

  return ""
}

export default function VoiceCallDialog({
  isOpen,
  onClose,
  onError,
  userEmail,
  webhookUrl,
}: VoiceCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected"
  >("disconnected")

  const voiceGenderRef = useRef<VoiceGender>("female")
  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  // состояние рекордера
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // флаги-рефы, чтобы не зависеть от стейта в асинхронных обработчиках
  const isCallActiveRef = useRef(false)
  const isAiSpeakingRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const isSttBusyRef = useRef(false)

  // если пока отправляем один чанк в STT, сюда складываем следующий
  const pendingChunkRef = useRef<Blob | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // автоскролл истории
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  function computeLangCode(): string {
    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    if (lang.startsWith("uk")) return "uk-UA"
    if (lang.startsWith("ru")) return "ru-RU"
    return "en-US"
  }

  function getCurrentGenderForTts(): "MALE" | "FEMALE" {
    const g = voiceGenderRef.current || "female"
    return g === "male" ? "MALE" : "FEMALE"
  }

  // --------- STT: отправка одного готового webm-чанка в /api/stt ---------

  async function maybeSendStt(chunk: Blob) {
    if (!isCallActiveRef.current) return
    if (!chunk || chunk.size < 2000) {
      // слишком маленький чанк — скорее всего шум
      return
    }

    // не слушаем во время TTS
    if (isAiSpeakingRef.current) {
      pendingChunkRef.current = chunk
      return
    }

    if (isSttBusyRef.current) {
      // если предыдущий запрос ещё идёт — перетираем pending на самый свежий
      pendingChunkRef.current = chunk
      return
    }

    isSttBusyRef.current = true

    try {
      const blobToSend = chunk

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": "audio/webm",
        },
        body: blobToSend,
      })

      const raw = await res.text()
      let data: any = null

      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok || !data || data.success === false) {
        console.error(
          "[STT] error response:",
          res.status,
          data || raw || "empty",
        )

        // если это именно ошибка формата файла — не надо сбрасывать звонок,
        // просто пропускаем этот чанк и ждём следующий
        return
      }

      const transcript = (data.text || "").toString().trim()
      if (!transcript) return

      const userMsg: VoiceMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text: transcript,
        gender: voiceGenderRef.current,
      }

      setMessages((prev) => [...prev, userMsg])
      await handleUserText(transcript)
    } catch (error) {
      console.error("[STT] fatal error", error)
    } finally {
      isSttBusyRef.current = false

      // если пока слушали, накопился ещё один чанк — отправляем его следом
      const pending = pendingChunkRef.current
      if (
        pending &&
        isCallActiveRef.current &&
        !isAiSpeakingRef.current
      ) {
        pendingChunkRef.current = null
        void maybeSendStt(pending)
      }
    }
  }

  // --------- TTS через /api/tts (Google / OpenAI TTS) ---------

  function speakText(text: string) {
    if (typeof window === "undefined") return

    const cleanText = text?.trim()
    if (!cleanText) return

    const langCode = computeLangCode()
    const gender = getCurrentGenderForTts()

    const beginSpeaking = () => {
      setIsAiSpeaking(true)
      isAiSpeakingRef.current = true

      const rec = mediaRecorderRef.current
      if (rec && rec.state === "recording") {
        try {
          rec.pause()
        } catch (e) {
          console.error("Recorder pause error", e)
        }
      }
    }

    const finishSpeaking = () => {
      setIsAiSpeaking(false)
      isAiSpeakingRef.current = false

      const rec = mediaRecorderRef.current
      if (rec && rec.state === "paused" && isCallActiveRef.current) {
        try {
          rec.resume()
        } catch (e) {
          console.error("Recorder resume error", e)
        }
      }

      // после озвучки можно сразу обработать pending-чанк, если он есть
      const pending = pendingChunkRef.current
      if (pending && isCallActiveRef.current) {
        pendingChunkRef.current = null
        void maybeSendStt(pending)
      }
    }

    ;(async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: cleanText,
            language: langCode,
            gender,
          }),
        })

        const raw = await res.text()
        let data: any = null

        try {
          data = raw ? JSON.parse(raw) : null
        } catch {
          data = null
        }

        if (!res.ok || !data || data.success === false || !data.audioContent) {
          console.error("[TTS] API error", res.status, data || raw)
          finishSpeaking()
          return
        }

        const audioUrl = `data:audio/mp3;base64,${data.audioContent}`

        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }

        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onplay = () => {
          beginSpeaking()
        }

        audio.onended = () => {
          finishSpeaking()
          audioRef.current = null
        }

        audio.onerror = (e) => {
          console.error("[TTS] audio playback error", e)
          finishSpeaking()
          audioRef.current = null
        }

        try {
          await audio.play()
        } catch (e) {
          console.error("[TTS] play() rejected", e)
          finishSpeaking()
        }
      } catch (error) {
        console.error("[TTS] fetch error:", error)
        finishSpeaking()
      }
    })()
  }

  // --------- отправка текста в n8n / OpenAI ---------

  async function handleUserText(text: string) {
    const langCode =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    const resolvedWebhook =
      (webhookUrl && webhookUrl.trim()) ||
      TURBOTA_AGENT_WEBHOOK_URL.trim() ||
      FALLBACK_CHAT_API

    try {
      const res = await fetch(resolvedWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          language: langCode,
          email: effectiveEmail,
          mode: "voice",
          gender: voiceGenderRef.current,
          voiceLanguage: computeLangCode(),
        }),
      })

      if (!res.ok) {
        throw new Error(`Chat API error: ${res.status}`)
      }

      const raw = await res.text()
      let data: any = raw

      try {
        data = JSON.parse(raw)
      } catch {
        // не JSON — значит строка
      }

      let answer = extractAnswer(data)

      if (!answer) {
        answer = t(
          "I'm sorry, I couldn't process your message. Please try again.",
        )
      }

      const assistantMsg: VoiceMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: answer,
        gender: voiceGenderRef.current,
      }

      setMessages((prev) => [...prev, assistantMsg])
      speakText(answer)
    } catch (error: any) {
      console.error("Voice call error:", error)
      setNetworkError(t("Connection error. Please try again."))
      if (onError && error instanceof Error) onError(error)
    }
  }

  // --------- управление звонком / микрофоном ---------

  const startCall = async (gender: VoiceGender) => {
    voiceGenderRef.current = gender

    setIsConnecting(true)
    setNetworkError(null)

    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setNetworkError(
          t(
            "Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari.",
          ),
        )
        setIsConnecting(false)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })

      mediaStreamRef.current = stream

      const options: MediaRecorderOptions = {}
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          options.mimeType = "audio/webm;codecs=opus"
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          options.mimeType = "audio/webm"
        }
      }

      const recorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = recorder
      isSttBusyRef.current = false
      pendingChunkRef.current = null

      recorder.onstart = () => {
        setIsListening(true)
      }

      recorder.ondataavailable = (event: BlobEvent) => {
        if (!isCallActiveRef.current) return
        if (!event.data || event.data.size === 0) return

        // во время озвучки собираем чанк в pending, чтобы не слушать ассистента
        if (isAiSpeakingRef.current) {
          pendingChunkRef.current = event.data
          return
        }

        void maybeSendStt(event.data)
      }

      recorder.onstop = () => {
        setIsListening(false)
      }

      recorder.onerror = (event: any) => {
        console.error("[Recorder] error", event)
      }

      recorder.start(4000) // чанк каждые 4 секунды

      isCallActiveRef.current = true
      setIsCallActive(true)
      setIsConnecting(false)
      setConnectionStatus("connected")
      isMicMutedRef.current = false
      setIsMicMuted(false)
    } catch (error: any) {
      console.error("[Recorder] getUserMedia error:", error)

      const name = error?.name

      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(
          t(
            "Microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page.",
          ),
        )
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setNetworkError(
          t("No microphone was found on this device. Please check your hardware."),
        )
      } else {
        setNetworkError(
          t(
            "Could not start microphone. Check permissions in the browser and system settings, then try again.",
          ),
        )
      }

      setIsConnecting(false)
      isCallActiveRef.current = false
      setIsCallActive(false)
      setConnectionStatus("disconnected")
    }
  }

  const endCall = () => {
    isCallActiveRef.current = false
    setIsCallActive(false)
    setIsListening(false)
    setIsMicMuted(false)
    isMicMutedRef.current = false
    setIsAiSpeaking(false)
    isAiSpeakingRef.current = false
    setConnectionStatus("disconnected")
    setNetworkError(null)
    isSttBusyRef.current = false
    pendingChunkRef.current = null

    const rec = mediaRecorderRef.current
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop()
      } catch (e) {
        console.error("Recorder stop error", e)
      }
    }
    mediaRecorderRef.current = null

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch (e) {
          console.error("Track stop error", e)
        }
      })
      mediaStreamRef.current = null
    }

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    if (typeof window !== "undefined" && (window as any).speechSynthesis) {
      ;(window as any).speechSynthesis.cancel()
    }
  }

  const toggleMic = () => {
    const next = !isMicMuted
    setIsMicMuted(next)
    isMicMutedRef.current = next

    const rec = mediaRecorderRef.current
    if (!rec) return

    if (next) {
      if (rec.state === "recording") {
        try {
          rec.pause()
        } catch (e) {
          console.error("Recorder pause error", e)
        }
      }
    } else {
      if (rec.state === "paused" && isCallActiveRef.current) {
        try {
          rec.resume()
        } catch (e) {
          console.error("Recorder resume error", e)
        }
      }
    }
  }

  useEffect(() => {
    if (!isOpen) {
      endCall()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    return () => {
      endCall()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusText = !isCallActive
    ? t(
        "In crisis situations, please contact local emergency services immediately.",
      )
    : isAiSpeaking
      ? t("Assistant is speaking...")
      : isMicMuted
        ? t("Paused. Turn on microphone to continue.")
        : isListening
          ? t("Listening… you can speak.")
          : t("Waiting... you can start speaking at any moment.")

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          endCall()
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-xl border-none bg-transparent p-0">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Phone className="h-4 w-4" />
                  </span>
                  {t("Voice session with AI-psychologist")}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {t(
                    "You can talk out loud, the assistant will listen, answer and voice the reply.",
                  )}
                </DialogDescription>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-indigo-50">
                  {APP_NAME} · {t("Assistant online")}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-indigo-100">
                  {connectionStatus === "connected" ? (
                    <>
                      <Wifi className="h-3 w-3 text-emerald-200" />{" "}
                      {t("Connected")}
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 text-rose-200" />{" "}
                      {t("Disconnected")}
                    </>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex h-[500px] flex-col md:h-[540px]">
            <ScrollArea className="flex-1 px-5 pt-4 pb-2">
              <div
                ref={scrollRef}
                className="max-h-full space-y-3 pr-1 text-xs md:text-sm"
              >
                {!isCallActive && messages.length === 0 && (
                  <div className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-slate-700">
                    <p className="mb-1 font-medium text-slate-900">
                      {t("How it works")}
                    </p>
                    <p className="mb-2">
                      {t(
                        "Choose a voice and start the session. The assistant will listen to you and answer like a real psychologist.",
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {t(
                        "You can switch between female and male voice by ending the call and starting again with a different option.",
                      )}
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                        msg.role === "user"
                          ? "rounded-br-sm bg-slate-900 text-white"
                          : "rounded-bl-sm bg-emerald-50 text-slate-900"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                          <Brain className="h-3 w-3" />
                          {t("AI Psychologist")}
                          <span className="ml-1 rounded-full bg-emerald-100 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                            {msg.gender === "female"
                              ? t("Female voice")
                              : t("Male voice")}
                          </span>
                        </div>
                      )}
                      <p className="text-xs md:text-sm">{msg.text}</p>
                    </div>
                  </div>
                ))}

                {networkError && (
                  <div className="rounded-2xl bg-rose-50 px-3 py-3 text-xs text-rose-700">
                    {networkError}
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Sparkles className="h-3 w-3" />
                  {statusText}
                </div>

                {isCallActive && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      onClick={toggleMic}
                      className={`h-8 w-8 rounded-full border ${
                        isMicMuted
                          ? "border-rose-200 bg-rose-50 text-rose-600"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {isMicMuted ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      onClick={endCall}
                      className="h-8 w-8 rounded-full bg-rose-600 text-white hover:bg-rose-700"
                    >
                      <Phone className="h-4 w-4 rotate-[135deg]" />
                    </Button>
                  </div>
                )}
              </div>

              {!isCallActive && (
                <div className="flex flex-col items-center gap-3 pt-1">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {t("Choose voice for this session")}
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      type="button"
                      onClick={() => {
                        void startCall("female")
                      }}
                      disabled={isConnecting}
                      className={`flex h-10 w-full max-w-[180px] items-center justify-center gap-2 rounded-full px-5 text-xs font-semibold shadow-sm ${
                        voiceGenderRef.current === "female"
                          ? "bg-pink-600 text-white hover:bg-pink-700"
                          : "bg-pink-50 text-pink-700 hover:bg-pink-100"
                      }`}
                    >
                      {isConnecting &&
                      voiceGenderRef.current === "female" ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t("Connecting")}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3" />
                          {t("Start with female voice")}
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      onClick={() => {
                        void startCall("male")
                      }}
                      disabled={isConnecting}
                      className={`flex h-10 w-full max-w-[180px] items-center justify-center gap-2 rounded-full px-5 text-xs font-semibold shadow-sm ${
                        voiceGenderRef.current === "male"
                          ? "bg-sky-600 text-white hover:bg-sky-700"
                          : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                      }`}
                    >
                      {isConnecting && voiceGenderRef.current === "male" ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t("Connecting")}
                        </>
                      ) : (
                        <>
                          <Brain className="h-3 w-3" />
                          {t("Start with male voice")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
