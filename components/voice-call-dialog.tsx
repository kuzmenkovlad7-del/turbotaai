// components/voice-call-dialog.tsx
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
import { generateGoogleTTS, shouldUseGoogleTTS } from "@/lib/google-tts"

declare global {
  interface Window {
    SpeechRecognition?: any
    webkitSpeechRecognition?: any
  }
}

type VoiceGender = "female" | "male"

interface VoiceCallDialogProps {
  isOpen: boolean
  onClose: () => void
  onError?: (error: Error) => void
  userEmail?: string
  /** Можно передать свой вебхук, но по умолчанию берём из env */
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

// Dr. Alexander's Google Cloud TTS credentials for voice calls
// (ровно как у старых разработчиков)
const VOICE_CALL_GOOGLE_TTS_CREDENTIALS = {
  type: "service_account",
  project_id: "strong-maker-471022-s6",
  private_key_id: "dc48898af9911d21c7959fd5b13bb28db7ea1354",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCuFvlHiJgmSpjv\n9stiMzxxidgqxcN2/ralj7zgkkjXXhOgikfeOhBpjvjBeLDgLxNynA7DjoQ8wHbf\ngdrRuCqnrg83NC/FXTLHDRXXLW+megwcNLu3Kl7gR7q8iABBw1FaZxFnjduejnti\nAxL3ZQnAFB9Uw2U9bQBh2TejD225TEJnyqiuecVD9pkAZE8aeN5ZgPnljLMjzkfk\njKSeZMU+2kHdcs4YCQ4ShNG2C7eL7mWsj1RpG9KKnOlkMlaZ8noM++pO4q7mCzc5\nDOUDv9gpCXKG1324KgZug1k3KN9jlyTdGs7r/MFcUHFRNWUOpCMdxkIdPLRMlWJT\nlF7uQabxAgMBAAECggEABbY6wRJV/aGicXMdOrBYKhh9929MKb4TM4zrA0pBahGL\n3s9SqtOoYLJAbqadVQmuX2sH3/ov1AdzjwNFcO6UNbK0DJlhfN4BMb836Xqz6Fgm\nSBGh3BFfkgfAdHmY2o+EPo1VqJpiq4ncuftEVsohnwP6AC+2BWUrZ0p3dRnnPXZZ\nad02aThfaG73awScY5T0rotCIlq5M2z748EoBKHPUKELFunq5EiPiQfSIynO/Gpm\nayNtJ8OH8eQXNEnr5ixa/lo3L3g8w2cA+DnMTrFX1UGsbgoGgbY9/8c4bSEAcjUA\na6U8NxTb9jqjDcnIeXmG6XW3Qhhu385EwqvGQSg4HQKBgQm2AQfF/RKkjbKworS\nXZfaBVgsMqR7pkqnOX54Fr/Y0mkdY6qjh4rG+OBo2GHLn+VRLSbWVSmpy962cZWo\nXHdi9n4rMSXApxLoYdb9pNeYrNO6uxxC+DM7R2tTI8J6LtyuTEsw9s/AOYkP/Skf\nUswHgqexqpZ3pAnZS3Ova7njRQKBgQDBD6gGwOa7krhpfgwJnhd7ver+Bar8VN1E\n2QFnCpETx2NGtZtOKwD2k+Zn+Y8dv/+TSaSj6kERgjqDBvSj/XU8kNN2Wdc22nwW\nnnLTo2fusaKpZP3OWdgNUMv7cC7RKjK5ZecO0JZGRF7f+6N4zs2707cbxAf0qR+S\nzTDbNii5vQKBgQCWe0bkhhcH7ZyuPHeGfuCYjVdXKIQ03shXjpE084+IZlGDiQ8Z\nnygGYQLZFgVaWheA/XAN1GJef7nlMNIgeHaTGqBQw68akU8wEWe23Rh2PGOhnIvl\n1CqBgCMkhXEneRj+vlldx+bSJi+FLsD53F2In9F1bgC8aUDKV/dH6W+6CQKBgQCy\nA4quN35JJH9QHj5hO9lxauvcMEO6CVJBYkrtxQuCjk4W6+t5ByQLONKxuqXhC6FQ\nIQ5jaeN3jnn/SRGYiGNqZivlq+9Kj+jtPkqopLp3mGlhAlMYyzTxCjgb7xPsH5nH\n45NK0MBPqElHBBN2mFGRSCVFv9qKGMuZJARRjL2+jQKBgQDVV50qRixSs2PkfbQa\n+NsCz16EHBFTz8mGkPtNZtWB2eZUK3toxmDw+iZormjPN8IxdgVjUmH4nA+PVMg9\nzcg+vXDBQlkD+lr3LDxi6vWfThbC1aY8W34qCjPBFYYPGH8W8sWUMSi388I5P3cI\ntI/Wlzv7csphuz620VfkkJlHjw==\n-----END PRIVATE KEY-----\n",
  client_email: "tts-service-1@strong-maker-471022-s6.iam.gserviceaccount.com",
  client_id: "103107984061473463379",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/tts-service-1%40strong-maker-471022-s6.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
}

// Текущие конфиги голосов — можно потом дать Ольге на ревью
const VOICE_CALL_CONFIGS = {
  uk: {
    female: {
      languageCode: "uk-UA",
      name: "uk-UA-Chirp3-HD-Schedar",
      ssmlGender: "FEMALE",
    },
    male: {
      languageCode: "uk-UA",
      name: "uk-UA-Standard-A",
      ssmlGender: "MALE",
    },
  },
}

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

// вспомогательно: базовый код языка для TTS ("uk" / "ru" / "en")
function extractBaseLang(langRaw: string): string {
  if (!langRaw) return "uk"
  if (langRaw.startsWith("uk")) return "uk"
  if (langRaw.startsWith("ru")) return "ru"
  if (langRaw.startsWith("en")) return "en"
  return "uk"
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
  const [voiceGender, setVoiceGender] = useState<VoiceGender>("female")

  const recognitionRef = useRef<any | null>(null)
  const isRecognitionActiveRef = useRef(false)

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const isAiSpeakingRef = useRef(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)

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

  function computeBaseLangCode(): string {
    const raw =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    return extractBaseLang(raw)
  }

  // ---------- управление SpeechRecognition (единая точка) ----------

  function ensureRecognitionRunning() {
    if (typeof window === "undefined") return

    const shouldListen =
      isCallActiveRef.current &&
      !isMicMutedRef.current &&
      !isAiSpeakingRef.current

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition

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
        // если ассистент говорит — игнорируем всё, чтобы не слушать его озвучку
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
        if (e?.name !== "InvalidStateError") {
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

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
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

  // ---------- озвучка ответа (Google TTS + fallback к browser TTS) ----------

  async function speakText(text: string, genderOverride?: VoiceGender) {
    if (typeof window === "undefined") return
    const clean = text?.toString().trim()
    if (!clean) return

    const baseLang = computeBaseLangCode()
    const bcpLang = computeLangCode()
    const gender = genderOverride || voiceGender

    const startSpeaking = () => {
      setIsAiSpeaking(true)
      isAiSpeakingRef.current = true
      // пока говорим — слушать не нужно
      ensureRecognitionRunning()
    }

    const finishSpeaking = () => {
      setIsAiSpeaking(false)
      isAiSpeakingRef.current = false
      // договорили — снова начинаем слушать, если звонок активен и мик не выключен
      ensureRecognitionRunning()
    }

    // 1) Пытаемся использовать Google Cloud TTS (как в старом проекте)
    try {
      if (shouldUseGoogleTTS(baseLang)) {
        startSpeaking()

        const audioDataUrl = await generateGoogleTTS(
          clean,
          baseLang,
          gender,
          VOICE_CALL_GOOGLE_TTS_CREDENTIALS,
          VOICE_CALL_CONFIGS,
        )

        const audio = new Audio(audioDataUrl)
        audio.crossOrigin = "anonymous"
        audio.onended = () => {
          finishSpeaking()
        }
        audio.onerror = () => {
          console.error("Google TTS audio error, falling back to browser speech")
          finishSpeaking()
        }

        // на всякий случай глушим встроенный speechSynthesis
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel()
        }

        try {
          await audio.play()
        } catch (e) {
          console.error("Failed to play Google TTS audio", e)
          finishSpeaking()
        }
        return
      }
    } catch (e) {
      console.error("Google TTS failed, fallback to browser speech", e)
      // уйдём в fallback ниже
    }

    // 2) Fallback: стандартный browser speechSynthesis (как у тебя было)
    if (!window.speechSynthesis) {
      // если даже speechSynthesis нет — просто ничего не говорим
      return
    }

    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang = bcpLang
    utterance.rate = 1
    utterance.pitch = 1

    utterance.onstart = startSpeaking
    utterance.onend = finishSpeaking
    utterance.onerror = () => {
      finishSpeaking()
    }

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  // ---------- отправка текста в n8n / TurbotaAI-агент ----------

  async function handleUserText(text: string) {
    const langRaw =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    const langBase = extractBaseLang(langRaw)
    const voiceLang = computeLangCode()

    // 1) prop → 2) env → 3) /api/chat
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
          language: langBase, // "uk" / "ru" / "en" — для агента
          voiceLanguage: voiceLang, // "uk-UA" / "ru-RU" / "en-US" — для контекста
          gender: voiceGender, // "female" | "male"
          email: effectiveEmail,
          mode: "voice",
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
      void speakText(answer, voiceGender)
    } catch (error: any) {
      console.error("Voice call error:", error)
      setNetworkError(t("Connection error. Please try again."))
      if (onError && error instanceof Error) onError(error)
    }
  }

  // ---------- управление звонком / микрофоном ----------

  const startCall = (gender: VoiceGender) => {
    setIsConnecting(true)
    setNetworkError(null)

    setVoiceGender(gender)

    isMicMutedRef.current = false
    setIsMicMuted(false)

    setTimeout(() => {
      isCallActiveRef.current = true
      setIsCallActive(true)
      setIsConnecting(false)
      ensureRecognitionRunning()
    }, 200)
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

  const userEmailDisplay = effectiveEmail

  const statusText = !isCallActive
    ? t(
        "In crisis situations, please contact local emergency services immediately.",
      )
    : isAiSpeaking
      ? t("Assistant is speaking…")
      : isMicMuted
        ? t("Paused. Turn on microphone to continue.")
        : isListening
          ? t("Listening… you can speak.")
          : t("Waiting… you can start speaking at any moment.")

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
                    <p>
                      {t(
                        "Press the button to start the call. Allow microphone access, then speak as if with a real psychologist.",
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
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="text-[11px] text-slate-500">
                    {t("Choose voice for the session")}:
                    <span className="ml-1 font-medium text-slate-800">
                      {voiceGender === "female"
                        ? t("Female voice")
                        : t("Male voice")}
                    </span>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      onClick={() => startCall("female")}
                      disabled={isConnecting}
                      className="h-9 rounded-full bg-indigo-600 px-4 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-70"
                    >
                      {isConnecting && voiceGender === "female" ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          {t("Connecting")}
                        </>
                      ) : (
                        <>
                          <span className="mr-1">👩</span>
                          {t("Female voice")}
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => startCall("male")}
                      disabled={isConnecting}
                      variant="outline"
                      className="h-9 rounded-full px-4 text-xs font-medium"
                    >
                      {isConnecting && voiceGender === "male" ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          {t("Connecting")}
                        </>
                      ) : (
                        <>
                          <span className="mr-1">👨</span>
                          {t("Male voice")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {isCallActive && (
                <div className="flex justify-between items-center text-[11px] text-slate-500">
                  <span>
                    {t("User")}: {userEmailDisplay}
                  </span>
                  <span>
                    {t("Voice")}:{" "}
                    {voiceGender === "female"
                      ? t("Female")
                      : t("Male")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
