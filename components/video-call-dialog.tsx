"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
  Brain,
  Loader2,
  Mic,
  MicOff,
  Phone,
  Sparkles,
  User,
  Video,
  Wifi,
  WifiOff,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { APP_NAME } from "@/lib/app-config"

declare global {
  interface Window {
    SpeechRecognition?: any
    webkitSpeechRecognition?: any
  }
}

/**
 * ВАЖНО:
 * 1) Поставь сюда свой URL вебхука n8n
 *    либо пропиши NEXT_PUBLIC_VIDEO_PSYCHOLOGIST_WEBHOOK_URL в .env.
 */
const FALLBACK_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_VIDEO_PSYCHOLOGIST_WEBHOOK_URL ||
  "https://YOUR-N8N-DOMAIN/webhook/ai-psychologist-video-call" // ← ЗАМЕНИ ЭТО на реальный путь

type Role = "user" | "assistant"

interface Message {
  id: string
  role: Role
  text: string
  ts: number
}

interface VideoCallDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function VideoCallDialog({ isOpen, onClose }: VideoCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false) // микрофон по дефолту ВКЛЮЧЕН после старта звонка
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [connectionStatus, setConnectionStatus] =
    useState<"connected" | "disconnected">("disconnected")
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  const recognitionRef = useRef<any | null>(null)
  const isVoicingRef = useRef(false)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const lastUserSpeechAtRef = useRef<number | null>(null)

  const effectiveEmail = user?.email || "guest@example.com"

  const stopEverything = useCallback(() => {
    setIsCallActive(false)
    setIsConnecting(false)
    setIsListening(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setConnectionStatus("disconnected")
    setNetworkError(null)

    // остановка SpeechRecognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null
        recognitionRef.current.onend = null
        recognitionRef.current.onerror = null
        recognitionRef.current.stop()
      } catch (e) {
        console.error(e)
      }
      recognitionRef.current = null
    }

    // остановка озвучки
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    isVoicingRef.current = false

    // остановка локальной камеры
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      localVideoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      stopEverything()
    }
  }, [isOpen, stopEverything])

  // --------- УТИЛИТЫ ЧАТА ---------

  const appendMessage = useCallback((role: Role, text: string) => {
    if (!text.trim()) return
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${prev.length}`, role, text: text.trim(), ts: Date.now() },
    ])
  }, [])

  // --------- ПРОИГРЫВАНИЕ АУДИО ОТ N8N ---------

  const playRemoteAudio = useCallback((url: string) => {
    if (!url) return
    try {
      const audio = new Audio(url)
      isVoicingRef.current = true
      setIsAiSpeaking(true)

      audio.onended = () => {
        isVoicingRef.current = false
        setIsAiSpeaking(false)
      }
      audio.onerror = () => {
        isVoicingRef.current = false
        setIsAiSpeaking(false)
      }

      void audio.play()
    } catch (e) {
      console.error("playRemoteAudio error:", e)
      isVoicingRef.current = false
      setIsAiSpeaking(false)
    }
  }, [])

  // Фолбек, если с n8n не пришла аудиодорожка
  const speakWithBrowserTTS = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return
      try {
        const utter = new SpeechSynthesisUtterance(text)
        utter.lang = currentLanguage.code.startsWith("uk")
          ? "uk-UA"
          : currentLanguage.code.startsWith("ru")
          ? "ru-RU"
          : "en-US"
        utter.rate = 1
        utter.pitch = 1

        isVoicingRef.current = true
        setIsAiSpeaking(true)

        utter.onend = () => {
          isVoicingRef.current = false
          setIsAiSpeaking(false)
        }
        utter.onerror = () => {
          isVoicingRef.current = false
          setIsAiSpeaking(false)
        }

        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(utter)
      } catch (e) {
        console.error("Browser TTS error:", e)
        isVoicingRef.current = false
        setIsAiSpeaking(false)
      }
    },
    [currentLanguage.code],
  )

  // --------- ВЫЗОВ N8N ---------

  const processTranscription = useCallback(
    async (text: string) => {
      const cleanText = text.trim()
      if (!cleanText) return

      const effectiveWebhook =
        FALLBACK_WEBHOOK_URL && !FALLBACK_WEBHOOK_URL.includes("YOUR-N8N-DOMAIN")
          ? FALLBACK_WEBHOOK_URL
          : null

      if (!effectiveWebhook) {
        console.warn(
          "[VideoCall] WEBHOOK URL is not set. Задай NEXT_PUBLIC_VIDEO_PSYCHOLOGIST_WEBHOOK_URL или замени FALLBACK_WEBHOOK_URL в файле.",
        )
        appendMessage(
          "assistant",
          t(
            "The assistant is not configured yet. Please contact support so we can enable the video psychologist.",
          ),
        )
        return
      }

      try {
        const params = new URLSearchParams({
          text: cleanText,
          language: currentLanguage.code,
          email: effectiveEmail,
          source: "video-psychologist",
        })

        const res = await fetch(`${effectiveWebhook}?${params.toString()}`, {
          method: "GET",
        })

        if (!res.ok) {
          throw new Error(`Webhook error: ${res.status}`)
        }

        const data = await res.json()

        const answer: string =
          data.answer ||
          data.text ||
          t("I couldn't process your message. Could you try again.")

        const audioUrl: string | undefined =
          data.audioUrl || data.audio_url || data.audio

        appendMessage("assistant", answer)

        if (audioUrl) {
          playRemoteAudio(audioUrl)
        } else {
          // если аудио не пришло — озвучиваем браузерным TTS
          speakWithBrowserTTS(answer)
        }
      } catch (error) {
        console.error("Processing error:", error)
        setNetworkError(t("Connection error. Please try again."))
        appendMessage(
          "assistant",
          t("I couldn't process your message. Could you try again."),
        )
      }
    },
    [appendMessage, currentLanguage.code, effectiveEmail, playRemoteAudio, speakWithBrowserTTS, t],
  )

  // --------- SPEECH RECOGNITION ---------

  const startRecognition = useCallback(() => {
    if (typeof window === "undefined") return

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setNetworkError(
        t(
          "Your browser does not support voice recognition. Please use Chrome or another modern browser.",
        ),
      )
      return
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = currentLanguage.code.startsWith("uk")
      ? "uk-UA"
      : currentLanguage.code.startsWith("ru")
      ? "ru-RU"
      : "en-US"

    recognition.onstart = () => {
      setIsListening(true)
      setConnectionStatus("connected")
      setNetworkError(null)
    }

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event)
      if (event?.error !== "no-speech") {
        setNetworkError(t("Error while listening. Please try again."))
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      // автоперезапуск, пока идёт звонок и микрофон НЕ выключен
      if (isCallActive && !isMicMuted) {
        setTimeout(() => {
          try {
            recognition.start()
          } catch (e) {
            console.error("Restart recognition error:", e)
          }
        }, 400)
      }
    }

    recognition.onresult = (event: any) => {
      // главное: НЕ ловим собственный голос ассистента
      if (isVoicingRef.current) {
        // ассистент говорит — игнорируем результаты, чтобы не было циклов
        return
      }

      const last = event.results[event.results.length - 1]
      if (!last || !last.isFinal) return

      const text = last[0]?.transcript?.trim()
      if (!text) return

      lastUserSpeechAtRef.current = Date.now()
      appendMessage("user", text)
      void processTranscription(text)
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
    } catch (e) {
      console.error("Cannot start recognition:", e)
      setNetworkError(
        t("Could not start microphone. Check permissions and try again."),
      )
    }
  }, [appendMessage, currentLanguage.code, isCallActive, isMicMuted, processTranscription, t])

  // --------- КАМЕРА ПОЛЬЗОВАТЕЛЯ ---------

  const setupCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      })
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
    } catch (e) {
      console.error("Camera error:", e)
    }
  }, [])

  useEffect(() => {
    if (isCallActive) {
      void setupCamera()
    }
  }, [isCallActive, setupCamera])

  // --------- КОНТРОЛЛЕРЫ ЗВОНКА ---------

  const startCall = useCallback(() => {
    setIsConnecting(true)
    setNetworkError(null)
    setMessages([])
    setConnectionStatus("disconnected")

    setTimeout(() => {
      setIsCallActive(true)
      setIsConnecting(false)
      setIsMicMuted(false) // МИКРОФОН ВКЛЮЧЕН СРАЗУ
      startRecognition()
    }, 250)
  }, [startRecognition])

  const endCall = useCallback(() => {
    stopEverything()
  }, [stopEverything])

  const toggleMic = useCallback(() => {
    const next = !isMicMuted
    setIsMicMuted(next)

    if (!next) {
      // включили микрофон
      startRecognition()
    } else {
      // выключили микрофон
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          console.error(e)
        }
      }
      setIsListening(false)
    }
  }, [isMicMuted, startRecognition])

  const userEmailDisplay = effectiveEmail

  // --------- RENDER ---------

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
      <DialogContent className="max-w-3xl w-full border-none bg-transparent p-0">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Video className="h-4 w-4" />
                  </span>
                  {t("AI Psychologist Video Call")}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {t("Talk to an AI-psychologist in a safe private video session.")}
                </DialogDescription>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-indigo-50">
                  {APP_NAME} · {t("Video assistant online")}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-indigo-100">
                  {connectionStatus === "connected" ? (
                    <>
                      <Wifi className="h-3 w-3 text-emerald-200" />
                      {t("Connected")}
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 text-rose-200" />
                      {t("Disconnected")}
                    </>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* ВИДЕО-БЛОК */}
          <div className="border-b border-slate-100 bg-black">
            <div className="relative w-full aspect-[16/9]">
              {/* Видео психолога – просто петляющий ролик без звука */}
              <video
                className="absolute inset-0 h-full w-full object-cover"
                src="/video/psychologist/doctor-main.mp4" // подставь свой файл
                autoPlay
                loop
                muted
                playsInline
              />

              {/* Превью камеры пользователя */}
              <video
                ref={localVideoRef}
                className="absolute bottom-3 right-3 h-24 w-32 rounded-xl border border-white/70 bg-black/40 object-cover shadow-lg shadow-black/60"
                autoPlay
                muted
                playsInline
              />

              {/* ЕДИНСТВЕННЫЙ статус - в правом верхнем углу */}
              <div className="absolute top-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                {isAiSpeaking
                  ? t("Speaking…")
                  : isListening
                  ? t("Listening…")
                  : isCallActive
                  ? t("Paused")
                  : t("Ready")}
              </div>
            </div>
          </div>

          {/* ЧАТ + КОНТРОЛЛЫ */}
          <div className="flex h-[360px] flex-col">
            <ScrollArea className="flex-1 px-5 pt-4 pb-2">
              <div className="space-y-3">
                {!isCallActive && (
                  <div className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-xs text-slate-700">
                    <p className="mb-1 font-medium text-slate-900">
                      {t("How it works")}
                    </p>
                    <p>
                      {t(
                        "Press the button to start the video session, allow microphone and camera access and talk as with a real psychologist.",
                      )}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {t(
                        "Your e-mail will only be used for personalization of the session.",
                      )}{" "}
                      ({userEmailDisplay})
                    </p>
                  </div>
                )}

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${
                      m.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs md:text-sm ${
                        m.role === "user"
                          ? "bg-blue-50 text-slate-900"
                          : "bg-emerald-50 text-slate-900"
                      }`}
                    >
                      <p className="mb-1 flex items-center gap-1 text-[11px] font-medium">
                        {m.role === "user" ? (
                          <>
                            <User className="h-3 w-3" />
                            {t("You")}
                          </>
                        ) : (
                          <>
                            <Brain className="h-3 w-3" />
                            {t("Dr. Alexander")}
                          </>
                        )}
                      </p>
                      <p>{m.text}</p>
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
                  {isListening
                    ? t("Listening… you can speak.")
                    : isCallActive
                    ? t("Paused. Turn on microphone to continue.")
                    : t(
                        "In crisis situations, please contact local emergency services immediately.",
                      )}
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
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={startCall}
                    disabled={isConnecting}
                    className="h-9 rounded-full bg-indigo-600 px-5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-70"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        {t("Connecting")}
                      </>
                    ) : (
                      <>
                        <Phone className="mr-1 h-3 w-3" />
                        {t("Start video session")}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
