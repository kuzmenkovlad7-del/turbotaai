"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Phone, Mic, MicOff, Loader2, Sparkles, Brain, X } from "lucide-react"
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

const TURBOTA_AGENT_WEBHOOK_URL = process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL || ""
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
    )?.toString().trim()
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
    )?.toString().trim()
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

  full = (full || "").trim()
  if (!full) return ""
  if (!prev) return full

  const prevNorm = normalize(prev)
  const fullNorm = normalize(full)
  if (!prevNorm || !fullNorm) return full

  const prevWords = prevNorm.split(" ")
  const fullWords = fullNorm.split(" ")

  const maxCommon = Math.min(prevWords.length, fullWords.length)
  let common = 0
  while (common < maxCommon && prevWords[common] === fullWords[common]) common++

  if (common === 0) return full

  const rawTokens = full.split(/\s+/)
  if (common >= rawTokens.length) return ""
  return rawTokens.slice(common).join(" ").trim()
}

function isDebugOn(): boolean {
  if (typeof window === "undefined") return false
  try {
    return new URLSearchParams(window.location.search).get("debug") === "1"
  } catch {
    return false
  }
}

function computeLangCodeFromCurrentLanguage(currentLanguage: any): string {
  const lang =
    typeof currentLanguage === "string"
      ? currentLanguage
      : currentLanguage?.code || "uk"

  if (lang.startsWith("uk")) return "uk-UA"
  if (lang.startsWith("ru")) return "ru-RU"
  return "en-US"
}

