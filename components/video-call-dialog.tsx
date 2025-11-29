"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
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
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  Brain,
  User,
  Sparkles,
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

type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
}

interface AICharacter {
  id: string
  name: string
  gender: "male" | "female"
  description: string
  avatar: string
  idleVideo?: string
  speakingVideo?: string
}

interface VideoCallDialogProps {
  isOpen: boolean
  onClose: () => void
  onError?: (error: Error) => void
  webhookUrl?: string // зарезервировано под будущее API, сейчас не используется
  openAiApiKey?: string // зарезервировано под будущее API, сейчас не используется
}

// простой маппинг языка для распознавания и TTS
function getSpeechLang(code?: string): string {
  if (!code) return "en-US"
  if (code.startsWith("uk")) return "uk-UA"
  if (code.startsWith("ru")) return "ru-RU"
  if (code.startsWith("en")) return "en-US"
  return "en-US"
}

// три персонажа — сейчас используем один аватар и видео, позже легко расширить
const AI_CHARACTERS: AICharacter[] = [
  {
    id: "dr-sophia",
    name: "Dr. Sophia",
    gender: "female",
    description:
      "Клинический психолог, специализируется на тревоге, депрессии и выгорании.",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-ds8y3Pe7RedqJBqZMDPltEeFI149ki.jpg",
    idleVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9962-fVXHRSVmzv64cpPJf4FddeCDXqxdGE.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9950-XyDJMndgIHEWrKcLj25FUlV4c18GLp.MP4",
  },
  {
    id: "dr-alexander",
    name: "Dr. Alexander",
    gender: "male",
    description:
      "Старший психолог, когнитивно-поведенческая терапия и работа со стрессом.",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-18-BmxDH7DCv7e3p0y8HobTyoPkQw1COM.jpg",
    idleVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_7660-2BvRYFiYOwNRwDjKtBtSCtEGUbLMEh.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9968-64neCIRuZ7CYXDT86QGYu4XSE7j0Ug.MP4",
  },
  {
    id: "dr-maria",
    name: "Dr. Maria",
    gender: "female",
    description:
      "Психотерапевт, фокус на эмоциях, травме и отношениях.",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-19%D1%83-iWDrUd3gH9sLBeOjmIvu8wX3yxwBuq.jpg",
    idleVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9963-sneJ4XhoEuemkYgVb425Mscu7X9OC6.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9949-mYErfm0ubE19kr4trLKJrggtvoh4zy.MP4",
  },
]

