"use client"

import { useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Phone, Brain, Mic, MicOff, Loader2, Sparkles } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"

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
  gender?: "female" | "male"
}

const TURBOTA_AGENT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL || ""

const FALLBACK_CHAT_API = "/api/chat"

function extractAnswer(data: any): string {
  if (!data) return ""

  if (typeof data === "string") return data.trim()

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
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [networkError, setNetworkError] = useState<string | null>(null)

  const effectiveEmail = userEmail || user?.email || "guest@example.com"
  const voiceGenderRef = useRef<"female" | "male">("female")

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const pendingStopSendRef = useRef(false)
  const isSttBusyRef = useRef(false)

  const isCallActiveRef = useRef(false)
  const isAiSpeakingRef = useRef(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // endpointing (тишина)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const analyserDataRef = useRef<Uint8Array | null>(null)
  const rafRef = useRef<number | null>(null)

  const lastVoiceAtRef = useRef<number>(0)
  const segmentStartAtRef = useRef<number>(0)
  const hasSpeechRef = useRef(false)

  const END_SILENCE_MS = 2000
  const MAX_SEGMENT_MS = 45000
  const RMS_THRESHOLD = 0.015

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  function logDebug(...args: any[]) {
    // eslint-disable-next-line no-console
    console.log(...args)
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

  function getCurrentGender(): "MALE" | "FEMALE" {
    return voiceGenderRef.current === "male" ? "MALE" : "FEMALE"
  }

  useEffect(() => {
    if (!isCallActive) {
      setIsListening(false)
      return
    }
    setIsListening(!isMicMuted && !isAiSpeaking)
  }, [isCallActive, isMicMuted, isAiSpeaking])

  async function sendSttBlob(blob: Blob) {
    if (!isCallActiveRef.current) return
    if (isSttBusyRef.current) return

    // защита от пустых/крошечных блобов
    if (!blob || blob.size < 1200) return

    try {
      isSttBusyRef.current = true

      logDebug("[STT] send blob size=", blob.size, "type=", blob.type || "")

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
          "x-lang": computeLangCode(),
        },
        body: blob,
      })

      const raw = await res.text()
      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok || !data || data.success === false) {
        console.error("[STT] error:", res.status, raw)
        return
      }

      const text = String(data.text || "").trim()
      logDebug('[STT] text="' + text + '"')

      if (!text) return
      if (isAiSpeakingRef.current) return
      if (isMicMuted) return

      const userMsg: VoiceMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text,
      }

      setMessages((prev) => [...prev, userMsg])
      await handleUserText(text)
    } catch (e) {
      console.error("[STT] fatal:", e)
    } finally {
      isSttBusyRef.current = false
    }
  }

  async function handleUserText(text: string) {
    const langCode =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    const resolvedWebhook =
      (webhookUrl && webhookUrl.trim()) ||
      TURBOTA_AGENT_WEBHOOK_URL.trim() ||
      FALLBACK_CHAT_API

    logDebug("[CHAT] ->", resolvedWebhook, "lang=", langCode)

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

      if (!res.ok) throw new Error(`Chat API error: ${res.status}`)

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {
        // ok
      }

      let answer = extractAnswer(data)
      if (!answer) {
        answer = t("I'm sorry, I couldn't process your message. Please try again.")
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

  function cleanupAnalyser() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    analyserRef.current = null
    analyserDataRef.current = null

    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close()
      } catch {}
      audioCtxRef.current = null
    }
  }

  function stopRecorder(reason: "silence" | "end") {
    const rec = mediaRecorderRef.current
    if (!rec) return
    if (rec.state === "inactive") return

    pendingStopSendRef.current = reason === "silence"

    try {
      rec.stop()
    } catch (e) {
      console.error("Recorder stop error", e)
    }
  }

  function createRecorder(stream: MediaStream) {
    const options: MediaRecorderOptions = {}

    if (typeof MediaRecorder !== "undefined") {
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options.mimeType = "audio/webm;codecs=opus"
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        options.mimeType = "audio/webm"
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        options.mimeType = "audio/mp4"
      }
    }

    const recorder = new MediaRecorder(stream, options)

    recorder.onstart = () => {
      logDebug("[Recorder] onstart mime=", recorder.mimeType || "")
    }

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        audioChunksRef.current.push(event.data)
        logDebug("[Recorder] data size=", event.data.size, "chunks=", audioChunksRef.current.length)
      }
    }

    recorder.onstop = () => {
      logDebug("[Recorder] onstop pendingSend=", pendingStopSendRef.current)

      const shouldSend = pendingStopSendRef.current
      pendingStopSendRef.current = false

      const mime = recorder.mimeType || audioChunksRef.current[0]?.type || "audio/webm"
      const blob = new Blob(audioChunksRef.current, { type: mime })
      audioChunksRef.current = []
      hasSpeechRef.current = false
      segmentStartAtRef.current = Date.now()
      lastVoiceAtRef.current = Date.now()

      if (shouldSend && blob.size >= 1200 && !isAiSpeakingRef.current) {
        void sendSttBlob(blob)
      }

      // перезапуск сегмента, если звонок ещё активен
      if (isCallActiveRef.current) {
        try {
          const next = createRecorder(stream)
          mediaRecorderRef.current = next
          next.start(250) // частые маленькие куски — стабильно на разных девайсах
          if (isMicMuted || isAiSpeakingRef.current) {
            try {
              next.pause()
            } catch {}
          }
        } catch (e) {
          console.error("[Recorder] restart error", e)
        }
      }
    }

    recorder.onerror = (event: any) => {
      console.error("[Recorder] error", event)
    }

    return recorder
  }

  function startAnalyser(stream: MediaStream) {
    try {
      const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AC) return

      const ctx: AudioContext = new AC()
      audioCtxRef.current = ctx

      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      src.connect(analyser)

      const data = new Uint8Array(analyser.fftSize)
      analyserRef.current = analyser
      analyserDataRef.current = data

      lastVoiceAtRef.current = Date.now()
      segmentStartAtRef.current = Date.now()
      hasSpeechRef.current = false

      const tick = () => {
        if (!isCallActiveRef.current) return

        const an = analyserRef.current
        const arr = analyserDataRef.current
        if (an && arr) {
          an.getByteTimeDomainData(arr)

          let sum = 0
          for (let i = 0; i < arr.length; i++) {
            const v = (arr[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / arr.length)

          const now = Date.now()

          if (!isAiSpeakingRef.current && !isMicMuted) {
            if (rms > RMS_THRESHOLD) {
              hasSpeechRef.current = true
              lastVoiceAtRef.current = now
            }

            // если была речь и наступила тишина — закрываем сегмент и отправляем
            if (
              hasSpeechRef.current &&
              now - lastVoiceAtRef.current > END_SILENCE_MS &&
              mediaRecorderRef.current &&
              mediaRecorderRef.current.state === "recording"
            ) {
              logDebug("[VAD] silence -> stop segment")
              stopRecorder("silence")
            }

            // защита от слишком длинного сегмента
            if (
              hasSpeechRef.current &&
              now - segmentStartAtRef.current > MAX_SEGMENT_MS &&
              mediaRecorderRef.current &&
              mediaRecorderRef.current.state === "recording"
            ) {
              logDebug("[VAD] max segment -> stop segment")
              stopRecorder("silence")
            }
          }
        }

        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)

      // иногда контекст стартует suspended
      if (ctx.state === "suspended") {
        void ctx.resume().catch(() => {})
      }
    } catch (e) {
      console.error("[VAD] init error", e)
    }
  }

  function speakText(text: string) {
    if (typeof window === "undefined") return

    const cleanText = String(text || "").trim()
    if (!cleanText) return

    const langCode = computeLangCode()
    const gender = getCurrentGender()

    const beginSpeaking = () => {
      isAiSpeakingRef.current = true
      setIsAiSpeaking(true)

      // во время TTS не слушаем и не буферим пользовательскую речь
      hasSpeechRef.current = false
      audioChunksRef.current = []

      const rec = mediaRecorderRef.current
      if (rec && rec.state === "recording") {
        try {
          rec.pause()
        } catch {}
      }
    }

    const finishSpeaking = () => {
      isAiSpeakingRef.current = false
      setIsAiSpeaking(false)

      const rec = mediaRecorderRef.current
      if (rec && rec.state === "paused" && isCallActiveRef.current && !isMicMuted) {
        try {
          rec.resume()
        } catch {}
      }

      lastVoiceAtRef.current = Date.now()
      segmentStartAtRef.current = Date.now()
      hasSpeechRef.current = false
    }

    ;(async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText, language: langCode, gender }),
        })

        const raw = await res.text()
        let data: any = null
        try {
          data = raw ? JSON.parse(raw) : null
        } catch {
          data = null
        }

        if (!res.ok || !data || data.success === false || !data.audioContent) {
          console.error("[TTS] API error", data || raw)
          return
        }

        const audioUrl = `data:audio/mp3;base64,${data.audioContent}`

        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }

        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onended = () => {
          finishSpeaking()
          audioRef.current = null
        }
        audio.onerror = () => {
          finishSpeaking()
          audioRef.current = null
        }

        beginSpeaking()

        try {
          await audio.play()
        } catch (e) {
          console.error("[TTS] play() rejected", e)
          finishSpeaking()
        }
      } catch (e) {
        console.error("[TTS] fetch error", e)
      }
    })()
  }

  const startCall = async (gender: "female" | "male") => {
    voiceGenderRef.current = gender

    setIsConnecting(true)
    setNetworkError(null)

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setNetworkError(
          t("Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari."),
        )
        setIsConnecting(false)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      isCallActiveRef.current = true
      setIsCallActive(true)

      // рекордер-сегменты
      audioChunksRef.current = []
      pendingStopSendRef.current = false
      isSttBusyRef.current = false

      const recorder = createRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.start(250)

      // анализатор тишины (чтобы не “не дослушивает”)
      startAnalyser(stream)

      setIsConnecting(false)

      logDebug("[CALL] started gender=", gender)
    } catch (error: any) {
      console.error("[CALL] getUserMedia error:", error)

      const name = error?.name
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(
          t("Microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page."),
        )
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setNetworkError(t("No microphone was found on this device. Please check your hardware."))
      } else {
        setNetworkError(
          t("Could not start microphone. Check permissions in the browser and system settings, then try again."),
        )
      }

      setIsConnecting(false)
      isCallActiveRef.current = false
      setIsCallActive(false)
    }
  }

  const endCall = () => {
    isCallActiveRef.current = false
    setIsCallActive(false)
    setIsMicMuted(false)
    isAiSpeakingRef.current = false
    setIsAiSpeaking(false)
    setNetworkError(null)
    setIsListening(false)

    pendingStopSendRef.current = false
    audioChunksRef.current = []
    hasSpeechRef.current = false

    cleanupAnalyser()

    const rec = mediaRecorderRef.current
    mediaRecorderRef.current = null
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop()
      } catch {}
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {}
      })
      mediaStreamRef.current = null
    }

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
  }

  const toggleMic = () => {
    const next = !isMicMuted
    setIsMicMuted(next)

    const rec = mediaRecorderRef.current
    if (!rec) return

    if (next) {
      if (rec.state === "recording") {
        try {
          rec.pause()
        } catch {}
      }
    } else {
      if (rec.state === "paused" && isCallActiveRef.current && !isAiSpeakingRef.current) {
        try {
          rec.resume()
        } catch {}
      }
      lastVoiceAtRef.current = Date.now()
      segmentStartAtRef.current = Date.now()
      hasSpeechRef.current = false
    }
  }

  useEffect(() => {
    if (!isOpen) {
      endCall()
      setMessages([])
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
    ? t("In crisis situations, please contact local emergency services immediately.")
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
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 pr-10 text-base font-semibold sm:text-lg">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Phone className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 break-words">
                    {t("Voice session with AI-psychologist")}
                  </span>
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {t("You can talk out loud, the assistant will listen, answer and voice the reply.")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex h-[500px] flex-col md:h-[540px]">
            <ScrollArea className="flex-1 px-5 pb-2 pt-4">
              <div ref={scrollRef} className="max-h-full space-y-3 pr-1 text-xs md:text-sm">
                {!isCallActive && messages.length === 0 && (
                  <div className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-slate-700">
                    <p className="mb-1 font-medium text-slate-900">{t("How it works")}</p>
                    <p className="mb-2">
                      {t("Choose a voice and start the session. The assistant will listen to you and answer like a real psychologist.")}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {t("You can switch between female and male voice by ending the call and starting again with a different option.")}
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
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
                          {msg.gender && (
                            <span className="ml-1 rounded-full bg-emerald-100 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                              {msg.gender === "female" ? t("Female voice") : t("Male voice")}
                            </span>
                          )}
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
                      {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
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

                  <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
                    <Button
                      type="button"
                      onClick={() => void startCall("female")}
                      disabled={isConnecting}
                      className={`h-11 flex-1 rounded-full px-5 text-xs font-semibold shadow-sm sm:max-w-xs ${
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
                      onClick={() => void startCall("male")}
                      disabled={isConnecting}
                      className={`h-11 flex-1 rounded-full px-5 text-xs font-semibold shadow-sm sm:max-w-xs ${
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
