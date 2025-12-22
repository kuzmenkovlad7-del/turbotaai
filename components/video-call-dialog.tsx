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
import {
  Video,
  VideoOff,
  Phone,
  Brain,
  Mic,
  MicOff,
  Loader2,
  Sparkles,
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

type VideoMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  gender?: "female" | "male"
}

// основной вебхук TurbotaAI агента
const TURBOTA_AGENT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL || ""

// запасной бекенд-прокси
const FALLBACK_CHAT_API = "/api/chat"

// аккуратно вытаскиваем текст из любого формата ответа n8n
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

// вычленяем только "новую" часть распознанного текста
function diffTranscript(prev: string, full: string): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,!?;:«»"“”‚‘’…]/g, "")
      .replace(/\s+/g, " ")
      .trim()

  full = full.trim()
  if (!full) return ""
  if (!prev) return full

  const prevNorm = normalize(prev)
  const fullNorm = normalize(full)

  if (!prevNorm || !fullNorm) return full

  const prevWords = prevNorm.split(" ")
  const fullWords = fullNorm.split(" ")

  const maxCommon = Math.min(prevWords.length, fullWords.length)
  let common = 0

  while (common < maxCommon && prevWords[common] === fullWords[common]) {
    common++
  }

  if (common === 0) return full

  const rawTokens = full.split(/\s+/)
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

  const [isSessionActive, setIsSessionActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<VideoMessage[]>([])
  const [networkError, setNetworkError] = useState<string | null>(null)

  const voiceGenderRef = useRef<"female" | "male">("female")
  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  // общий поток (audio+video), чтобы показывать камеру
  const mediaStreamRef = useRef<MediaStream | null>(null)
  // отдельный поток (audio-only) для MediaRecorder (чтобы не писать видео в контейнер)
  const audioStreamRef = useRef<MediaStream | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const isSttBusyRef = useRef(false)
  const lastTranscriptRef = useRef("")
  const [sessionLang, setSessionLang] = useState(() => computeLangCode())
  const sessionLangRef = useRef(sessionLang)
  const isSessionActiveRef = useRef(false)

  // важное: чтобы НЕ захватывать речь/эхо когда ассистент говорит
  const isAiSpeakingRef = useRef(false)
  const isMicMutedRef = useRef(false)

  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)

  // автоскролл
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    sessionLangRef.current = sessionLang
  }, [sessionLang])

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

  function sttLangToLangCode(sttLang: any): string {
    const l = (sttLang || "").toString().toLowerCase()
    if (l.startsWith("ru")) return "ru-RU"
    if (l.startsWith("en")) return "en-US"
    return "uk-UA"
  }

  function langCodeToShort(langCode: string): "uk" | "ru" | "en" {
    const lc = (langCode || "").toLowerCase()
    if (lc.startsWith("ru")) return "ru"
    if (lc.startsWith("en")) return "en"
    return "uk"
  }

  function getCurrentGender(): "MALE" | "FEMALE" {
    const g = voiceGenderRef.current || "female"
    return g === "male" ? "MALE" : "FEMALE"
  }

  function attachUserVideo(stream: MediaStream) {
    const el = userVideoRef.current
    if (!el) return
    try {
      el.srcObject = stream
      // iOS любит playsInline + muted для автоплея превью
      el.muted = true
      // @ts-ignore
      el.playsInline = true
      el.onloadedmetadata = () => {
        const p = el.play()
        if (p && typeof (p as any).catch === "function") {
          ;(p as any).catch(() => {})
        }
      }
    } catch (e) {
      console.error("[Video] attach error", e)
    }
  }

  function pickRecorderMimeType(): string | undefined {
    if (typeof MediaRecorder === "undefined") return undefined

    // Chrome/Android — webm opus; Safari/iOS — часто mp4
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      return "audio/webm;codecs=opus"
    }
    if (MediaRecorder.isTypeSupported("audio/webm")) {
      return "audio/webm"
    }
    if (MediaRecorder.isTypeSupported("audio/mp4")) {
      return "audio/mp4"
    }
    return undefined
  }

  // --------- STT: послать накопленный звук в /api/stt ---------
  // После отправки очищаем буфер, чтобы каждый вопрос обрабатывался отдельным чанком и таймеры не застревали.

  async function maybeSendStt() {
    if (!isSessionActiveRef.current) return
    if (isAiSpeakingRef.current) return
    if (isMicMutedRef.current) return

    if (isSttBusyRef.current) {
      logDebug("[STT] skip, request already in progress")
      return
    }
    if (!audioChunksRef.current.length) return

    const recMime = mediaRecorderRef.current?.mimeType || ""
    const firstChunkMime = audioChunksRef.current[0]?.type || ""
    const mimeType = (recMime || firstChunkMime || "audio/webm").toString()

    const blob = new Blob(audioChunksRef.current, { type: mimeType })
    if (blob.size < 8000) return

    try {
      isSttBusyRef.current = true
      logDebug("[STT] sending blob size=", blob.size, "type=", blob.type)

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
          "X-STT-Hint": "auto",
          "X-STT-Lang": sessionLangRef.current || computeLangCode(),
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
        console.error("[STT] error response:", res.status, raw)
        return
      }

      const detectedLangCode = sttLangToLangCode((data as any)?.lang)
      if (detectedLangCode && detectedLangCode !== sessionLangRef.current) {
        setSessionLang(detectedLangCode)
      }

      const fullText = (data.text || "").toString().trim()
      logDebug('[STT] transcript full="' + fullText + '"')
      if (!fullText) return

      const prev = lastTranscriptRef.current
      const delta = diffTranscript(prev, fullText)
      lastTranscriptRef.current = fullText

      if (!delta) return

      const userMsg: VideoMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text: delta,
      }

      setMessages((prevMsgs) => [...prevMsgs, userMsg])
      await handleUserText(delta, detectedLangCode)
      audioChunksRef.current = []
      lastTranscriptRef.current = ""
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state === "recording") {
        try {
          recorder.requestData()
        } catch {}
      }
    } catch (e) {
      console.error("[STT] fatal error", e)
    } finally {
      isSttBusyRef.current = false
    }
  }

  // --------- TTS через /api/tts ---------

  function speakText(text: string) {
    if (typeof window === "undefined") return

    const cleanText = text?.trim()
    if (!cleanText) return

    const langCode = sessionLangRef.current || computeLangCode()
    const gender = getCurrentGender()

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
      if (
        rec &&
        rec.state === "paused" &&
        isSessionActiveRef.current &&
        !isMicMutedRef.current
      ) {
        try {
          rec.resume()
        } catch (e) {
          console.error("Recorder resume error", e)
        }
      }
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
          finishSpeaking()
          return
        }

        const audioUrl = `data:audio/mp3;base64,${data.audioContent}`

        if (ttsAudioRef.current) {
          try {
            ttsAudioRef.current.pause()
          } catch {}
          ttsAudioRef.current = null
        }

        const audio = new Audio(audioUrl)
        ttsAudioRef.current = audio

        // важно: ставим speaking ДО play(), чтобы не поймать кусок голоса ассистента в микрофон
        beginSpeaking()

        audio.onended = () => {
          finishSpeaking()
          ttsAudioRef.current = null
        }
        audio.onerror = () => {
          finishSpeaking()
          ttsAudioRef.current = null
        }

        try {
          await audio.play()
        } catch (e) {
          console.error("[TTS] play() rejected", e)
          finishSpeaking()
        }
      } catch (e) {
        console.error("[TTS] fetch error", e)
        finishSpeaking()
      }
    })()
  }

  // --------- отправка текста в n8n / OpenAI ---------

  async function handleUserText(text: string, langCodeOverride?: string) {
    const voiceLangCode =
      langCodeOverride || sessionLangRef.current || computeLangCode()
    if (voiceLangCode !== sessionLangRef.current) {
      setSessionLang(voiceLangCode)
    }
    const langShort = langCodeToShort(voiceLangCode)
    const resolvedWebhook =
      (webhookUrl && webhookUrl.trim()) ||
      TURBOTA_AGENT_WEBHOOK_URL.trim() ||
      FALLBACK_CHAT_API

    logDebug("[CHAT] send to", resolvedWebhook, "lang=", langShort)

    try {
      const res = await fetch(resolvedWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          language: langShort,
          email: effectiveEmail,
          mode: "video",
          gender: voiceGenderRef.current,
          voiceLanguage: voiceLangCode,
        }),
      })

      if (!res.ok) throw new Error(`Chat API error: ${res.status}`)

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {
        // строка
      }

      let answer = extractAnswer(data)
      if (!answer) {
        answer = t("I'm sorry, I couldn't process your message. Please try again.")
      }

      const assistantMsg: VideoMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: answer,
        gender: voiceGenderRef.current,
      }

      setMessages((prev) => [...prev, assistantMsg])
      speakText(answer)
    } catch (error: any) {
      console.error("[CHAT] error:", error)
      setNetworkError(t("Connection error. Please try again."))
      if (onError && error instanceof Error) onError(error)
    }
  }

  // --------- управление сессией ---------

  const startSession = async (gender: "female" | "male") => {
    voiceGenderRef.current = gender
    setIsConnecting(true)
    setNetworkError(null)
    setSessionLang(computeLangCode())

    // по умолчанию — всё включено
    setIsMicMuted(false)
    isMicMutedRef.current = false
    setIsCameraOff(false)

    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setNetworkError(
          t(
            "Camera/microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari.",
          ),
        )
        setIsConnecting(false)
        return
      }

      // 1) пытаемся взять и audio и video
      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
      } catch (e) {
        // 2) если камера не дала — пробуем хотя бы аудио, но UI покажет что камера выключена
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        })
        setIsCameraOff(true)
      }

      mediaStreamRef.current = stream

      // прикрепляем видео (если есть)
      if (stream.getVideoTracks().length > 0) {
        const vTrack = stream.getVideoTracks()[0]
        vTrack.enabled = true
        attachUserVideo(stream)
      }

      // audio-only stream для MediaRecorder
      const aTracks = stream.getAudioTracks()
      const audioOnly = new MediaStream(aTracks)
      audioStreamRef.current = audioOnly

      if (typeof MediaRecorder === "undefined") {
        setNetworkError(
          t(
            "Voice recognition is not supported in this browser. Please use the latest Chrome/Edge/Safari on iOS 14+.",
          ),
        )
        setIsConnecting(false)
        return
      }

      const options: MediaRecorderOptions = {}
      const mime = pickRecorderMimeType()
      if (mime) options.mimeType = mime

      const recorder = new MediaRecorder(audioOnly, options)
      mediaRecorderRef.current = recorder

      audioChunksRef.current = []
      isSttBusyRef.current = false
      lastTranscriptRef.current = ""

      recorder.onstart = () => {
        setIsListening(true)
      }

      recorder.ondataavailable = (event: BlobEvent) => {
        // важно: никаких "миганий" — только два режима (mic on / mic off).
        if (!isSessionActiveRef.current) return
        if (isAiSpeakingRef.current) return
        if (isMicMutedRef.current) return

        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          void maybeSendStt()
        }
      }

      recorder.onstop = () => {
        setIsListening(false)
      }

      recorder.onerror = (event: any) => {
        console.error("[Recorder] error", event)
      }

      recorder.start(4000)

      isSessionActiveRef.current = true
      setIsSessionActive(true)
      setIsConnecting(false)
    } catch (error: any) {
      console.error("[VideoCall] startSession error:", error)

      const name = error?.name
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(
          t(
            "Camera or microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page.",
          ),
        )
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setNetworkError(
          t(
            "No camera or microphone was found on this device. Please check your hardware.",
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
      isSessionActiveRef.current = false
      setIsSessionActive(false)
    }
  }

  const endSession = () => {
    isSessionActiveRef.current = false
    setIsSessionActive(false)

    setIsListening(false)
    setIsMicMuted(false)
    isMicMutedRef.current = false

    setIsCameraOff(false)

    setIsAiSpeaking(false)
    isAiSpeakingRef.current = false

    setNetworkError(null)
    setSessionLang(computeLangCode())

    audioChunksRef.current = []
    lastTranscriptRef.current = ""
    isSttBusyRef.current = false

    const rec = mediaRecorderRef.current
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop()
      } catch {}
    }
    mediaRecorderRef.current = null

    const s = mediaStreamRef.current
    if (s) {
      s.getTracks().forEach((tr) => {
        try {
          tr.stop()
        } catch {}
      })
    }
    mediaStreamRef.current = null

    const as = audioStreamRef.current
    if (as) {
      as.getTracks().forEach((tr) => {
        try {
          tr.stop()
        } catch {}
      })
    }
    audioStreamRef.current = null

    const vEl = userVideoRef.current
    if (vEl) {
      try {
        vEl.srcObject = null
      } catch {}
    }

    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.pause()
      } catch {}
      ttsAudioRef.current = null
    }

    if (typeof window !== "undefined" && (window as any).speechSynthesis) {
      try {
        ;(window as any).speechSynthesis.cancel()
      } catch {}
    }
  }

  const toggleMic = () => {
    const next = !isMicMuted
    setIsMicMuted(next)
    isMicMutedRef.current = next

    // аудиотрек тоже выключаем/включаем (доп. страховка)
    const s = mediaStreamRef.current
    const aTrack = s?.getAudioTracks?.()?.[0]
    if (aTrack) aTrack.enabled = !next

    const rec = mediaRecorderRef.current
    if (!rec) return

    if (next) {
      if (rec.state === "recording") {
        try {
          rec.pause()
        } catch {}
      }
    } else {
      if (
        rec.state === "paused" &&
        isSessionActiveRef.current &&
        !isAiSpeakingRef.current
      ) {
        try {
          rec.resume()
        } catch {}
      }
    }
  }

  const toggleCamera = () => {
    const next = !isCameraOff
    setIsCameraOff(next)

    const s = mediaStreamRef.current
    const vTrack = s?.getVideoTracks?.()?.[0]
    if (!vTrack) return

    vTrack.enabled = next

    // если включили камеру — форсим play(), чтобы превью сразу появилось
    if (next && s) {
      attachUserVideo(s)
      const el = userVideoRef.current
      if (el) {
        const p = el.play()
        if (p && typeof (p as any).catch === "function") {
          ;(p as any).catch(() => {})
        }
      }
    }
  }

  useEffect(() => {
    if (!isOpen) {
      endSession()
      setMessages([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    return () => {
      endSession()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusText = !isSessionActive
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
          endSession()
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-5xl border-none bg-transparent p-0">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 text-white">
            <div className="flex items-start justify-between gap-3 pr-10">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Video className="h-4 w-4" />
                  </span>
                  {t("Video session with AI-psychologist")}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {t(
                    "You can talk out loud, the assistant will listen, answer and voice the reply.",
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex h-[600px] flex-col md:h-[620px] md:flex-row">
            {/* LEFT: video stage */}
            <div className="relative flex min-h-[260px] flex-1 flex-col bg-slate-950 md:min-h-0">
              <div className="relative flex-1">
                {/* AI stage */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90">
                      <Brain className="h-3.5 w-3.5" />
                      {t("AI Psychologist")}
                    </div>
                    <div className="text-center text-xs text-white/70">
                      {isAiSpeaking
                        ? t("Assistant is speaking...")
                        : t("You can speak when the microphone is on.")}
                    </div>
                  </div>
                </div>

                {/* User video preview */}
                <div className="absolute right-3 bottom-3 h-32 w-24 overflow-hidden rounded-2xl border border-white/15 bg-black/40 shadow-lg md:h-40 md:w-28">
                  {!isCameraOff && (
                    <video
                      ref={userVideoRef}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      autoPlay
                    />
                  )}

                  {isCameraOff && (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-white/70">
                      {t("Camera off")}
                    </div>
                  )}
                </div>

                {/* Controls overlay */}
                <div className="absolute left-3 right-3 bottom-3 flex items-center justify-between gap-2">
                  <div className="hidden items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-[11px] text-white/80 md:flex">
                    <Sparkles className="h-3.5 w-3.5" />
                    {statusText}
                  </div>

                  {isSessionActive && (
                    <div className="ml-auto flex items-center gap-2 rounded-full bg-black/35 p-2">
                      {/* Mic: ДВА режима, БЕЗ мигания */}
                      <Button
                        type="button"
                        size="icon"
                        onClick={toggleMic}
                        className={`h-9 w-9 rounded-full border ${
                          isMicMuted
                            ? "border-rose-500/40 bg-rose-600 text-white hover:bg-rose-700"
                            : "border-white/20 bg-white/10 text-white hover:bg-white/15"
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
                        onClick={toggleCamera}
                        className={`h-9 w-9 rounded-full border ${
                          isCameraOff
                            ? "border-rose-500/40 bg-rose-600 text-white hover:bg-rose-700"
                            : "border-white/20 bg-white/10 text-white hover:bg-white/15"
                        }`}
                      >
                        {isCameraOff ? (
                          <VideoOff className="h-4 w-4" />
                        ) : (
                          <Video className="h-4 w-4" />
                        )}
                      </Button>

                      <Button
                        type="button"
                        size="icon"
                        onClick={endSession}
                        className="h-9 w-9 rounded-full bg-rose-600 text-white hover:bg-rose-700"
                      >
                        <Phone className="h-4 w-4 rotate-[135deg]" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* mobile status */}
              <div className="border-t border-white/10 bg-slate-950 px-4 py-2 text-[11px] text-white/70 md:hidden">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  {statusText}
                </div>
              </div>
            </div>

            {/* RIGHT: chat */}
            <div className="flex w-full flex-col border-t border-slate-100 md:w-[420px] md:border-t-0 md:border-l">
              <ScrollArea className="flex-1 px-5 pt-4 pb-2">
                <div
                  ref={scrollRef}
                  className="max-h-full space-y-3 pr-1 text-xs md:text-sm"
                  data-notranslate
                >
                  {!isSessionActive && messages.length === 0 && (
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
                          "For best experience allow camera and microphone. You can mute the microphone or turn off the camera anytime.",
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
                            {msg.gender && (
                              <span className="ml-1 rounded-full bg-emerald-100 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                                {msg.gender === "female"
                                  ? t("Female voice")
                                  : t("Male voice")}
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

              {!isSessionActive && (
                <div className="border-t border-slate-100 px-5 py-4">
                  <div className="mb-3 text-center text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {t("Choose voice for this session")}
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      onClick={() => void startSession("female")}
                      disabled={isConnecting}
                      className={`h-11 flex-1 rounded-full px-5 text-xs font-semibold shadow-sm ${
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
                      onClick={() => void startSession("male")}
                      disabled={isConnecting}
                      className={`h-11 flex-1 rounded-full px-5 text-xs font-semibold shadow-sm ${
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

                  <div className="mt-3 text-center text-[11px] text-slate-500">
                    {t(
                      "If the camera does not start, allow permissions for this site and reopen the session.",
                    )}
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
