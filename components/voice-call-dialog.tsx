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

function getDebugEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    return new URLSearchParams(window.location.search).get("debug") === "1"
  } catch {
    return false
  }
}

function computeLangCode(currentLanguage: any): string {
  const lang =
    typeof currentLanguage === "string"
      ? currentLanguage
      : currentLanguage?.code || "uk"

  if (lang.startsWith("uk")) return "uk-UA"
  if (lang.startsWith("ru")) return "ru-RU"
  return "en-US"
}

function computeSttLang(currentLanguage: any): "uk" | "ru" | "en" {
  const lang =
    typeof currentLanguage === "string"
      ? currentLanguage
      : currentLanguage?.code || "uk"

  if (lang.startsWith("uk")) return "uk"
  if (lang.startsWith("ru")) return "ru"
  return "en"
}

function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return ""
  const cands = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
  ]
  for (const c of cands) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c
    } catch {
      // ignore
    }
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

  const effectiveEmail = userEmail || user?.email || "guest@example.com"
  const voiceGenderRef = useRef<"female" | "male">("female")

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const isOpenRef = useRef(false)
  const isCallActiveRef = useRef(false)
  const isConnectingRef = useRef(false)
  const aiSpeakingRef = useRef(false)

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recorderMimeRef = useRef<string>("")

  const headerChunksRef = useRef<Blob[]>([])
  const headerBytesRef = useRef(0)
  const segmentChunksRef = useRef<Blob[]>([])
  const segmentBytesRef = useRef(0)

  const isSttBusyRef = useRef(false)
  const pendingFinalizeRef = useRef(false)
  const lastSentTextRef = useRef<string>("")

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)

  const noiseFloorRef = useRef<number>(0.003)
  const hadSpeechRef = useRef(false)
  const lastVoiceAtRef = useRef<number>(0)
  const segmentStartedAtRef = useRef<number>(0)

  const restartAttemptsRef = useRef(0)
  const lastRestartAtRef = useRef(0)
  const zeroChunkStreakRef = useRef(0)

  const langCode = useMemo(
    () => computeLangCode(currentLanguage),
    [currentLanguage],
  )
  const sttLang = useMemo(() => computeSttLang(currentLanguage), [currentLanguage])

  const dlog = (...args: any[]) => {
    if (!getDebugEnabled()) return
    // eslint-disable-next-line no-console
    console.log(...args)
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const stopRaf = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  const teardownAudioGraph = async () => {
    stopRaf()
    analyserRef.current = null
    try {
      if (audioCtxRef.current) {
        await audioCtxRef.current.close()
      }
    } catch {
      // ignore
    }
    audioCtxRef.current = null
  }

  const stopRecorderOnly = () => {
    const rec = mediaRecorderRef.current
    mediaRecorderRef.current = null
    try {
      if (rec && rec.state !== "inactive") rec.stop()
    } catch {
      // ignore
    }
  }

  const stopStreamOnly = () => {
    const s = mediaStreamRef.current
    mediaStreamRef.current = null
    try {
      s?.getTracks().forEach((tr) => tr.stop())
    } catch {
      // ignore
    }
  }

  const hardStopCapture = async () => {
    stopRecorderOnly()
    stopStreamOnly()
    await teardownAudioGraph()

    headerChunksRef.current = []
    headerBytesRef.current = 0
    segmentChunksRef.current = []
    segmentBytesRef.current = 0
    isSttBusyRef.current = false
    pendingFinalizeRef.current = false
    zeroChunkStreakRef.current = 0
    hadSpeechRef.current = false
    lastVoiceAtRef.current = 0
    segmentStartedAtRef.current = 0
  }

  const speakText = (text: string) => {
    if (typeof window === "undefined") return
    const clean = (text || "").trim()
    if (!clean) return

    const gender = voiceGenderRef.current === "male" ? "MALE" : "FEMALE"

    const beginSpeaking = () => {
      aiSpeakingRef.current = true
      setIsAiSpeaking(true)
      const rec = mediaRecorderRef.current
      if (rec && rec.state === "recording") {
        try {
          rec.pause()
          dlog("[REC] pause while TTS")
        } catch {
          // ignore
        }
      }
    }

    const finishSpeaking = () => {
      aiSpeakingRef.current = false
      setIsAiSpeaking(false)
      const rec = mediaRecorderRef.current
      if (rec && rec.state === "paused" && isCallActiveRef.current && !isMicMuted) {
        try {
          rec.resume()
          dlog("[REC] resume after TTS")
        } catch {
          // ignore
        }
      }
    }

    ;(async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: clean, language: langCode, gender }),
        })

        const raw = await res.text()
        let data: any = null
        try {
          data = raw ? JSON.parse(raw) : null
        } catch {
          data = null
        }

        if (!res.ok || !data || data.success === false || !data.audioContent) {
          finishSpeaking()
          return
        }

        const audioUrl = `data:audio/mp3;base64,${data.audioContent}`

        if (audioRef.current) {
          try {
            audioRef.current.pause()
          } catch {
            // ignore
          }
          audioRef.current = null
        }

        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onplay = () => beginSpeaking()
        audio.onended = () => {
          finishSpeaking()
          audioRef.current = null
        }
        audio.onerror = () => {
          finishSpeaking()
          audioRef.current = null
        }

        try {
          await audio.play()
        } catch {
          finishSpeaking()
        }
      } catch {
        finishSpeaking()
      }
    })()
  }

  const handleUserText = async (text: string) => {
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
          language:
            typeof currentLanguage === "string"
              ? currentLanguage
              : currentLanguage?.code || "uk",
          email: effectiveEmail,
          mode: "voice",
          gender: voiceGenderRef.current,
          voiceLanguage: langCode,
        }),
      })

      if (!res.ok) throw new Error(`Chat API error: ${res.status}`)

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {
        // keep string
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
      setNetworkError(t("Connection error. Please try again."))
      if (onError && error instanceof Error) onError(error)
    }
  }

  const sendSttBlob = async (blob: Blob) => {
    if (isSttBusyRef.current) return
    if (!isCallActiveRef.current) return
    if (!blob || blob.size < 8000) return

    isSttBusyRef.current = true
    try {
      const ct = blob.type || "application/octet-stream"
      dlog("[STT] send", { size: blob.size, ct, lang: sttLang })

      const res = await fetch(`/api/stt?lang=${sttLang}`, {
        method: "POST",
        headers: { "Content-Type": ct },
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
        dlog("[STT] bad response", res.status, raw)
        return
      }

      const text = (data.text || "").toString().trim()
      if (!text) return

      // анти-дубликат
      if (text === lastSentTextRef.current) return
      lastSentTextRef.current = text

      const userMsg: VoiceMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text,
      }

      setMessages((prev) => [...prev, userMsg])
      await handleUserText(text)
    } finally {
      isSttBusyRef.current = false
    }
  }

  const buildSegmentBlob = (): Blob | null => {
    const parts: Blob[] = []
    if (headerChunksRef.current.length) parts.push(...headerChunksRef.current)
    if (segmentChunksRef.current.length) parts.push(...segmentChunksRef.current)
    if (!parts.length) return null
    return new Blob(parts, { type: recorderMimeRef.current || "audio/webm" })
  }

  const resetSegment = () => {
    segmentChunksRef.current = []
    segmentBytesRef.current = 0
    hadSpeechRef.current = false
    lastVoiceAtRef.current = 0
    segmentStartedAtRef.current = Date.now()
  }

  const scheduleFinalize = (reason: string) => {
    if (pendingFinalizeRef.current) return
    if (aiSpeakingRef.current) return
    if (!isCallActiveRef.current) return

    pendingFinalizeRef.current = true
    const rec = mediaRecorderRef.current
    try {
      if (rec && rec.state === "recording") rec.requestData()
    } catch {
      // ignore
    }

    setTimeout(async () => {
      pendingFinalizeRef.current = false

      // не шлём если нет речи/очень мало байт
      if (!hadSpeechRef.current) return
      if (segmentBytesRef.current < 12000) return

      const blob = buildSegmentBlob()
      resetSegment()
      if (blob) await sendSttBlob(blob)

      dlog("[SEG] finalize", reason)
    }, 180)
  }

  const startVADLoop = () => {
    const analyser = analyserRef.current
    const ctx = audioCtxRef.current
    if (!analyser || !ctx) return

    const fft = analyser.fftSize || 2048
    const data = new Float32Array(new ArrayBuffer(fft * 4)) // типизация без SharedArrayBuffer

    const END_SILENCE_MS = 1100
    const MAX_SEGMENT_MS = 25000

    const tick = () => {
      if (!isCallActiveRef.current) return
      if (!analyserRef.current) return
      if (aiSpeakingRef.current) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      try {
        analyser.getFloatTimeDomainData(data as any)

        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = data[i]
          sum += v * v
        }
        const rms = Math.sqrt(sum / data.length)

        // обновляем шумовую полку только когда "не говорим"
        const nf = noiseFloorRef.current || 0.003
        const target = Math.max(0.0005, Math.min(0.02, rms))
        const newNf = nf * 0.98 + target * 0.02
        noiseFloorRef.current = newNf

        const thr = Math.max(0.01, newNf * 3.2)
        const speaking = rms > thr && !isMicMuted

        const now = Date.now()
        if (speaking) {
          hadSpeechRef.current = true
          lastVoiceAtRef.current = now
          if (!segmentStartedAtRef.current) segmentStartedAtRef.current = now
        } else {
          // если была речь и тишина держится — финализируем сегмент
          if (hadSpeechRef.current && lastVoiceAtRef.current) {
            if (now - lastVoiceAtRef.current > END_SILENCE_MS) {
              scheduleFinalize("silence")
            }
          }
        }

        // защита от слишком длинного монолога: режем сегмент
        if (hadSpeechRef.current && segmentStartedAtRef.current) {
          if (now - segmentStartedAtRef.current > MAX_SEGMENT_MS) {
            scheduleFinalize("max-segment")
          }
        }

        // UX: индикатор "слушает"
        setIsListening(!isMicMuted && isCallActiveRef.current)
        dlog("[VAD]", {
          rms: Number(rms.toFixed(4)),
          noise: Number(newNf.toFixed(4)),
          thr: Number(thr.toFixed(4)),
          speaking,
          rec: mediaRecorderRef.current?.state,
        })
      } catch (e) {
        // если WebAudio отваливается на ПК — просто выключаем VAD и остаёмся на MediaRecorder
        dlog("[VAD] error -> disable", e)
        teardownAudioGraph()
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  const attachTrackWatchers = (track: MediaStreamTrack) => {
    track.onended = () => {
      dlog("[MIC] track ended")
      void attemptRestart("track-ended")
    }
    track.onmute = () => {
      dlog("[MIC] track muted")
      void attemptRestart("track-muted")
    }
    track.onunmute = () => {
      dlog("[MIC] track unmuted")
    }
  }

  const initCapture = async () => {
    if (typeof navigator === "undefined") throw new Error("No navigator")
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari.",
      )
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    mediaStreamRef.current = stream

    const track = stream.getAudioTracks()[0]
    if (!track) throw new Error("No microphone track")
    track.enabled = true
    attachTrackWatchers(track)

    // MediaRecorder
    const mime = pickRecorderMimeType()
    recorderMimeRef.current = mime || ""
    const options: MediaRecorderOptions = {}
    if (mime) options.mimeType = mime

    const recorder = new MediaRecorder(stream, options)
    mediaRecorderRef.current = recorder

    headerChunksRef.current = []
    headerBytesRef.current = 0
    segmentChunksRef.current = []
    segmentBytesRef.current = 0
    hadSpeechRef.current = false
    lastVoiceAtRef.current = 0
    segmentStartedAtRef.current = Date.now()
    zeroChunkStreakRef.current = 0

    recorder.onstart = () => dlog("[REC] start", recorderMimeRef.current || "(default)")
    recorder.onstop = () => dlog("[REC] stop")
    recorder.onerror = (ev: any) => dlog("[REC] error", ev?.name || ev)

    recorder.ondataavailable = (ev: BlobEvent) => {
      const b = ev.data
      if (!b) return

      if (b.size === 0) {
        zeroChunkStreakRef.current += 1
        dlog("[REC] zero chunk streak", zeroChunkStreakRef.current)
        if (zeroChunkStreakRef.current >= 6) {
          void attemptRestart("zero-chunks")
        }
        return
      }

      zeroChunkStreakRef.current = 0

      // набираем небольшой "заголовочный" буфер, чтобы сегменты всегда декодировались
      if (headerBytesRef.current < 64000) {
        headerChunksRef.current.push(b)
        headerBytesRef.current += b.size
      } else {
        segmentChunksRef.current.push(b)
        segmentBytesRef.current += b.size
      }
    }

    // WebAudio VAD (фейл-сейф: если упадёт — просто выключится)
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (Ctx) {
        const ctx: AudioContext = new Ctx()
        audioCtxRef.current = ctx
        try {
          if (ctx.state === "suspended") await ctx.resume()
        } catch {
          // ignore
        }

        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        source.connect(analyser)
        analyserRef.current = analyser
        startVADLoop()
      }
    } catch (e) {
      dlog("[VAD] init failed", e)
      await teardownAudioGraph()
    }

    // стартуем частыми кусками — чтобы сегменты собирались быстро
    recorder.start(350)
    dlog("[REC] start(350)")

    setIsListening(true)
  }

  const attemptRestart = async (reason: string) => {
    if (!isCallActiveRef.current) return
    if (isConnectingRef.current) return

    const now = Date.now()
    if (now - lastRestartAtRef.current < 1500) return
    lastRestartAtRef.current = now

    restartAttemptsRef.current += 1
    dlog("[MIC] restart attempt", restartAttemptsRef.current, reason)

    // мягко: не роняем диалог, просто пересоздаём захват
    setNetworkError(null)
    setIsConnecting(true)
    isConnectingRef.current = true

    try {
      await hardStopCapture()
      await initCapture()
      setIsConnecting(false)
      isConnectingRef.current = false
      setNetworkError(null)
      return
    } catch (e: any) {
      setIsConnecting(false)
      isConnectingRef.current = false

      // если 2+ раз подряд — показываем ошибку
      if (restartAttemptsRef.current >= 2) {
        setNetworkError(t("Microphone stopped unexpectedly. Please reload the page and try again."))
      } else {
        // ещё одна попытка
        setTimeout(() => {
          void attemptRestart("retry")
        }, 900)
      }
    }
  }

  const startCall = async (gender: "female" | "male") => {
    voiceGenderRef.current = gender
    restartAttemptsRef.current = 0
    lastSentTextRef.current = ""

    setIsConnecting(true)
    isConnectingRef.current = true
    setNetworkError(null)

    // не даём UI “подвиснуть” на клик
    await new Promise<void>((r) => requestAnimationFrame(() => r()))

    try {
      await hardStopCapture()
      await initCapture()

      isCallActiveRef.current = true
      setIsCallActive(true)

      setIsConnecting(false)
      isConnectingRef.current = false
    } catch (error: any) {
      isCallActiveRef.current = false
      setIsCallActive(false)
      setIsListening(false)

      setIsConnecting(false)
      isConnectingRef.current = false

      const name = error?.name
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(
          t(
            "Microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page.",
          ),
        )
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setNetworkError(
          t("No microphone was found on this device. Please check your hardware."),
        )
      } else {
        setNetworkError(
          (error?.message || "").toString().trim() ||
            t(
              "Could not start microphone. Check permissions in the browser and system settings, then try again.",
            ),
        )
      }

      if (onError && error instanceof Error) onError(error)
    }
  }

  const endCall = () => {
    isCallActiveRef.current = false
    setIsCallActive(false)
    setIsListening(false)
    setIsMicMuted(false)

    aiSpeakingRef.current = false
    setIsAiSpeaking(false)

    setNetworkError(null)

    // попробуем добить последний сегмент перед стопом
    if (hadSpeechRef.current && segmentBytesRef.current > 12000) {
      scheduleFinalize("end-call")
    }

    void hardStopCapture()

    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch {
        // ignore
      }
      audioRef.current = null
    }

    try {
      ;(window as any).speechSynthesis?.cancel?.()
    } catch {
      // ignore
    }
  }

  const toggleMic = () => {
    const next = !isMicMuted
    setIsMicMuted(next)

    const stream = mediaStreamRef.current
    const track = stream?.getAudioTracks?.()?.[0]
    if (track) track.enabled = !next

    const rec = mediaRecorderRef.current
    if (!rec) return
    if (next) {
      if (rec.state === "recording") {
        try {
          rec.pause()
        } catch {
          // ignore
        }
      }
    } else {
      if (rec.state === "paused" && isCallActiveRef.current && !aiSpeakingRef.current) {
        try {
          rec.resume()
        } catch {
          // ignore
        }
      }
    }
  }

  useEffect(() => {
    isOpenRef.current = isOpen
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

              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  endCall()
                  onClose()
                }}
                className="h-8 w-8 rounded-full text-white hover:bg-white/10"
              >
                ×
              </Button>
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
