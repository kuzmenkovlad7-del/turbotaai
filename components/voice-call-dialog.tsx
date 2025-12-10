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

type VoiceMessage = {
  id: string
  role: "user" | "assistant"
  text: string
}

// PRIMARY: фронт → TurbotaAI агент вебхук из env
const TURBOTA_AGENT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL || ""

// запасной бэкенд-проксирующий роут
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

  // реальный пол сессии, который всегда летит в /api/tts
  const voiceGenderRef = useRef<"female" | "male">("female")

  const recognitionRef = useRef<any | null>(null)
  const isRecognitionActiveRef = useRef(false)

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const isAiSpeakingRef = useRef(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)

  // audio-плеер для TTS
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // media stream для явного запроса доступа к микрофону (особенно на мобилках)
  const micStreamRef = useRef<MediaStream | null>(null)

  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  // Скролл вниз при новых сообщениях
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

  function getCurrentGender(): "MALE" | "FEMALE" {
    const g = voiceGenderRef.current || "female"
    return g === "male" ? "MALE" : "FEMALE"
  }

  // ----- запрашиваем доступ к микрофону (особенно критично на мобильных) -----
  async function requestMicrophoneAccess(): Promise<boolean> {
    if (typeof navigator === "undefined") {
      setNetworkError(
        t(
          "Microphone access is not available in this environment. Please open the assistant in a regular browser window.",
        ),
      )
      return false
    }

    const hasMediaDevices =
      typeof navigator.mediaDevices !== "undefined" &&
      typeof navigator.mediaDevices.getUserMedia === "function"

    if (!hasMediaDevices) {
      setNetworkError(
        t(
          "Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari.",
        ),
      )
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })

      // если всё ок — сохраняем стрим и не трогаем треки до завершения звонка
      micStreamRef.current = stream
      setNetworkError(null)
      return true
    } catch (error: any) {
      console.error("[Voice] getUserMedia error:", error)

      const name = error?.name

      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(
          t(
            "Microphone is blocked in the browser. Please allow access in the site permissions and reload the page.",
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

      return false
    }
  }

  // ---------- управление SpeechRecognition (единая точка) ----------

  function ensureRecognitionRunning() {
    if (typeof window === "undefined") return

    const shouldListen =
      isCallActiveRef.current &&
      !isMicMutedRef.current &&
      !isAiSpeakingRef.current

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    // если слушать НЕ нужно — стопаем, если запущено
    if (!shouldListen) {
      if (recognitionRef.current && isRecognitionActiveRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          console.error(e)
        }
      }
      isRecognitionActiveRef.current = false
      setIsListening(false)
      return
    }

    if (!SR) {
      setNetworkError(
        t(
          "Your browser does not support voice recognition. Please use Chrome or another modern browser.",
        ),
      )
      return
    }

    let recognition = recognitionRef.current

    if (!recognition) {
      recognition = new SR()
      recognition.continuous = true
      recognition.interimResults = false
      recognitionRef.current = recognition

      recognition.onstart = () => {
        isRecognitionActiveRef.current = true
        setIsListening(true)
        setConnectionStatus("connected")
        setNetworkError(null)
      }

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event)

        // 1) реальный бан микрофона для сайта
        if (event?.error === "not-allowed") {
          setNetworkError(
            t(
              "Microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page.",
            ),
          )
          setConnectionStatus("disconnected")
          return
        }

        // 2) сервис распознавания речи отключён на устройстве/в браузере
        if (event?.error === "service-not-allowed") {
          setNetworkError(
            t(
              "Speech recognition is disabled or not available on this device. Please enable speech recognition in the system settings or use another browser.",
            ),
          )
          setConnectionStatus("disconnected")
          return
        }

        // остальные ошибки (кроме no-speech) — мягко показываем, можно пере-стартануть
        if (event?.error !== "no-speech") {
          setNetworkError(t("Error while listening. Please try again."))
        }
      }

      recognition.onend = () => {
        isRecognitionActiveRef.current = false
        setIsListening(false)

        // если всё ещё нужно слушать (звонок идёт, мик не мут и ассистент не говорит) — перезапускаем
        setTimeout(() => {
          const stillShouldListen =
            isCallActiveRef.current &&
            !isMicMutedRef.current &&
            !isAiSpeakingRef.current

          if (stillShouldListen) {
            ensureRecognitionRunning()
          }
        }, 300)
      }

      recognition.onresult = (event: any) => {
        // если ассистент говорит — игнорируем, чтобы не слушать свою озвучку
        if (isAiSpeakingRef.current) return

        const last = event.results[event.results.length - 1]
        if (!last || !last.isFinal) return

        const text = last[0]?.transcript?.trim()
        if (!text) return

        const userMsg: VoiceMessage = {
          id: `${Date.now()}-user`,
          role: "user",
          text,
        }

        setMessages((prev) => [...prev, userMsg])
        void handleUserText(text)
      }
    }

    recognition.lang = computeLangCode()

    if (!isRecognitionActiveRef.current) {
      try {
        recognition.start()
        // onstart сам выставит флаги
      } catch (e: any) {
        if (e?.name === "NotAllowedError") {
          setNetworkError(
            t(
              "Microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page.",
            ),
          )
          setConnectionStatus("disconnected")
        } else if (e?.name !== "InvalidStateError") {
          console.error("Cannot start recognition", e)
          setNetworkError(
            t("Could not start microphone. Check permissions and try again."),
          )
        }
      }
    }
  }

  function hardStopRecognition() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null
        recognitionRef.current.stop()
      } catch (e) {
        console.error(e)
      }
    }
    isRecognitionActiveRef.current = false
    setIsListening(false)
  }

  function stopEverything() {
    isCallActiveRef.current = false
    isMicMutedRef.current = false
    isAiSpeakingRef.current = false

    setIsCallActive(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setIsListening(false)
    setConnectionStatus("disconnected")
    setNetworkError(null)
    setMessages([])

    hardStopRecognition()

    if (typeof window !== "undefined" && (window as any).speechSynthesis) {
      ;(window as any).speechSynthesis.cancel()
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    // останавливаем и освобождаем медиа-треки микрофона
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch (e) {
          console.error("Error stopping mic track", e)
        }
      })
      micStreamRef.current = null
    }
  }

  useEffect(() => {
    if (!isOpen) {
      stopEverything()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    return () => {
      stopEverything()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- озвучка ответа (ТОЛЬКО OpenAI TTS через /api/tts) ----------
  function speakText(text: string) {
    if (typeof window === "undefined") return

    const cleanText = text?.trim()
    if (!cleanText) return

    const langCode = computeLangCode() // "uk-UA" | "ru-RU" | "en-US"
    const gender = getCurrentGender() // "MALE" | "FEMALE"

    console.log("[TTS] speakText()", {
      langCode,
      gender,
      textSample: cleanText.slice(0, 80),
    })

    const startSpeaking = () => {
      setIsAiSpeaking(true)
      isAiSpeakingRef.current = true
      // во время озвучки микрофон должен быть выключен
      ensureRecognitionRunning()
    }

    const stopSpeaking = () => {
      setIsAiSpeaking(false)
      isAiSpeakingRef.current = false
      // после озвучки — снова слушаем
      ensureRecognitionRunning()
    }

    ;(async () => {
      try {
        const payload = {
          text: cleanText,
          language: langCode,
          gender, // "MALE" | "FEMALE"
        }

        console.log("[TTS] Requesting /api/tts…", payload)

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        const raw = await res.text()
        let data: any = null

        try {
          data = raw ? JSON.parse(raw) : null
        } catch (e) {
          console.error(
            "[TTS] /api/tts returned non-JSON response:",
            raw.slice(0, 200),
          )
        }

        console.log("[TTS] /api/tts status:", res.status, "data:", data)

        if (!res.ok || !data || data.success === false) {
          console.error(
            "[TTS] API error",
            data?.error || res.statusText,
            data?.details || "",
          )
          stopSpeaking()
          return
        }

        let audioUrl: string | undefined = data.audioUrl

        if (!audioUrl && data.audioContent) {
          audioUrl = `data:audio/mp3;base64,${data.audioContent}`
        }

        if (!audioUrl) {
          console.error("[TTS] No audioUrl/audioContent in response")
          stopSpeaking()
          return
        }

        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }

        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onplay = () => {
          startSpeaking()
        }

        audio.onended = () => {
          stopSpeaking()
          audioRef.current = null
        }

        audio.onerror = (e) => {
          console.error("[TTS] audio playback error:", e)
          stopSpeaking()
          audioRef.current = null
        }

        try {
          await audio.play()
        } catch (e) {
          console.error("[TTS] play() rejected", e)
          stopSpeaking()
        }
      } catch (error) {
        console.error("[TTS] fetch error:", error)
        stopSpeaking()
      }
    })()
  }

  // ---------- отправка текста в n8n / OpenAI ----------

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
          gender: voiceGenderRef.current, // "female" | "male" — для промпта ассистента
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
        // не JSON — строка
      }

      console.log("Voice raw response:", data)

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
      }

      setMessages((prev) => [...prev, assistantMsg])
      speakText(answer)
    } catch (error: any) {
      console.error("Voice call error:", error)
      setNetworkError(t("Connection error. Please try again."))
      if (onError && error instanceof Error) onError(error)
    }
  }

  // ---------- управление звонком / микрофоном ----------

  const startCall = async (gender: "female" | "male") => {
    // ЖЁСТКО фиксируем пол сессии
    voiceGenderRef.current = gender

    setIsConnecting(true)
    setNetworkError(null)

    isMicMutedRef.current = false
    setIsMicMuted(false)

    // сначала явно просим доступ к микрофону (особенно важно на телефонах)
    const micOk = await requestMicrophoneAccess()
    if (!micOk) {
      setIsConnecting(false)
      setIsCallActive(false)
      isCallActiveRef.current = false
      setConnectionStatus("disconnected")
      return
    }

    isCallActiveRef.current = true
    setIsCallActive(true)
    setIsConnecting(false)
    setConnectionStatus("connected")
    ensureRecognitionRunning()
  }

  const endCall = () => {
    stopEverything()
  }

  const toggleMic = () => {
    const next = !isMicMuted
    setIsMicMuted(next)
    isMicMutedRef.current = next
    ensureRecognitionRunning()
  }

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
                            {voiceGenderRef.current === "female"
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

            <div className="border-t border-slate-100 px-5 py-3 flex flex-col gap-2">
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
                      className={`h-10 rounded-full px-5 text-xs font-semibold shadow-sm flex items-center gap-2 ${
                        voiceGenderRef.current === "female"
                          ? "bg-pink-600 text-white hover:bg-pink-700"
                          : "bg-pink-50 text-pink-700 hover:bg-pink-100"
                      }`}
                    >
                      {isConnecting && voiceGenderRef.current === "female" ? (
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
                      className={`h-10 rounded-full px-5 text-xs font-semibold shadow-sm flex items-center gap-2 ${
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