function pickBestMimeType(): string | undefined {
  if (typeof window === "undefined") return undefined
  const MR: any = (window as any).MediaRecorder
  if (!MR || typeof MR.isTypeSupported !== "function") return undefined

  // Safari/iOS часто стабильнее на mp4, Chrome/Edge — webm opus
  const candidates = [
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/webm;codecs=opus",
    "audio/webm",
  ]

  for (const c of candidates) {
    try {
      if (MR.isTypeSupported(c)) return c
    } catch {
      // ignore
    }
  }
  return undefined
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

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const effectiveEmail = userEmail || user?.email || "guest@example.com"
  const voiceGenderRef = useRef<"female" | "male">("female")

  // --- audio engine refs ---
  const streamRef = useRef<MediaStream | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const stoppingRef = useRef(false)
  const segStartedAtRef = useRef<number>(0)
  const hadVoiceInSegRef = useRef(false)

  const callActiveRef = useRef(false)

  const sttBusyRef = useRef(false)
  const pendingBlobRef = useRef<Blob | null>(null)
  const lastTranscriptRef = useRef("")

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const vadTimerRef = useRef<number | null>(null)

  const speakingRef = useRef(false)
  const voiceStartAtRef = useRef(0)
  const lastVoiceAtRef = useRef(0)
  const noiseFloorRef = useRef(0.002)

  const mimeType = useMemo(() => pickBestMimeType(), [])

  const dbg = (...args: any[]) => {
    if (!isDebugOn()) return
    // eslint-disable-next-line no-console
    console.log(...args)
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const setMicEnabled = (enabled: boolean) => {
    const tr = trackRef.current
    if (!tr) return
    try {
      tr.enabled = enabled
    } catch {
      // ignore
    }
  }

  const cleanupAudioEngine = () => {
    if (vadTimerRef.current) {
      window.clearInterval(vadTimerRef.current)
      vadTimerRef.current = null
    }

    speakingRef.current = false
    hadVoiceInSegRef.current = false
    stoppingRef.current = false

    const rec = recorderRef.current
    recorderRef.current = null
    chunksRef.current = []
    try {
      if (rec && rec.state !== "inactive") rec.stop()
    } catch {
      // ignore
    }

    const ctx = audioCtxRef.current
    audioCtxRef.current = null
    analyserRef.current = null
    try {
      ctx?.close()
    } catch {
      // ignore
    }

    const tr = trackRef.current
    trackRef.current = null
    try {
      tr?.stop()
    } catch {
      // ignore
    }

    const s = streamRef.current
    streamRef.current = null
    try {
      s?.getTracks().forEach((t) => t.stop())
    } catch {
      // ignore
    }
  }

  const endCall = () => {
    dbg("[CALL] end")
    callActiveRef.current = false
    setIsCallActive(false)
    setIsListening(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setNetworkError(null)
    lastTranscriptRef.current = ""
    pendingBlobRef.current = null
    sttBusyRef.current = false

    cleanupAudioEngine()

    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch {
        // ignore
      }
      audioRef.current = null
    }

    if (typeof window !== "undefined" && (window as any).speechSynthesis) {
      try {
        ;(window as any).speechSynthesis.cancel()
      } catch {
        // ignore
      }
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

  const speakText = (text: string) => {
    if (typeof window === "undefined") return
    const cleanText = (text || "").trim()
    if (!cleanText) return

    const langCode = computeLangCodeFromCurrentLanguage(currentLanguage)
    const gender = (voiceGenderRef.current || "female") === "male" ? "MALE" : "FEMALE"

    // во время TTS выключаем микрофон, чтобы не ловить собственную озвучку
    const beginSpeaking = () => {
      setIsAiSpeaking(true)
      if (!isMicMuted) setMicEnabled(false)
    }
    const finishSpeaking = () => {
      setIsAiSpeaking(false)
      if (!isMicMuted && callActiveRef.current) setMicEnabled(true)
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
    const langShort =
      typeof currentLanguage === "string"
        ? currentLanguage
        : currentLanguage?.code || "uk"

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
          language: langShort,
          email: effectiveEmail,
          mode: "voice",
          gender: voiceGenderRef.current,
          voiceLanguage: computeLangCodeFromCurrentLanguage(currentLanguage),
        }),
      })

      if (!res.ok) throw new Error(`Chat API error: ${res.status}`)

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {
        // string
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

  const sendStt = async (blob: Blob) => {
    if (!callActiveRef.current) return
    if (!blob || blob.size < 12000) {
      dbg("[STT] skip small blob", blob?.size)
      return
    }

    const langCode = computeLangCodeFromCurrentLanguage(currentLanguage)

    try {
      sttBusyRef.current = true
      dbg("[STT] send", { size: blob.size, type: blob.type || "unknown" })

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
          "X-Language": langCode,
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
        dbg("[STT] error", res.status, raw?.slice?.(0, 200))
        return
      }

      const fullText = (data.text || "").toString().trim()
      dbg('[STT] transcript full="' + fullText + '"')
      if (!fullText) return

      const prev = lastTranscriptRef.current
      const delta = diffTranscript(prev, fullText)
      lastTranscriptRef.current = fullText

      if (!delta) {
        dbg("[STT] no delta")
        return
      }

      const userMsg: VoiceMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text: delta,
      }

      setMessages((prevMsgs) => [...prevMsgs, userMsg])
      await handleUserText(delta)
    } catch (e: any) {
      dbg("[STT] fatal", e?.message || e)
    } finally {
      sttBusyRef.current = false
      if (pendingBlobRef.current) {
        const next = pendingBlobRef.current
        pendingBlobRef.current = null
        await sendStt(next)
      }
    }
  }

  const queueStt = async (blob: Blob) => {
    if (sttBusyRef.current) {
      pendingBlobRef.current = blob
      return
    }
    await sendStt(blob)
  }

  const startRecorderSegment = () => {
    const stream = streamRef.current
    if (!stream) return

    chunksRef.current = []
    hadVoiceInSegRef.current = false
    stoppingRef.current = false
    segStartedAtRef.current = performance.now()

    let rec: MediaRecorder
    try {
      const opts: MediaRecorderOptions = {}
      if (mimeType) opts.mimeType = mimeType
      rec = new MediaRecorder(stream, opts)
    } catch (e) {
      setNetworkError(
        t("Microphone recording is not supported in this browser. Please use the latest Chrome, Edge or Safari.")
      )
      return
    }

    recorderRef.current = rec

    rec.onstart = () => {
      setIsListening(true)
      dbg("[REC] start", rec.mimeType || mimeType || "")
    }

    rec.ondataavailable = (ev: BlobEvent) => {
      if (ev.data && ev.data.size > 0) {
        chunksRef.current.push(ev.data)
      }
    }

    rec.onerror = () => {
      // не валим UI, просто покажем ошибку
      dbg("[REC] error")
    }

    rec.onstop = () => {
      setIsListening(false)

      const type = rec.mimeType || mimeType || "application/octet-stream"
      const blob = new Blob(chunksRef.current, { type })

      dbg("[REC] stop -> blob", { size: blob.size, type })
      chunksRef.current = []

      // отправляем только если в сегменте реально была речь
      if (hadVoiceInSegRef.current) {
        void queueStt(blob)
      }

      // мгновенно запускаем следующий сегмент, пока звонок активен
      if (callActiveRef.current) {
        // маленькая пауза, чтобы Safari/Chrome успели отпустить рекордер
        setTimeout(() => {
          if (callActiveRef.current) startRecorderSegment()
        }, 50)
      }
    }

    try {
      rec.start() // без timeslice: получаем полноценный файл на stop()
    } catch (e) {
      dbg("[REC] start() failed", e)
    }
  }

  const stopRecorderSegment = (reason: string) => {
    const rec = recorderRef.current
    if (!rec) return
    if (rec.state === "inactive") return
    if (stoppingRef.current) return

    stoppingRef.current = true
    dbg("[SEG] stop", reason)

    try {
      rec.stop()
    } catch {
      stoppingRef.current = false
    }
  }

  const initVAD = async () => {
    const stream = streamRef.current
    if (!stream) return

    // если AudioContext падает — не ломаем звонок, просто без VAD
    try {
      const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AC) return

      const ctx: AudioContext = new AC()
      audioCtxRef.current = ctx

      // важно: resume после user gesture
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

      // Float32Array строго на ArrayBuffer, чтобы TypeScript/Vercel не падали
      const floatBuf = new Float32Array(new ArrayBuffer(analyser.fftSize * 4))

      const SILENCE_MS = 1200
      const MIN_SPEECH_MS = 250
      const FORCE_SEND_EVERY_MS = 9000
      const MAX_SEGMENT_MS = 30000

      vadTimerRef.current = window.setInterval(() => {
        const a = analyserRef.current
        const now = performance.now()
        if (!a || !callActiveRef.current) return

        try {
          a.getFloatTimeDomainData(floatBuf)
        } catch {
          // если analyzer умер — отключаем VAD
          if (vadTimerRef.current) {
            window.clearInterval(vadTimerRef.current)
            vadTimerRef.current = null
          }
          return
        }

        let sum = 0
        for (let i = 0; i < floatBuf.length; i++) {
          const v = floatBuf[i]
          sum += v * v
        }
        const rms = Math.sqrt(sum / floatBuf.length)

        // обновляем noise floor только когда не говорим
        if (!speakingRef.current) {
          noiseFloorRef.current = noiseFloorRef.current * 0.98 + rms * 0.02
        }

        const thr = Math.max(0.012, noiseFloorRef.current * 3.5)
        const voice = rms > thr

        if (voice) {
          hadVoiceInSegRef.current = true
          lastVoiceAtRef.current = now
          if (!speakingRef.current) {
            speakingRef.current = true
            voiceStartAtRef.current = now
          }
        }

        const segMs = now - segStartedAtRef.current

        // принудительная отправка, если говорим долго
        if (
          speakingRef.current &&
          hadVoiceInSegRef.current &&
          segMs > FORCE_SEND_EVERY_MS
        ) {
          speakingRef.current = false
          stopRecorderSegment("periodic")
          return
        }

        // конец речи (тишина после голоса)
        if (speakingRef.current) {
          const sinceVoice = now - lastVoiceAtRef.current
          const speechLen = now - voiceStartAtRef.current
          if (speechLen >= MIN_SPEECH_MS && sinceVoice >= SILENCE_MS) {
            speakingRef.current = false
            stopRecorderSegment("vad")
            return
          }
        }

        // safety: чтобы сегмент не рос бесконечно
        if (segMs > MAX_SEGMENT_MS) {
          speakingRef.current = false
          stopRecorderSegment("max")
          return
        }

        if (isDebugOn()) {
          dbg("[VAD]", { rms: +rms.toFixed(4), noise: +noiseFloorRef.current.toFixed(4), thr: +thr.toFixed(4), voice, rec: recorderRef.current?.state })
        }
      }, 80)
    } catch (e) {
      dbg("[VAD] disabled", e)
    }
  }

  const startCall = async (gender: "female" | "male") => {
    voiceGenderRef.current = gender
    setIsConnecting(true)
    setNetworkError(null)

    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setNetworkError(
          t("Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari.")
        )
        setIsConnecting(false)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      } as any)

      streamRef.current = stream
      const track = stream.getAudioTracks?.()[0] || null
      trackRef.current = track

      if (track) {
        track.onended = () => {
          dbg("[MIC] track ended")
          // не стопаем всё автоматически — просто покажем ошибку
          if (callActiveRef.current) {
            setNetworkError("Microphone stopped unexpectedly. Please reload the page and try again.")
            endCall()
          }
        }
      }

      callActiveRef.current = true
      setIsCallActive(true)
      setIsConnecting(false)

      // стартуем запись и VAD
      startRecorderSegment()
      await initVAD()
    } catch (error: any) {
      const name = error?.name
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(
          t("Microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page.")
        )
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setNetworkError(t("No microphone was found on this device. Please check your hardware."))
      } else {
        setNetworkError(
          t("Could not start microphone. Check permissions in the browser and system settings, then try again.")
        )
      }
      setIsConnecting(false)
      callActiveRef.current = false
      setIsCallActive(false)
    }
  }

  const toggleMic = () => {
    const next = !isMicMuted
    setIsMicMuted(next)
    setMicEnabled(!next)
  }

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
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          endCall()
          onClose()
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-xl -translate-x-1/2 -translate-y-1/2 outline-none">
          <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10">
            <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                      <Phone className="h-4 w-4" />
                    </span>
                    {t("Voice session with AI-psychologist")}
                  </div>
                  <div className="mt-1 text-xs text-indigo-100">
                    {t("You can talk out loud, the assistant will listen, answer and voice the reply.")}
                  </div>
                </div>

                <DialogPrimitive.Close asChild>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </DialogPrimitive.Close>
              </div>
            </div>

            <div className="flex h-[500px] flex-col md:h-[540px]">
              <ScrollArea className="flex-1 px-5 pt-4 pb-2">
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
                        className="h-11 flex-1 rounded-full px-5 text-xs font-semibold shadow-sm sm:max-w-xs bg-pink-50 text-pink-700 hover:bg-pink-100"
                      >
                        {isConnecting ? (
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
                        className="h-11 flex-1 rounded-full px-5 text-xs font-semibold shadow-sm sm:max-w-xs bg-sky-50 text-sky-700 hover:bg-sky-100"
                      >
                        {isConnecting ? (
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
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
