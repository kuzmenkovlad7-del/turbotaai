"use client"

import { useState, useRef, useEffect, useCallback } from "react"
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
  X,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Phone,
  Brain,
  Sparkles,
  Loader2,
  Volume2,
  VolumeX,
} from "lucide-react"
import Image from "next/image"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { APP_NAME } from "@/lib/app-config"

declare global {
  interface Window {
    SpeechRecognition?: any
    webkitSpeechRecognition?: any
  }
}

type AICharacter = {
  id: string
  name: string
  gender: "male" | "female"
  description: string
  avatar: string
  idleVideo?: string
  speakingVideo?: string
  speakingVideoNew?: string
}

interface VideoCallDialogProps {
  isOpen: boolean
  onClose: () => void
  webhookUrl?: string  // оставлено для совместимости, НЕ используем
  openAiApiKey?: string // оставлено для совместимости, НЕ используем
  onError?: (error: Error) => void
}

// Те же три персонажа, что и были
const aiCharacters: AICharacter[] = [
  {
    id: "dr-alexander",
    name: "Dr. Alexander",
    gender: "male",
    description:
      "Senior psychologist specializing in cognitive behavioral therapy with 15+ years of experience",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-18-BmxDH7DCv7e3p0y8HobTyoPkQw1COM.jpg",
    idleVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_7660-2BvRYFiYOwNRwDjKtBtSCtEGUbLMEh.MP4",
    speakingVideoNew:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9968-64neCIRuZ7CYXDT86QGYu4XSE7j0Ug.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/doc_2025-06-19_20-29-04-QF7QyAGKBJ4Abilc0beRV9jP7VDO7i.mp4",
  },
  {
    id: "dr-sophia",
    name: "Dr. Sophia",
    gender: "female",
    description:
      "Clinical psychologist specializing in anxiety, depression, and workplace stress management",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-ds8y3Pe7RedqJBqZMDPltEeFI149ki.jpg",
    idleVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9962-fVXHRSVmzv64cpPJf4FddeCDXqxdGE.MP4",
    speakingVideoNew:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9950-XyDJMndgIHEWrKcLj25FUlV4c18GLp.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG111211_6034-6fD2w1l0V94iXV7x4VeGW74NHbtZrk.MP4",
  },
  {
    id: "dr-maria",
    name: "Dr. Maria",
    gender: "female",
    description:
      "Psychotherapist specializing in emotional regulation, trauma recovery, and relationship counseling",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-19%D1%83-iWDrUd3gH9sLBeOjmIvu8wX3yxwBuq.jpg",
    idleVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9963-sneJ4XhoEuemkYgVb425Mscu7X9OC6.MP4",
    speakingVideoNew:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9949-mYErfm0ubE19kr4trLKJrggtvoh4zy.MP4",
    speakingVideo: "/videos/dr-maria-speaking.mp4",
  },
]

