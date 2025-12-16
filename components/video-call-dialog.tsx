"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  Video,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  PhoneOff,
  Brain,
  Sparkles,
  Loader2,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"

interface VideoCallDialogProps {
  isOpen: boolean
  onClose: () => void
  onError?: (error: Error) => void
  userEmail?: string
  webhookUrl?: string
}

type Msg = {
  id: string
  role: "user" | "assistant"
  text: string
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

function diffTranscript(prev: string, full: string): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,!?;:«»"“”‚‘’…]/g, "")
      .replace(/\s+/g, " ")
      .trim()

  const f = (full || "").trim()
  if (!f) return ""
  if (!prev) return f

  const prevNorm = normalize(prev)
  const fullNorm = normalize(f)
  if (!prevNorm || !fullNorm) return f

  const prevWords = prevNorm.split(" ")
  const fullWords = fullNorm.split(" ")

  const maxCommon = Math.min(prevWords.length, fullWords.length)
  let common = 0
  while (common < maxCommon && prevWords[common] === fullWords[common]) {
    common++
  }

  if (common === 0) return f

  const rawTokens = f.split(/\s+/)
  if (common >= rawTokens.length) return ""
  return rawTokens.slice(common).join(" ").trim()
}

export default function VideoCallDialog({
  isOpen,
  onClose,
  onError,
  userEmail,
  webhookUrl,
}: VideoCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  const [isConnecting, setIsConnecting] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCamOff, setIsCamOff] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])

  const userVideoRef = useRef<HTMLVideoElement | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const sttBusyRef = useRef(false)
  const lastTranscriptRef = useRef("")
  const activeRef = useRef(false)

  const aiSpeakingRef = useRef(false)
  const micMutedRef = useRef(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const resolvedWebhook = useMemo(() => {
    return (
      (webhookUrl && webhookUrl.trim()) ||
      TURBOTA_AGENT_WEBHOOK_URL.trim() ||
      FALLBACK_CHAT_API
    )
  }, [webhookUrl])

  useEffect(() => {
    aiSpeakingRef.current = isAiSpeaking
  }, [isAiSpeaking])

  useEffect(() => {
    micMutedRef.current = isMicMuted
  }, [isMicMuted])

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

  async function maybeSendStt() {
    if (!activeRef.current) return
    if (sttBusyRef.current) return
    if (micMutedRef.current) return
    if (aiSpeakingRef.current) return
    if (!chunksRef.current.length) return

    const recMime = recorderRef.current?.mimeType || ""
    const firstChunkMime = chunksRef.current[0]?.type || ""
    const mimeType = (recMime || firstChunkMime || "audio/webm").toString()

    const blob = new Blob(chunksRef.current, { type: mimeType })
    if (blob.size < 8000) return

    try {
      sttBusyRef.current = true

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
        return
      }

      // если к моменту ответа ассистент говорит — игнор
      if (aiSpeakingRef.current || micMutedRef.current) return

      const fullText = (data.text || "").toString().trim()
      if (!fullText) return

      const prev = lastTranscriptRef.current
      const delta = diffTranscript(prev, fullText)
      lastTranscriptRef.current = fullText

      if (!delta) return

      setMessages((m) => [...m, { id: `${Date.now()}-u`, role: "user", text: delta }])
      await handleUserText(delta)
    } catch (e) {
      // молча
    } finally {
      sttBusyRef.current = false
    }
  }

  async function handleUserText(text: string) {
    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    try {
      const res = await fetch(resolvedWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          language: lang,
          email: effectiveEmail,
          mode: "video",
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

      setMessages((m) => [...m, { id: `${Date.now()}-a`, role: "assistant", text: answer }])
      speakText(answer)
    } catch (err: any) {
      setNetworkError(t("Connection error. Please try again."))
      if (onError && err instanceof Error) onError(err)
    }
  }

  function speakText(text: string) {
    const clean = (text || "").trim()
    if (!clean) return

    const langCode = computeLangCode()

    const beginSpeaking = () => {
      aiSpeakingRef.current = true
      setIsAiSpeaking(true)

      const rec = recorderRef.current
      if (rec && rec.state === "recording") {
        try {
          rec.pause()
        } catch {}
      }
    }

    const finishSpeaking = () => {
      aiSpeakingRef.current = false
      setIsAiSpeaking(false)

      const rec = recorderRef.current
      if (rec && rec.state === "paused" && activeRef.current && !micMutedRef.current) {
        try {
          rec.resume()
        } catch {}
      }
    }

    ;(async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: clean,
            language: langCode,
            gender: "FEMALE",
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
          return
        }

        const audioUrl = `data:audio/mp3;base64,${data.audioContent}`

        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }

        const audio = new Audio(audioUrl)
        audioRef.current = audio

        let finished = false
        const safeFinish = () => {
          if (finished) return
          finished = true
          finishSpeaking()
          audioRef.current = null
        }

        audio.onended = safeFinish
        audio.onerror = safeFinish

        beginSpeaking()
        try {
          await audio.play()
        } catch {
          safeFinish()
        }
      } catch {
        // ignore
      }
    })()
  }

  async function startSession() {
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
            "Microphone/Camera access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari.",
          ),
        )
        setIsConnecting(false)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: "user" },
      })

      streamRef.current = stream
      activeRef.current = true
      setIsActive(true)

      // Привязываем видео
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream
        try {
          await userVideoRef.current.play()
        } catch {
          // play может зареджектиться — не критично, srcObject уже установлен
        }
      }

      // Настраиваем MediaRecorder (для STT пишем аудио дорожку)
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

      const rec = new MediaRecorder(stream, options)
      recorderRef.current = rec
      chunksRef.current = []
      sttBusyRef.current = false
      lastTranscriptRef.current = ""

      rec.onstart = () => setIsListening(true)
      rec.onstop = () => setIsListening(false)
      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
          void maybeSendStt()
        }
      }

      rec.start(4000)

      setIsConnecting(false)
    } catch (err: any) {
      const name = err?.name
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(
          t(
            "Microphone/Camera is blocked for this site in the browser. Please allow access in the address bar and reload the page.",
          ),
        )
      } else {
        setNetworkError(
          t(
            "Could not start camera/microphone. Check permissions in the browser and system settings, then try again.",
          ),
        )
      }
      setIsConnecting(false)
      activeRef.current = false
      setIsActive(false)
      if (onError && err instanceof Error) onError(err)
    }
  }

  function stopSession() {
    activeRef.current = false
    setIsActive(false)
    setIsConnecting(false)
    setIsListening(false)
    setIsAiSpeaking(false)
    setIsMicMuted(false)
    setIsCamOff(false)

    chunksRef.current = []
    lastTranscriptRef.current = ""
    sttBusyRef.current = false

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    const rec = recorderRef.current
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop()
      } catch {}
    }
    recorderRef.current = null

    const s = streamRef.current
    if (s) {
      s.getTracks().forEach((tr) => {
        try {
          tr.stop()
        } catch {}
      })
    }
    streamRef.current = null

    if (userVideoRef.current) {
      try {
        userVideoRef.current.srcObject = null
      } catch {}
    }
  }

  function toggleMic() {
    const next = !isMicMuted
    setIsMicMuted(next)

    const s = streamRef.current
    if (s) {
      s.getAudioTracks().forEach((tr) => {
        tr.enabled = !next
      })
    }

    const rec = recorderRef.current
    if (!rec) return

    if (next) {
      if (rec.state === "recording") {
        try {
          rec.pause()
        } catch {}
      }
    } else {
      if (rec.state === "paused" && activeRef.current && !aiSpeakingRef.current) {
        try {
          rec.resume()
        } catch {}
      }
    }
  }

  function toggleCamera() {
    const next = !isCamOff
    setIsCamOff(next)

    const s = streamRef.current
    if (s) {
      s.getVideoTracks().forEach((tr) => {
        tr.enabled = !next
      })
    }
  }

  // авто-попытка стартануть при открытии (но без вечных повторов)
  const didAutoStartRef = useRef(false)
  useEffect(() => {
    if (!isOpen) {
      stopSession()
      setMessages([])
      setNetworkError(null)
      didAutoStartRef.current = false
      return
    }

    if (isOpen && !didAutoStartRef.current) {
      didAutoStartRef.current = true
      // Важно: стартуем асинхронно, а если iOS потребует жест — будет кнопка “Start”
      void startSession()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    return () => stopSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusText = !isActive
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
          stopSession()
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-3xl border-none bg-transparent p-0">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 pl-6 pr-14 pt-5 pb-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 text-base font-semibold leading-snug md:text-lg">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Video className="h-4 w-4" />
                  </span>
                  <span className="block min-w-0 break-words">
                    {t("Video session with AI-psychologist")}
                  </span>
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {t("You can talk out loud, the assistant will listen, answer and voice the reply.")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-0 md:grid-cols-[1.2fr_0.8fr]">
            <div className="border-b border-slate-100 p-4 md:border-b-0 md:border-r">
              <div className="relative overflow-hidden rounded-2xl bg-slate-950">
                <div className="aspect-video">
                  <video
                    ref={userVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                </div>

                {isCamOff && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70">
                    <div className="rounded-full bg-white/10 px-4 py-2 text-xs text-white">
                      {t("Camera is off")}
                    </div>
                  </div>
                )}

                {!isActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 p-4">
                    <Button
                      type="button"
                      onClick={() => void startSession()}
                      disabled={isConnecting}
                      className="h-11 rounded-full px-6 text-xs font-semibold"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("Connecting")}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          {t("Start video session")}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Sparkles className="h-3 w-3" />
                  {statusText}
                </div>

                {isActive && (
                  <div className="flex items-center gap-2">
                    {/* микрофон: только 2 режима, без миганий */}
                    <Button
                      type="button"
                      size="icon"
                      onClick={toggleMic}
                      className={`h-9 w-9 rounded-full border ${
                        isMicMuted
                          ? "border-rose-200 bg-rose-50 text-rose-600"
                          : "border-slate-200 bg-slate-900 text-white hover:bg-slate-800"
                      }`}
                    >
                      {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>

                    <Button
                      type="button"
                      size="icon"
                      onClick={toggleCamera}
                      className={`h-9 w-9 rounded-full border ${
                        isCamOff
                          ? "border-rose-200 bg-rose-50 text-rose-600"
                          : "border-slate-200 bg-slate-900 text-white hover:bg-slate-800"
                      }`}
                    >
                      {isCamOff ? (
                        <CameraOff className="h-4 w-4" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </Button>

                    <Button
                      type="button"
                      size="icon"
                      onClick={stopSession}
                      className="h-9 w-9 rounded-full bg-rose-600 text-white hover:bg-rose-700"
                    >
                      <PhoneOff className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {networkError && (
                <div className="mt-3 rounded-2xl bg-rose-50 px-3 py-3 text-xs text-rose-700">
                  {networkError}
                </div>
              )}
            </div>

            <div className="p-4">
              <ScrollArea className="h-[420px] pr-2">
                <div ref={scrollRef} className="space-y-3 text-xs md:text-sm">
                  {messages.length === 0 && (
                    <div className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-slate-700">
                      <p className="mb-1 font-medium text-slate-900">{t("How it works")}</p>
                      <p>
                        {t(
                          "Allow camera and microphone. The assistant will listen, answer and voice the reply.",
                        )}
                      </p>
                    </div>
                  )}

                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
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
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
