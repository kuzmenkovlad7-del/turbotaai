"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Phone, X, Wifi, WifiOff, Brain, Mic, MicOff } from "lucide-react"

declare global {
  interface Window {
    SpeechRecognition?: any
    webkitSpeechRecognition?: any
  }
}

interface VoiceCallDialogProps {
  isOpen: boolean
  onClose: () => void
  onError?: (error: Error) => void
  userEmail?: string
}

export default function VoiceCallDialog({
  isOpen,
  onClose,
  onError,
  userEmail,
}: VoiceCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female")
  const [transcript, setTranscript] = useState("")
  const [aiResponse, setAiResponse] = useState("")
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected"
  >("disconnected")

  const recognitionRef = useRef<any | null>(null)

  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  // Когда модалка закрывается — всё гасим
  useEffect(() => {
    if (!isOpen) {
      stopEverything()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const stopEverything = useCallback(() => {
    setIsCallActive(false)
    setIsListening(false)
    setIsAiSpeaking(false)
    setTranscript("")
    setAiResponse("")
    setConnectionStatus("disconnected")
    setNetworkError(null)

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
  }, [])

  // Запуск speech recognition
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
      console.error("Speech recognition error", event)
      setNetworkError(t("Error while listening. Please try again."))
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      // Если звонок ещё активен и микрофон не мутнут — аккуратно перезапускаем
      if (isCallActive && !isMicMuted) {
        setTimeout(() => {
          try {
            recognition.start()
          } catch (e) {
            console.error(e)
          }
        }, 400)
      }
    }

    recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1]
      if (!last || !last.isFinal) return

      const text = last[0]?.transcript?.trim()
      if (!text) return

      setTranscript((prev) => (prev ? `${prev} ${text}` : text))
      handleUserText(text)
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
    } catch (e) {
      console.error("Cannot start recognition", e)
      setNetworkError(
        t("Could not start microphone. Check permissions and try again."),
      )
    }
  }, [currentLanguage.code, isCallActive, isMicMuted, t])

  // Озвучка ответа
  const speakText = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return

      const utterance = new SpeechSynthesisUtterance(text)

      utterance.lang = currentLanguage.code.startsWith("uk")
        ? "uk-UA"
        : currentLanguage.code.startsWith("ru")
          ? "ru-RU"
          : "en-US"

      const voices = window.speechSynthesis.getVoices()
      if (voices.length) {
        const langPrefix = utterance.lang.slice(0, 2)
        let candidates = voices.filter((v) => v.lang.startsWith(langPrefix))
        if (!candidates.length) {
          candidates = voices.filter((v) => v.lang.startsWith("en"))
        }

        const genderHints =
          voiceGender === "female"
            ? ["female", "woman", "girl", "zira", "samantha"]
            : ["male", "man", "boy", "david", "alex"]

        const selected =
          candidates.find((v) =>
            genderHints.some((h) => v.name.toLowerCase().includes(h)),
          ) || candidates[0]

        if (selected) utterance.voice = selected
      }

      utterance.rate = 1
      utterance.pitch = 1
      utterance.onstart = () => setIsAiSpeaking(true)
      utterance.onend = () => setIsAiSpeaking(false)
      utterance.onerror = () => setIsAiSpeaking(false)

      window.speechSynthesis.speak(utterance)
    },
    [currentLanguage.code, voiceGender],
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
            language: currentLanguage.code,
            email: effectiveEmail,
            mode: "voice",
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
      } catch (error: any) {
        console.error("Voice call error:", error)
        setNetworkError(t("Connection error. Please try again."))
        if (onError && error instanceof Error) onError(error)
      }
    },
    [currentLanguage.code, effectiveEmail, onError, speakText, t],
  )

  // Старт звонка
  const startCall = useCallback(
    (gender: "female" | "male") => {
      setVoiceGender(gender)
      setIsConnecting(true)
      setNetworkError(null)

      setTimeout(() => {
        setIsCallActive(true)
        setIsConnecting(false)
        startRecognition()
      }, 200)
    },
    [startRecognition],
  )

  // Завершение звонка
  const endCall = useCallback(() => {
    stopEverything()
  }, [stopEverything])

  // Мут/анмут
  const toggleMic = () => {
    const next = !isMicMuted
    setIsMicMuted(next)

    if (next) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          console.error(e)
        }
      }
      setIsListening(false)
    } else if (isCallActive) {
      startRecognition()
    }
  }

  if (!isOpen) return null

  const userEmailDisplay = effectiveEmail

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col h-[80vh] max-h-[600px] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-primary-600 text-white rounded-t-xl">
          <div className="flex flex-col">
            <h3 className="font-bold text-lg">
              {voiceGender === "female" ? t("Female Voice Call") : t("Male Voice Call")}
            </h3>
            <div className="text-xs text-slate-200">
              {t("User")}: {userEmailDisplay}
            </div>
            <div className="text-xs text-slate-200 mt-1">
              {t("Language")}: {currentLanguage.name} {currentLanguage.flag}
            </div>
          </div>
          <div className="flex items-center space-x-1">
            {connectionStatus === "connected" ? (
              <Wifi className="h-4 w-4 text-green-300" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-300" />
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                endCall()
                onClose()
              }}
              className="text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col">
          {!isCallActive ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="h-24 w-24 rounded-full bg-primary-100 flex items-center justify-center mb-6">
                <Phone className="h-12 w-12 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-center">
                {t("Ready to start your voice session?")}
              </h3>
              <p className="text-gray-600 text-center mb-6">
                {t("Speak directly with our AI psychologist for immediate support.")}
              </p>

              <div className="flex flex-col space-y-3 w-full max-w-xs">
                <Button
                  className="bg-pink-500 hover:bg-pink-600 text-white px-8 py-3 flex items-center justify-center"
                  onClick={() => startCall("female")}
                  disabled={isConnecting}
                >
                  <span className="mr-2">👩</span>
                  {isConnecting && voiceGender === "female"
                    ? t("Connecting...")
                    : t("Start with Female Voice")}
                </Button>

                <Button
                  className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 flex items-center justify-center"
                  onClick={() => startCall("male")}
                  disabled={isConnecting}
                >
                  <span className="mr-2">👨</span>
                  {isConnecting && voiceGender === "male"
                    ? t("Connecting...")
                    : t("Start with Male Voice")}
                </Button>

                {networkError && (
                  <p className="text-xs text-center text-red-500 mt-2">
                    {networkError}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-center mb-4">
                  <div
                    className={`h-16 w-16 rounded-full flex items-center justify-center ${
                      isAiSpeaking ? "bg-green-100 animate-pulse" : "bg-gray-100"
                    }`}
                  >
                    <Brain
                      className={`h-8 w-8 ${
                        isAiSpeaking ? "text-green-600" : "text-gray-600"
                      }`}
                    />
                  </div>
                </div>

                {transcript && (
                  <div className="bg-blue-50 p-3 rounded-lg mb-4">
                    <p className="text-sm font-medium text-blue-700 mb-1">
                      {t("You said in {{language}}:", {
                        language: currentLanguage.name,
                      })}
                    </p>
                    <p className="text-sm text-blue-800">{transcript}</p>
                  </div>
                )}

                {aiResponse && (
                  <div className="bg-green-50 p-3 rounded-lg mb-4">
                    <p className="text-sm font-medium text-green-700 mb-1">
                      {t("AI Psychologist in {{language}}:", {
                        language: currentLanguage.name,
                      })}
                    </p>
                    <p className="text-sm text-green-800">{aiResponse}</p>
                  </div>
                )}

                {networkError && (
                  <p className="text-xs text-center text-red-500 mt-2">
                    {networkError}
                  </p>
                )}
              </div>

              <div className="flex justify-center space-x-4 pt-4 border-t">
                <Button
                  variant={isMicMuted ? "default" : "outline"}
                  size="icon"
                  onClick={toggleMic}
                  className={`h-12 w-12 rounded-full ${
                    isMicMuted
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={endCall}
                  className="h-12 w-12 rounded-full bg-red-500 hover:bg-red-600"
                >
                  <Phone className="h-5 w-5 transform rotate-[135deg]" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