export default function VideoCallDialog({
  isOpen,
  onClose,
  onError,
}: VideoCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const [selectedCharacter, setSelectedCharacter] = useState<AICharacter | null>(
    aiCharacters[0],
  )

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  const [isMicMuted, setIsMicMuted] = useState(true)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)

  const [isListening, setIsListening] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)

  const [transcript, setTranscript] = useState("")
  const [aiResponse, setAiResponse] = useState("")
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<any | null>(null)
  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const userStreamRef = useRef<MediaStream | null>(null)

  const effectiveEmail = user?.email || "guest@example.com"

  const hasEnhancedVideo =
    !!selectedCharacter?.idleVideo && !!selectedCharacter?.speakingVideoNew

  const stopAll = useCallback(() => {
    setIsCallActive(false)
    setIsConnecting(false)
    setIsListening(false)
    setIsAiSpeaking(false)
    setTranscript("")
    setAiResponse("")
    setError(null)
    setIsMicMuted(true)
    setIsCameraOff(false)

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        /* ignore */
      }
      recognitionRef.current = null
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach((track) => track.stop())
      userStreamRef.current = null
    }
    if (userVideoRef.current) {
      userVideoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      stopAll()
    }
  }, [isOpen, stopAll])

  useEffect(() => {
    return () => {
      stopAll()
    }
  }, [stopAll])

  // Озвучка ответа
  const speakText = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return
      const clean = text.trim()
      if (!clean) return
      if (!isSoundEnabled) return

      const utterance = new SpeechSynthesisUtterance(clean)

      const langCode = currentLanguage.code || "en"
      utterance.lang = langCode.startsWith("uk")
        ? "uk-UA"
        : langCode.startsWith("ru")
          ? "ru-RU"
          : "en-US"

      utterance.rate = 1
      utterance.pitch = 1

      utterance.onstart = () => setIsAiSpeaking(true)
      utterance.onend = () => setIsAiSpeaking(false)
      utterance.onerror = () => setIsAiSpeaking(false)

      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    },
    [currentLanguage.code, isSoundEnabled],
  )

  // Отправка текста в наш /api/chat
  const handleUserText = useCallback(
    async (text: string) => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            language: currentLanguage.code, // важно: строка кода языка
            email: effectiveEmail,
            mode: "video",
            characterId: selectedCharacter?.id ?? null,
          }),
        })

        if (!res.ok) {
          throw new Error(`Chat API error: ${res.status}`)
        }

        const data = await res.json()
        const answer: string =
          (data && (data.text as string)) ||
          t("I'm sorry, I couldn't process your message. Please try again.")

        setAiResponse(answer)
        speakText(answer)
      } catch (err: any) {
        console.error("Video call error:", err)
        setError(t("Connection error. Please try again."))
        if (onError && err instanceof Error) onError(err)
      }
    },
    [currentLanguage.code, effectiveEmail, onError, selectedCharacter?.id, speakText, t],
  )

  // SpeechRecognition
  const startRecognition = useCallback(() => {
    if (typeof window === "undefined") return

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SR) {
      setError(
        t(
          "Your browser does not support voice recognition. Please use Chrome or another modern browser.",
        ),
      )
      return
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = false

    const langCode = currentLanguage.code || "en"
    recognition.lang = langCode.startsWith("uk")
      ? "uk-UA"
      : langCode.startsWith("ru")
        ? "ru-RU"
        : "en-US"

    recognition.onstart = () => {
      setIsListening(true)
      setError(null)
    }

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event)
      if (event?.error !== "no-speech") {
        setError(t("Error while listening. Please try again."))
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      if (isCallActive && !isMicMuted) {
        try {
          recognition.start()
        } catch (e) {
          console.error("Restart recognition error:", e)
        }
      }
    }

    recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1]
      if (!last || !last.isFinal) return

      const text: string = last[0]?.transcript?.trim()
      if (!text) return

      setTranscript((prev) => (prev ? `${prev} ${text}` : text))
      void handleUserText(text)
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
    } catch (e) {
      console.error("Cannot start recognition:", e)
      setError(
        t("Could not start microphone. Please check permissions and try again."),
      )
    }
  }, [currentLanguage.code, handleUserText, isCallActive, isMicMuted, t])

  // Камера
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      userStreamRef.current = stream
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream
      }
      setIsCameraOff(false)
    } catch (e) {
      console.error("Camera error:", e)
      setIsCameraOff(true)
      setError(
        t("Could not access your camera. Please check your permissions."),
      )
    }
  }, [t])

  const stopCamera = useCallback(() => {
    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach((track) => track.stop())
      userStreamRef.current = null
    }
    if (userVideoRef.current) {
      userVideoRef.current.srcObject = null
    }
    setIsCameraOff(true)
  }, [])

  const toggleCamera = () => {
    if (isCameraOff) {
      void startCamera()
    } else {
      stopCamera()
    }
  }

  const startCall = useCallback(async () => {
    if (!selectedCharacter) return

    setIsConnecting(true)
    setError(null)

    try {
      setIsCallActive(true)
      await startCamera()
      // микрофон по дефолту выключен, юзер сам включает
    } catch (e) {
      console.error("Start call error:", e)
      setError(
        t("Failed to start the call. Please check your permissions and try again."),
      )
      setIsCallActive(false)
      stopCamera()
    } finally {
      setIsConnecting(false)
    }
  }, [selectedCharacter, startCamera, stopCamera, t])

  const endCall = useCallback(() => {
    stopAll()
  }, [stopAll])

  const toggleMic = () => {
    const nextMuted = !isMicMuted
    setIsMicMuted(nextMuted)

    if (nextMuted) {
      // выключили микрофон
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          console.error(e)
        }
        recognitionRef.current = null
      }
      setIsListening(false)
    } else {
      // включили микрофон
      startRecognition()
    }
  }

  const toggleSound = () => {
    const next = !isSoundEnabled
    setIsSoundEnabled(next)
    if (!next) {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      setIsAiSpeaking(false)
    }
  }

  const userEmailDisplay = effectiveEmail

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
      <DialogContent className="max-w-5xl border-none bg-transparent p-0">
        <div className="flex h-[100dvh] flex-col overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10 md:h-[640px]">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  {t("Video session with AI-psychologist")}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100 truncate">
                  {t(
                    "The assistant listens to you, answers as a psychologist and voices the reply.",
                  )}
                </DialogDescription>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-indigo-50">
                  {APP_NAME} · {t("Assistant online")}
                </div>
                <div className="text-[11px] text-indigo-100">
                  {t("User")}: {userEmailDisplay}
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-1 flex-col md:flex-row">
            {/* Левая часть: выбор персонажа + видео */}
            <div className="flex w-full flex-col border-b border-slate-100 p-4 md:w-1/2 md:border-b-0 md:border-r">
              {!isCallActive ? (
                <>
                  <div className="mb-4 text-center">
                    <p className="mb-1 text-xs font-medium text-slate-600">
                      {t("Choose psychologist")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t(
                        "Select who will talk with you on the video session.",
                      )}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {aiCharacters.map((char) => (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => setSelectedCharacter(char)}
                        className={`flex flex-col items-center rounded-2xl border p-3 text-[11px] transition ${
                          selectedCharacter?.id === char.id
                            ? "border-indigo-500 bg-indigo-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="relative mb-2 h-12 w-12 overflow-hidden rounded-full">
                          <Image
                            src={char.avatar || "/placeholder.svg"}
                            alt={char.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <span className="mb-1 font-medium truncate">
                          {char.name}
                        </span>
                        <span className="line-clamp-2 text-[10px] text-slate-500">
                          {char.description}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-auto flex flex-col gap-2">
                    {error && (
                      <div className="rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {error}
                      </div>
                    )}
                    <Button
                      type="button"
                      onClick={startCall}
                      disabled={!selectedCharacter || isConnecting}
                      className="mt-2 h-9 rounded-full bg-indigo-600 px-5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-70"
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
                </>
              ) : (
                <>
                  <div className="relative mb-3 w-full overflow-hidden rounded-2xl bg-slate-900">
                    <div className="relative w-full pb-[56.25%]">
                      {/* Аватар/видео психолога */}
                      {selectedCharacter && (
                        <>
                          {hasEnhancedVideo ? (
                            <>
                              <video
                                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                                  isAiSpeaking ? "opacity-0" : "opacity-100"
                                }`}
                                autoPlay
                                loop
                                muted
                                playsInline
                                src={selectedCharacter.idleVideo}
                              />
                              <video
                                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                                  isAiSpeaking ? "opacity-100" : "opacity-0"
                                }`}
                                autoPlay
                                loop
                                muted
                                playsInline
                                src={selectedCharacter.speakingVideoNew}
                              />
                            </>
                          ) : selectedCharacter.speakingVideo ? (
                            <video
                              className="absolute inset-0 h-full w-full object-cover"
                              autoPlay
                              loop
                              muted
                              playsInline
                              src={selectedCharacter.speakingVideo}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-white/20 shadow-lg">
                                <Image
                                  src={selectedCharacter.avatar || "/placeholder.svg"}
                                  alt={selectedCharacter.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Видео пользователя */}
                      {!isCameraOff && (
                        <div className="absolute bottom-2 right-2 h-20 w-28 overflow-hidden rounded-xl border border-white/20 bg-black/40 shadow-lg">
                          <video
                            ref={userVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="h-full w-full transform object-cover scale-x-[-1]"
                          />
                        </div>
                      )}

                      {/* Статусы */}
                      <div className="absolute left-2 top-2 rounded-full bg-blue-100 px-2 py-1 text-[11px] font-medium text-blue-800">
                        <span className="mr-1">{currentLanguage.flag}</span>
                        {currentLanguage.name}
                      </div>
                      <div
                        className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[11px] font-medium ${
                          isListening && !isMicMuted
                            ? "bg-green-100 text-green-800"
                            : isAiSpeaking
                              ? "bg-purple-100 text-purple-800"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isAiSpeaking
                          ? t("Speaking…")
                          : isListening && !isMicMuted
                            ? t("Listening…")
                            : t("Paused")}
                      </div>
                    </div>
                  </div>

                  {/* Кнопки управления */}
                  <div className="mb-2 flex items-center justify-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={toggleMic}
                      className={`h-10 w-10 rounded-full ${
                        isMicMuted
                          ? "bg-rose-50 text-rose-600"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {isMicMuted ? (
                        <MicOff className="h-5 w-5" />
                      ) : (
                        <Mic className="h-5 w-5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={toggleCamera}
                      className={`h-10 w-10 rounded-full ${
                        isCameraOff
                          ? "bg-rose-50 text-rose-600"
                          : "bg-slate-50 text-slate-700"
                      }`}
                    >
                      {isCameraOff ? (
                        <CameraOff className="h-5 w-5" />
                      ) : (
                        <Camera className="h-5 w-5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={toggleSound}
                      className={`h-10 w-10 rounded-full ${
                        isSoundEnabled
                          ? "bg-slate-50 text-slate-700"
                          : "bg-rose-50 text-rose-600"
                      }`}
                    >
                      {isSoundEnabled ? (
                        <Volume2 className="h-5 w-5" />
                      ) : (
                        <VolumeX className="h-5 w-5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      onClick={endCall}
                      className="h-10 w-10 rounded-full bg-rose-600 text-white hover:bg-rose-700"
                    >
                      <Phone className="h-5 w-5 rotate-180" />
                    </Button>
                  </div>

                  {error && (
                    <div className="rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Правая часть: текстовый диалог */}
            <div className="flex w-full flex-col p-4 md:w-1/2">
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-2">
                  {aiResponse && (
                    <div className="rounded-2xl bg-emerald-50 px-3 py-3 text-xs md:text-sm text-slate-900">
                      <p className="mb-1 flex items-center gap-1 font-medium text-emerald-800">
                        <Brain className="h-3.5 w-3.5" />
                        {selectedCharacter
                          ? selectedCharacter.name
                          : t("AI Psychologist")}
                      </p>
                      <p>{aiResponse}</p>
                    </div>
                  )}

                  {transcript && (
                    <div className="rounded-2xl bg-slate-100 px-3 py-3 text-xs md:text-sm text-slate-900">
                      <p className="mb-1 font-medium text-slate-700">
                        {t("You said in {{language}}:", {
                          language: currentLanguage.name,
                        })}
                      </p>
                      <p>{transcript}</p>
                    </div>
                  )}

                  {!aiResponse && !transcript && !isCallActive && (
                    <div className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-xs text-slate-700">
                      <p className="mb-1 font-medium text-slate-900">
                        {t("What you can talk about")}
                      </p>
                      <p>
                        {t(
                          "You can describe anxiety, sleep problems, burnout, conflicts, lack of motivation or anything else that worries you.",
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {isListening && !isMicMuted && (
                <div className="mt-2 flex justify-center">
                  <div className="flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700">
                    <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    {t("Listening in {{language}}...", {
                      language: currentLanguage.name,
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Кнопка закрытия поверх */}
          <button
            type="button"
            onClick={() => {
              endCall()
              onClose()
            }}
            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-white hover:bg-black/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