export default function VideoCallDialog({
  isOpen,
  onClose,
  onError,
}: VideoCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const [selectedCharacter, setSelectedCharacter] =
    useState<AICharacter | null>(AI_CHARACTERS[0])

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(true) // по умолчанию микрофон выключен
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)

  const [connectionStatus, setConnectionStatus] =
    useState<"connected" | "disconnected">("disconnected")
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentVideoState, setCurrentVideoState] = useState<
    "idle" | "speaking"
  >("idle")

  const recognitionRef = useRef<any | null>(null)
  const autoRestartRecognitionRef = useRef<boolean>(true)
  const isAiSpeakingRef = useRef<boolean>(false)

  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const idleVideoRef = useRef<HTMLVideoElement | null>(null)
  const speakingVideoRef = useRef<HTMLVideoElement | null>(null)
  const hasVideoForCharacter =
    !!selectedCharacter?.idleVideo && !!selectedCharacter?.speakingVideo

  const effectiveEmail = user?.email || "guest@example.com"
  const speechLang = getSpeechLang(currentLanguage?.code)
  const micOn = isCallActive && isListening && !isMicMuted

  // полный сброс состояния + остановка медиа
  const stopEverything = useCallback(() => {
    setIsCallActive(false)
    setIsConnecting(false)
    setIsListening(false)
    setIsMicMuted(true)
    setIsAiSpeaking(false)
    setIsCameraOn(true)
    setConnectionStatus("disconnected")
    setNetworkError(null)
    setMessages([])
    setCurrentVideoState("idle")

    autoRestartRecognitionRef.current = false

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {
        console.error(e)
      }
      recognitionRef.current = null
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    if (userVideoRef.current && userVideoRef.current.srcObject) {
      const stream = userVideoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      userVideoRef.current.srcObject = null
    }

    if (idleVideoRef.current) {
      idleVideoRef.current.pause()
      idleVideoRef.current.currentTime = 0
    }
    if (speakingVideoRef.current) {
      speakingVideoRef.current.pause()
      speakingVideoRef.current.currentTime = 0
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      stopEverything()
    }
  }, [isOpen, stopEverything])

  // камера пользователя в маленьком окне
  useEffect(() => {
    if (!isCallActive || !isCameraOn || !userVideoRef.current) return
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return

    let stream: MediaStream | null = null

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((s) => {
        stream = s
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream
        }
      })
      .catch((err) => {
        console.error("Camera error:", err)
        setIsCameraOn(false)
      })

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = null
      }
    }
  }, [isCallActive, isCameraOn])

  // TTS для ответа (браузерный, без Google Cloud)
  const speakText = useCallback(
    (text: string) => {
      if (!isSoundEnabled) return
      if (typeof window === "undefined" || !window.speechSynthesis) return

      // остановить распознавание, чтобы не ловить собственный голос
      if (recognitionRef.current) {
        try {
          autoRestartRecognitionRef.current = false
          recognitionRef.current.stop()
        } catch (e) {
          console.error("[VIDEO] stop recognition before TTS", e)
        }
      }
      setIsListening(false)

      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = speechLang
      utterance.rate = 1
      utterance.pitch = 1

      utterance.onstart = () => {
        isAiSpeakingRef.current = true
        setIsAiSpeaking(true)
        setCurrentVideoState("speaking")

        // переключаем видео на "говорит"
        if (hasVideoForCharacter) {
          if (idleVideoRef.current) {
            idleVideoRef.current.pause()
          }
          if (speakingVideoRef.current) {
            speakingVideoRef.current.currentTime = 0
            speakingVideoRef.current
              .play()
              .catch((e) =>
                console.error("[VIDEO] speaking video play error", e),
              )
          }
        }
      }

      const finishSpeaking = () => {
        isAiSpeakingRef.current = false
        setIsAiSpeaking(false)
        setCurrentVideoState("idle")

        if (hasVideoForCharacter) {
          if (speakingVideoRef.current) {
            speakingVideoRef.current.pause()
            speakingVideoRef.current.currentTime = 0
          }
          if (idleVideoRef.current && isCallActive) {
            idleVideoRef.current.currentTime = 0
            idleVideoRef.current
              .play()
              .catch((e) =>
                console.error("[VIDEO] idle video play error", e),
              )
          }
        }

        if (isCallActive && !isMicMuted) {
          autoRestartRecognitionRef.current = true
          try {
            if (recognitionRef.current) {
              recognitionRef.current.start()
            }
          } catch (e) {
            console.error("[VIDEO] restart recognition after TTS", e)
          }
        }
      }

      utterance.onend = finishSpeaking
      utterance.onerror = () => finishSpeaking()

      window.speechSynthesis.speak(utterance)
    },
    [isCallActive, isMicMuted, isSoundEnabled, speechLang, hasVideoForCharacter],
  )

  // отправка текста в API + добавление в чат
  const handleUserText = useCallback(
    async (text: string) => {
      const cleaned = text.trim()
      if (!cleaned) return

      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, role: "user", text: cleaned },
      ])

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: cleaned,
            language: currentLanguage?.code,
            email: effectiveEmail,
            mode: "video",
            characterId: selectedCharacter?.id,
            characterName: selectedCharacter?.name,
          }),
        })

        if (!res.ok) {
          throw new Error(`Chat API error: ${res.status}`)
        }

        const data = await res.json()
        const answer: string =
          (data && (data.text as string)) ||
          t(
            "I'm sorry, I couldn't process your message. Please try again.",
          )

        setMessages((prev) => [
          ...prev,
          { id: prev.length + 1, role: "assistant", text: answer },
        ])

        speakText(answer)
      } catch (error: any) {
        console.error("Video call error:", error)
        setNetworkError(t("Connection error. Please try again."))

        const fallback =
          t("I'm sorry, I couldn't process your message. Please try again.")

        setMessages((prev) => [
          ...prev,
          { id: prev.length + 1, role: "assistant", text: fallback },
        ])

        if (onError && error instanceof Error) onError(error)
      }
    },
    [currentLanguage?.code, effectiveEmail, onError, selectedCharacter, speakText, t],
  )

  // запуск распознавания речи (логика как в голосовом ассистенте)
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
    recognition.lang = speechLang

    recognition.onstart = () => {
      setIsListening(true)
      setConnectionStatus("connected")
      setNetworkError(null)
    }

    recognition.onerror = (event: any) => {
      console.error("[VIDEO] Speech recognition error", event)

      if (event?.error === "no-speech") {
        // длинная пауза — ставим ассистента на паузу
        autoRestartRecognitionRef.current = false
        setIsListening(false)
        setIsMicMuted(true)
        setNetworkError(null)
        return
      }

      if (event?.error !== "no-speech") {
        setNetworkError(t("Error while listening. Please try again."))
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)

      if (!autoRestartRecognitionRef.current) {
        autoRestartRecognitionRef.current = true
        return
      }

      if (isCallActive && !isMicMuted && !isAiSpeakingRef.current) {
        setTimeout(() => {
          try {
            recognition.start()
          } catch (e) {
            console.error("[VIDEO] restart error", e)
          }
        }, 400)
      }
    }

    recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1]
      if (!last || !last.isFinal) return

      const text = last[0]?.transcript?.trim()
      if (!text) return

      void handleUserText(text)
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
    } catch (e) {
      console.error("[VIDEO] Cannot start recognition", e)
      setNetworkError(
        t("Could not start microphone. Check permissions and try again."),
      )
      setIsListening(false)
      setIsMicMuted(true)
    }
  }, [isCallActive, isMicMuted, speechLang, t, handleUserText])

  const startCall = useCallback(() => {
    if (!selectedCharacter) return

    setIsConnecting(true)
    setNetworkError(null)
    setMessages([])

    setTimeout(() => {
      setIsCallActive(true)
      setIsConnecting(false)
      setIsMicMuted(true) // начинаем с выключенного микрофона
      setCurrentVideoState("idle")

      // запускаем idle-видео
      if (hasVideoForCharacter && idleVideoRef.current) {
        idleVideoRef.current.currentTime = 0
        idleVideoRef.current
          .play()
          .catch((e) => console.error("[VIDEO] idle video play error", e))
      }
    }, 200)
  }, [hasVideoForCharacter, selectedCharacter])

  const endCall = useCallback(() => {
    stopEverything()
  }, [stopEverything])

  const toggleMic = () => {
    if (!isCallActive) return

    if (micOn) {
      // выключаем
      setIsMicMuted(true)
      autoRestartRecognitionRef.current = false
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          console.error(e)
        }
      }
      setIsListening(false)
    } else {
      // включаем
      setIsMicMuted(false)
      setNetworkError(null)
      autoRestartRecognitionRef.current = true
      startRecognition()
    }
  }

  const toggleCamera = () => {
    if (!isCallActive) return

    if (isCameraOn) {
      if (userVideoRef.current && userVideoRef.current.srcObject) {
        const stream = userVideoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        userVideoRef.current.srcObject = null
      }
      setIsCameraOn(false)
    } else {
      setIsCameraOn(true)
    }
  }

  const toggleSound = () => {
    const next = !isSoundEnabled
    setIsSoundEnabled(next)

    // если выключаем звук во время речи — останавливаем TTS
    if (!next && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      setIsAiSpeaking(false)
      setCurrentVideoState("idle")
    }
  }

  const statusText = (() => {
    if (!isCallActive)
      return t(
        "Press the button to start a video session with the AI-psychologist.",
      )
    if (isAiSpeaking)
      return t("Assistant is speaking. Please wait a moment.")
    if (micOn) return t("Listening… you can speak.")
    return t("Paused. Turn on microphone to continue.")
  })()

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
      <DialogContent className="max-w-4xl border-none bg-transparent p-0">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Phone className="h-4 w-4" />
                  </span>
                  {t("Video session with AI-psychologist")}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {t(
                    "You can speak out loud, the assistant will see you, listen and voice the reply.",
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

          {/* До начала звонка — выбор персонажа */}
          {!isCallActive ? (
            <div className="flex h-[520px] flex-col md:h-[560px] px-6 py-5">
              <div className="mb-4 rounded-2xl bg-indigo-50/80 p-4 text-xs text-slate-700">
                <p className="mb-1 font-medium text-slate-900">
                  {t("How it works")}
                </p>
                <p className="mb-1">
                  {t(
                    "Choose an AI-psychologist, then press the button to start a secure video session.",
                  )}
                </p>
                <p className="text-[11px] text-slate-500">
                  {t(
                    "Your data is processed securely and not shared with third parties.",
                  )}
                </p>
              </div>

              <div className="mb-4 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">
                    {t("Language")}:
                  </span>
                  <span className="text-slate-900 font-medium flex items-center gap-1">
                    <span>{currentLanguage.flag}</span>
                    <span>{currentLanguage.name}</span>
                  </span>
                </div>
              </div>

              <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
                {AI_CHARACTERS.map((character) => (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() => setSelectedCharacter(character)}
                    className={`flex flex-col overflow-hidden rounded-2xl border text-left shadow-sm transition hover:shadow-md ${
                      selectedCharacter?.id === character.id
                        ? "border-indigo-500 ring-2 ring-indigo-300"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="relative h-40 w-full">
                      <Image
                        src={character.avatar || "/placeholder.svg"}
                        alt={character.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    </div>
                    <div className="flex flex-1 flex-col px-3 py-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {character.name}
                        </p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                          {character.gender === "female"
                            ? t("Female")
                            : t("Male")}
                        </span>
                      </div>
                      <p className="line-clamp-3 text-[11px] text-slate-600">
                        {character.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 flex justify-end">
                <Button
                  type="button"
                  onClick={startCall}
                  disabled={!selectedCharacter || isConnecting}
                  className="h-9 rounded-full bg-indigo-600 px-5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-70"
                >
                  {isConnecting ? (
                    <>
                      <Phone className="mr-1 h-3 w-3 animate-pulse" />
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
            </div>
          ) : (
            // Активный звонок
            <div className="flex h-[580px] flex-col md:h-[620px]">
              {/* Видео-блок */}
              <div className="relative w-full bg-slate-900 pt-[56.25%]">
                {/* idle / speaking видео ассистента */}
                {hasVideoForCharacter ? (
                  <>
                    <video
                      ref={idleVideoRef}
                      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                        currentVideoState === "idle"
                          ? "opacity-100"
                          : "opacity-0"
                      }`}
                      muted
                      loop
                      playsInline
                      preload="auto"
                    >
                      <source
                        src={selectedCharacter?.idleVideo}
                        type="video/mp4"
                      />
                    </video>
                    <video
                      ref={speakingVideoRef}
                      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                        currentVideoState === "speaking"
                          ? "opacity-100"
                          : "opacity-0"
                      }`}
                      muted
                      loop
                      playsInline
                      preload="auto"
                    >
                      <source
                        src={selectedCharacter?.speakingVideo}
                        type="video/mp4"
                      />
                    </video>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative h-40 w-40 md:h-52 md:w-52">
                      <Image
                        src={selectedCharacter?.avatar || "/placeholder.svg"}
                        alt={selectedCharacter?.name || "AI psychologist"}
                        fill
                        className="rounded-full object-cover"
                      />
                    </div>
                  </div>
                )}

                {/* бейдж языка */}
                <div className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium text-white flex items-center gap-1">
                  <span>{currentLanguage.flag}</span>
                  <span className="hidden sm:inline">
                    {currentLanguage.name}
                  </span>
                </div>

                {/* статус прослушивания / речи */}
                <div
                  className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    isAiSpeaking
                      ? "bg-purple-100 text-purple-800"
                      : micOn
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {isAiSpeaking
                    ? t("Assistant is speaking")
                    : micOn
                      ? t("Listening…")
                      : t("Microphone off")}
                </div>

                {/* маленькое окно камеры пользователя */}
                {isCameraOn && (
                  <div className="absolute bottom-3 right-3 h-24 w-32 overflow-hidden rounded-lg border border-white/40 bg-black/40 shadow-lg">
                    <video
                      ref={userVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Чат-диалог */}
              <ScrollArea className="flex-1 px-6 pt-4 pb-2">
                <div className="space-y-3">
                  {messages.length === 0 && (
                    <div className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-xs text-slate-700">
                      <p className="mb-1 font-medium text-slate-900">
                        {t("How to start")}
                      </p>
                      <p>
                        {t(
                          "Turn on the microphone and say a few words about how you feel or what you would like to discuss.",
                        )}
                      </p>
                    </div>
                  )}

                  {messages.map((msg) =>
                    msg.role === "user" ? (
                      <div
                        key={msg.id}
                        className="ml-auto max-w-[80%] rounded-2xl bg-blue-50 px-3 py-3 text-xs md:text-sm text-slate-900"
                      >
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-blue-800">
                          <User className="h-3.5 w-3.5" />
                          {t("You said")}
                        </p>
                        <p>{msg.text}</p>
                      </div>
                    ) : (
                      <div
                        key={msg.id}
                        className="max-w-[80%] rounded-2xl bg-emerald-50 px-3 py-3 text-xs md:text-sm text-slate-900"
                      >
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-emerald-800">
                          <Brain className="h-3.5 w-3.5" />
                          {selectedCharacter?.name || t("AI Psychologist")}
                        </p>
                        <p>{msg.text}</p>
                      </div>
                    ),
                  )}

                  {networkError && (
                    <div className="rounded-2xl bg-rose-50 px-3 py-3 text-xs text-rose-700">
                      {networkError}
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Статус + управление (всегда видно) */}
              <div className="border-t border-slate-100 px-6 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <Sparkles className="h-3 w-3" />
                    {statusText}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      onClick={toggleMic}
                      className={`h-9 w-9 rounded-full border ${
                        micOn
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-rose-200 bg-rose-50 text-rose-600"
                      }`}
                    >
                      {micOn ? (
                        <Mic className="h-4 w-4" />
                      ) : (
                        <MicOff className="h-4 w-4" />
                      )}
                    </Button>

                    <Button
                      type="button"
                      size="icon"
                      onClick={toggleCamera}
                      className={`h-9 w-9 rounded-full border ${
                        isCameraOn
                          ? "border-slate-200 bg-slate-50 text-slate-700"
                          : "border-rose-200 bg-rose-50 text-rose-600"
                      }`}
                    >
                      {isCameraOn ? (
                        <Camera className="h-4 w-4" />
                      ) : (
                        <CameraOff className="h-4 w-4" />
                      )}
                    </Button>

                    <Button
                      type="button"
                      size="icon"
                      onClick={toggleSound}
                      className={`h-9 w-9 rounded-full border ${
                        isSoundEnabled
                          ? "border-slate-200 bg-slate-50 text-slate-700"
                          : "border-rose-200 bg-rose-50 text-rose-600"
                      }`}
                    >
                      {isSoundEnabled ? (
                        <Volume2 className="h-4 w-4" />
                      ) : (
                        <VolumeX className="h-4 w-4" />
                      )}
                    </Button>

                    <Button
                      type="button"
                      size="icon"
                      onClick={endCall}
                      className="h-9 w-9 rounded-full bg-rose-600 text-white hover:bg-rose-700"
                    >
                      <Phone className="h-4 w-4 rotate-[135deg]" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
