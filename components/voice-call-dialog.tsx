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
  const [debugLog, setDebugLog] = useState<string>(
    "ready; no events yet (debug log enabled временно)",
  )

  // реальный пол сессии, который всегда летит в /api/tts и в вебхук
  const voiceGenderRef = useRef<"female" | "male">("female")

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const isAiSpeakingRef = useRef(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)

  // audio-плеер для TTS
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // media stream для микрофона (особенно на мобилках)
  const micStreamRef = useRef<MediaStream | null>(null)

  // MediaRecorder + чанки для STT через /api/stt
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recorderActiveRef = useRef(false)
  const recorderChunksRef = useRef<Blob[]>([])

  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  // Скролл вниз при новых сообщениях / логах
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, debugLog])

  function appendDebug(line: string) {
    const ts = new Date().toISOString()
    setDebugLog((prev) =>
      prev ? `${prev}\n${ts} ${line}` : `${ts} ${line}`,
    )
    // параллельно кидаем в консоль для devtools
    // eslint-disable-next-line no-console
    console.log(line)
  }

  function computeLangCode(): string {
    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    if (lang.startsWith("uk")) return "uk-UA"
    if (lang.startsWith("ru")) return "ru-RU"
    return "en-US"
  }

  function getSttLanguage(): string {
    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    if (lang.startsWith("uk")) return "uk-ua"
    if (lang.startsWith("ru")) return "ru-ru"
    if (lang.startsWith("en")) return "en-us"
    return lang.toLowerCase()
  }

  function getCurrentGender(): "MALE" | "FEMALE" {
    const g = voiceGenderRef.current || "female"
    return g === "male" ? "MALE" : "FEMALE"
  }

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

      micStreamRef.current = stream
      setNetworkError(null)
      appendDebug("[getUserMedia] access granted")
      return true
    } catch (error: any) {
      // eslint-disable-next-line no-console
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

      appendDebug(`[getUserMedia] error=${name || "unknown"}`)
      return false
    }
  }

  function shouldRecord(): boolean {
    return (
      isCallActiveRef.current &&
      !isMicMutedRef.current &&
      !isAiSpeakingRef.current
    )
  }

  function stopRecorder() {
    if (recorderRef.current) {
      try {
        recorderRef.current.onstop = null
        recorderRef.current.onerror = null
        if (recorderRef.current.state === "recording") {
          recorderRef.current.stop()
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[Recorder] stop error", e)
      }
    }
    recorderActiveRef.current = false
    setIsListening(false)
  }

  async function sendSttChunk(blob: Blob) {
    if (blob.size === 0) {
      appendDebug("[Recorder] empty blob, skipping STT")
      return
    }

    const lang = getSttLanguage()
    appendDebug("[STT] sending chunk to /api/stt")

    try {
      const form = new FormData()
      form.append("file", blob, "audio.webm")
      form.append("language", lang)

      const res = await fetch("/api/stt", {
        method: "POST",
        body: form,
      })

      const raw = await res.text()
      appendDebug(
        `[STT] response status=${res.status} ok=${res.ok} raw=${raw.slice(0, 200)}`,
      )

      if (!res.ok) {
        setNetworkError(
          t("Error while processing your speech. Please try again."),
        )
        return
      }

      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      const text: string =
        (data && (data.text || data.transcript || data.result)) || ""

      if (typeof text === "string" && text.trim()) {
        const trimmed = text.trim()

        const userMsg: VoiceMessage = {
          id: `${Date.now()}-user`,
          role: "user",
          text: trimmed,
        }

        setMessages((prev) => [...prev, userMsg])
        await handleUserText(trimmed)
      }
    } catch (error: any) {
      appendDebug(`[STT] fetch error: ${String(error)}`)
      setNetworkError(t("Connection error. Please try again."))
      if (onError && error instanceof Error) onError(error)
    }
  }

  function startRecorderLoop() {
    if (typeof window === "undefined") return

    if (!micStreamRef.current) {
      appendDebug("[Recorder] no mic stream")
      setIsListening(false)
      return
    }

    if (!("MediaRecorder" in window)) {
      setNetworkError(
        t(
          "Voice input is not supported in this browser. Please use the latest version of Chrome, Edge or Safari.",
        ),
      )
      setIsListening(false)
      return
    }

    if (!shouldRecord()) {
      appendDebug("[Recorder] not starting (shouldRecord=false)")
      setIsListening(false)
      return
    }

    if (recorderActiveRef.current) {
      return
    }

    try {
      const recorder = new MediaRecorder(micStreamRef.current, {
        mimeType: "audio/webm",
      })
      recorderRef.current = recorder
      recorderActiveRef.current = true
      recorderChunksRef.current = []

      appendDebug("[Recorder] MediaRecorder created")

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recorderChunksRef.current.push(event.data)
        }
      }

      recorder.onerror = (event: any) => {
        recorderActiveRef.current = false
        setIsListening(false)
        appendDebug(
          `[Recorder] error: ${event.error?.name || "unknown error"}`,
        )
      }

      recorder.onstop = async () => {
        recorderActiveRef.current = false
        setIsListening(false)

        const blob = new Blob(recorderChunksRef.current, {
          type: "audio/webm",
        })
        recorderChunksRef.current = []

        if (blob.size > 0) {
          await sendSttChunk(blob)
        }

        if (shouldRecord()) {
          setTimeout(() => {
            startRecorderLoop()
          }, 600)
        }
      }

      setIsListening(true)
      recorder.start()

      setTimeout(() => {
        if (recorder.state === "recording") {
          try {
            recorder.stop()
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error("[Recorder] stop timer error", e)
          }
        }
      }, 3000)
    } catch (error: any) {
      recorderActiveRef.current = false
      setIsListening(false)
      appendDebug(`[Recorder] failed to start: ${String(error)}`)
    }
  }

  // ---------- озвучка ответа (OpenAI TTS через /api/tts, без браузерного TTS) ----------
  function speakText(text: string) {
    if (typeof window === "undefined") return

    const cleanText = text?.trim()
    if (!cleanText) return

    const langCode = computeLangCode() // "uk-UA" | "ru-RU" | "en-US"
    const gender = getCurrentGender() // "MALE" | "FEMALE"

    appendDebug(
      `[TTS] speakText lang=${langCode} gender=${gender} sample=${cleanText.slice(0, 80)}`,
    )

    const startSpeakingPhase = () => {
      setIsAiSpeaking(true)
      isAiSpeakingRef.current = true
      stopRecorder()
    }

    const stopSpeakingPhase = () => {
      setIsAiSpeaking(false)
      isAiSpeakingRef.current = false
      if (shouldRecord()) {
        startRecorderLoop()
      }
    }

    // сразу помечаем, что ассистент "говорит", чтобы не слушать свою озвучку
    startSpeakingPhase()

    ;(async () => {
      try {
        const payload = {
          text: cleanText,
          language: langCode,
          gender,
        }

        appendDebug("[TTS] Requesting /api/tts…")

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        const raw = await res.text()
        let data: any = null

        try {
          data = raw ? JSON.parse(raw) : null
        } catch {
          appendDebug(
            `[TTS] /api/tts returned non-JSON response: ${raw.slice(0, 200)}`,
          )
        }

        appendDebug(
          `[TTS] response status=${res.status} ok=${res.ok} body=${raw.slice(
            0,
            200,
          )}`,
        )

        if (!res.ok || !data || data.success === false) {
          // eslint-disable-next-line no-console
          console.error(
            "[TTS] API error",
            data?.error || res.statusText,
            data?.details || "",
          )
          setNetworkError(
            t(
              "Voice output is temporarily unavailable. Please read the assistant's reply on the screen.",
            ),
          )
          stopSpeakingPhase()
          return
        }

        let audioUrl: string | undefined = data.audioUrl

        if (!audioUrl && data.audioContent) {
          audioUrl = `data:audio/mp3;base64,${data.audioContent}`
        }

        if (!audioUrl) {
          appendDebug("[TTS] No audioUrl/audioContent in response")
          stopSpeakingPhase()
          return
        }

        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }

        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onplay = () => {
          // уже помечены как speaking, просто убеждаемся
          setIsAiSpeaking(true)
          isAiSpeakingRef.current = true
        }

        audio.onended = () => {
          audioRef.current = null
          stopSpeakingPhase()
        }

        audio.onerror = (e) => {
          // eslint-disable-next-line no-console
          console.error("[TTS] audio playback error:", e)
          audioRef.current = null
          stopSpeakingPhase()
        }

        try {
          await audio.play()
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("[TTS] play() rejected", e)
          audioRef.current = null
          stopSpeakingPhase()
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[TTS] fetch error:", error)
        appendDebug(`[TTS] fetch error: ${String(error)}`)
        stopSpeakingPhase()
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

    appendDebug(
      `[CHAT] sending to ${resolvedWebhook} lang=${langCode} gender=${voiceGenderRef.current}`,
    )

    try {
      const res = await fetch(resolvedWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          language: langCode,
          email: effectiveEmail,
          mode: "voice",
          gender: voiceGenderRef.current, // "female" | "male"
          voiceLanguage: computeLangCode(),
        }),
      })

      const raw = await res.text()
      appendDebug(
        `[CHAT] response status=${res.status} ok=${res.ok} body=${raw.slice(
          0,
          200,
        )}`,
      )

      if (!res.ok) {
        throw new Error(`Chat API error: ${res.status}`)
      }

      let data: any = raw

      try {
        data = JSON.parse(raw)
      } catch {
        // строка — ок
      }

      const answerRaw = extractAnswer(data)

      let answer =
        answerRaw ||
        t(
          "I'm sorry, I couldn't process your message. Please try again.",
        )

      const assistantMsg: VoiceMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: answer,
      }

      setMessages((prev) => [...prev, assistantMsg])
      speakText(answer)
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error("Voice call error:", error)
      setNetworkError(t("Connection error. Please try again."))
      if (onError && error instanceof Error) onError(error)
    }
  }

  function stopEverything() {
    appendDebug("[CALL] endCall")

    isCallActiveRef.current = false
    isMicMutedRef.current = false
    isAiSpeakingRef.current = false

    setIsCallActive(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setIsListening(false)
    setConnectionStatus("disconnected")
    setNetworkError(null)
    setIsConnecting(false)

    stopRecorder()

    if (typeof window !== "undefined" && (window as any).speechSynthesis) {
      ;(window as any).speechSynthesis.cancel()
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch (e) {
          // eslint-disable-next-line no-console
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

  // ---------- управление звонком / микрофоном ----------

  const startCall = async (gender: "female" | "male") => {
    voiceGenderRef.current = gender

    setIsConnecting(true)
    setNetworkError(null)

    isMicMutedRef.current = false
    setIsMicMuted(false)

    appendDebug(`[CALL] startCall gender=${gender}`)

    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent
      const mobile = /Android|iPhone|Mobile/i.test(ua)
      appendDebug(
        `[CALL] ua=${ua} mobile=${mobile} recorder=true href=${window.location.href}`,
      )
    }

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
    startRecorderLoop()
  }

  const endCall = () => {
    stopEverything()
  }

  const toggleMic = () => {
    const next = !isMicMuted
    setIsMicMuted(next)
    isMicMutedRef.current = next

    if (!next && isCallActiveRef.current) {
      // включили мик — продолжаем слушать
      if (!recorderActiveRef.current && !isAiSpeakingRef.current) {
        startRecorderLoop()
      }
    } else {
      // выключили мик — стоп рекордер
      stopRecorder()
    }
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

                {debugLog && (
                  <div className="rounded-2xl bg-slate-900 px-3 py-3 text-[10px] leading-snug text-slate-100 shadow-inner whitespace-pre-wrap font-mono">
                    <div className="mb-1 text-[10px] font-semibold">
                      Debug:
                    </div>
                    {debugLog}
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
                  <div className="flex w-full max-w-xs flex-col gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        void startCall("female")
                      }}
                      disabled={isConnecting}
                      className={`h-10 w-full rounded-full px-5 text-xs font-semibold shadow-sm flex items-center justify-center gap-2 ${
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
                      className={`h-10 w-full rounded-full px-5 text-xs font-semibold shadow-sm flex items-center justify-center gap-2 ${
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
