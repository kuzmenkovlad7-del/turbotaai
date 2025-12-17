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

type Role = "user" | "assistant"
type Gender = "female" | "male"

type VoiceMessage = {
  id: string
  role: Role
  text: string
  gender?: Gender
}

const TURBOTA_AGENT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL || ""

const FALLBACK_CHAT_API = "/api/chat"

// VAD / recorder
const CALIBRATE_MS = 1200
const VOICE_START_MS = 140
const SILENCE_MS = 2800
const MIN_UTTERANCE_MS = 700
const MAX_UTTERANCE_MS = 30000
const MIN_BLOB_BYTES = 5000
const MIN_THR = 0.003

const TIMESLICE_MS = 200
const PREROLL_MS = 600
const PREROLL_CHUNKS = Math.max(1, Math.ceil(PREROLL_MS / TIMESLICE_MS))

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
      ""
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
      ""
    )
      ?.toString()
      .trim()
  }
  return ""
}

function shortLangFromUI(code: any): "uk" | "ru" | "en" {
  const s = (typeof code === "string" ? code : code?.code || "uk").toLowerCase()
  if (s.startsWith("uk")) return "uk"
  if (s.startsWith("ru")) return "ru"
  return "en"
}

function ttsLang(code: "uk" | "ru" | "en"): string {
  if (code === "uk") return "uk-UA"
  if (code === "ru") return "ru-RU"
  return "en-US"
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
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

  const debugEnabled = useMemo(() => {
    if (typeof window === "undefined") return false
    try {
      return new URLSearchParams(window.location.search).get("debug") === "1"
    } catch {
      return false
    }
  }, [])

  const dlog = (...args: any[]) => {
    if (debugEnabled) console.log(...args)
  }

  // UI state
  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [networkError, setNetworkError] = useState<string | null>(null)

  // refs
  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const isAiSpeakingRef = useRef(false)
  const isProcessingRef = useRef(false)

  const voiceGenderRef = useRef<Gender>("female")
  const sessionLangRef = useRef<"uk" | "ru" | "en">("uk")

  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)

  // recorder (один на всю сессию)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recorderRunningRef = useRef(false)
  const lastRecorderTypeRef = useRef<string>("")

  const preChunksRef = useRef<Blob[]>([])
  const segmentActiveRef = useRef(false)
  const segmentChunksRef = useRef<Blob[]>([])
  const segmentBytesRef = useRef(0)
  const segmentStartAtRef = useRef(0)

  // VAD state
  const utteranceStartAtRef = useRef(0)
  const lastVoiceAtRef = useRef(0)
  const voiceActiveMsRef = useRef(0)

  // calibration
  const calibStartedAtRef = useRef(0)
  const noiseSumRef = useRef(0)
  const noiseCountRef = useRef(0)
  const noiseMaxRef = useRef(0)
  const thrRef = useRef(MIN_THR)

  const lastLogAtRef = useRef(0)
  const lastResumeAtRef = useRef(0)
  const listeningRef = useRef(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
  }, [isMicMuted])

  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking
  }, [isAiSpeaking])

  useEffect(() => {
    sessionLangRef.current = shortLangFromUI(currentLanguage)
  }, [currentLanguage, isOpen])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  function setListeningSafe(v: boolean) {
    if (listeningRef.current === v) return
    listeningRef.current = v
    setIsListening(v)
  }

  function stopAiAudio() {
    if (audioRef.current) {
      try { audioRef.current.pause() } catch {}
      audioRef.current = null
    }
  }

  function stopMonitoring() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  function cleanupAudioGraph() {
    stopMonitoring()
    try { sourceRef.current?.disconnect() } catch {}
    try { analyserRef.current?.disconnect() } catch {}
    sourceRef.current = null
    analyserRef.current = null

    const ctx = audioCtxRef.current
    audioCtxRef.current = null
    if (ctx) {
      try { ctx.close() } catch {}
    }
  }

  function stopStreamTracks() {
    const s = mediaStreamRef.current
    if (!s) return
    s.getTracks().forEach((tr) => {
      try { tr.stop() } catch {}
    })
    mediaStreamRef.current = null
  }

  function makeRecorderOptions(): MediaRecorderOptions {
    const options: MediaRecorderOptions = {}
    if (typeof MediaRecorder === "undefined") return options

    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/mp4",
    ]

    for (const c of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(c)) {
          options.mimeType = c
          return options
        }
      } catch {}
    }
    return options
  }

  function resetVadState() {
    utteranceStartAtRef.current = 0
    lastVoiceAtRef.current = 0
    voiceActiveMsRef.current = 0

    segmentActiveRef.current = false
    segmentChunksRef.current = []
    segmentBytesRef.current = 0
    segmentStartAtRef.current = 0

    preChunksRef.current = []

    listeningRef.current = false
    setIsListening(false)
  }

  function resetCalibration() {
    calibStartedAtRef.current = Date.now()
    noiseSumRef.current = 0
    noiseCountRef.current = 0
    noiseMaxRef.current = 0
    thrRef.current = MIN_THR
  }

  function updateThreshold(rms: number) {
    const now = Date.now()
    if (now - calibStartedAtRef.current <= CALIBRATE_MS) {
      noiseSumRef.current += rms
      noiseCountRef.current += 1
      noiseMaxRef.current = Math.max(noiseMaxRef.current, rms)
      const mean = noiseSumRef.current / Math.max(1, noiseCountRef.current)
      thrRef.current = Math.max(MIN_THR, mean * 6, noiseMaxRef.current * 2)
    }
  }

  async function ensureCtxRunning() {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const now = Date.now()
    if (ctx.state === "running") return
    if (now - lastResumeAtRef.current < 1000) return
    lastResumeAtRef.current = now
    try {
      await ctx.resume()
      dlog("[AUDIO] resume ->", ctx.state)
    } catch (e) {
      dlog("[AUDIO] resume failed", e)
    }
  }

  async function buildAudioGraph(stream: MediaStream) {
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
    const ctx = new AudioCtx()
    audioCtxRef.current = ctx
    try {
      await ctx.resume()
    } catch {}
    const source = ctx.createMediaStreamSource(stream)
    sourceRef.current = source

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyserRef.current = analyser
    source.connect(analyser)
  }

  async function sendBlobToStt(blob: Blob) {
    try {
      const sttLang = sessionLangRef.current
      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
          "x-stt-lang": sttLang,
        },
        body: blob,
      })

      const raw = await res.text()
      let data: any = null
      try { data = raw ? JSON.parse(raw) : null } catch {}

      if (!res.ok || !data || data.success === false) {
        console.error("[STT] error", res.status, raw)
        return ""
      }

      return (data.text || "").toString().trim()
    } catch (e) {
      console.error("[STT] fatal", e)
      return ""
    }
  }

  async function handleUserText(text: string) {
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
          language: sessionLangRef.current,
          email: effectiveEmail,
          mode: "voice",
          gender: voiceGenderRef.current,
          voiceLanguage: ttsLang(sessionLangRef.current),
        }),
      })

      if (!res.ok) throw new Error(`Chat API error: ${res.status}`)

      const raw = await res.text()
      let data: any = raw
      try { data = JSON.parse(raw) } catch {}

      let answer = extractAnswer(data)
      if (!answer) answer = t("I'm sorry, I couldn't process your message. Please try again.")

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          text: answer,
          gender: voiceGenderRef.current,
        },
      ])

      speakText(answer)
    } catch (e: any) {
      console.error("[CHAT] error", e)
      setNetworkError(t("Connection error. Please try again."))
      if (onError && e instanceof Error) onError(e)
    }
  }

  function speakText(text: string) {
    const clean = (text || "").trim()
    if (!clean) return

    setIsAiSpeaking(true)
    isAiSpeakingRef.current = true
    setListeningSafe(false)

    // пока ассистент говорит — сегмент закрываем и игнорим ввод
    segmentActiveRef.current = false
    segmentChunksRef.current = []
    segmentBytesRef.current = 0
    segmentStartAtRef.current = 0

    stopAiAudio()

    const language = ttsLang(sessionLangRef.current)
    const gender = voiceGenderRef.current === "male" ? "MALE" : "FEMALE"

    ;(async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: clean, language, gender }),
        })

        const raw = await res.text()
        let data: any = null
        try { data = raw ? JSON.parse(raw) : null } catch {}

        if (!res.ok || !data || data.success === false || !data.audioContent) {
          console.error("[TTS] error", data || raw)
          setIsAiSpeaking(false)
          isAiSpeakingRef.current = false
          if (isCallActiveRef.current && !isMicMutedRef.current) setListeningSafe(true)
          return
        }

        const audioUrl = `data:audio/mp3;base64,${data.audioContent}`
        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onended = () => {
          setIsAiSpeaking(false)
          isAiSpeakingRef.current = false
          if (isCallActiveRef.current && !isMicMutedRef.current) setListeningSafe(true)
        }

        audio.onerror = () => {
          setIsAiSpeaking(false)
          isAiSpeakingRef.current = false
          if (isCallActiveRef.current && !isMicMutedRef.current) setListeningSafe(true)
        }

        try { await audio.play() } catch (err) {
          console.error("[TTS] play rejected", err)
          setIsAiSpeaking(false)
          isAiSpeakingRef.current = false
          if (isCallActiveRef.current && !isMicMutedRef.current) setListeningSafe(true)
        }
      } catch (err) {
        console.error("[TTS] fatal", err)
        setIsAiSpeaking(false)
        isAiSpeakingRef.current = false
        if (isCallActiveRef.current && !isMicMutedRef.current) setListeningSafe(true)
      }
    })()
  }

  function stopRecorder() {
    const rec = recorderRef.current
    recorderRef.current = null
    recorderRunningRef.current = false
    lastRecorderTypeRef.current = ""

    try {
      if (rec && rec.state !== "inactive") rec.stop()
    } catch {}
  }

  function startRecorder(stream: MediaStream) {
    if (recorderRunningRef.current) return
    if (!isCallActiveRef.current) return

    const rec = new MediaRecorder(stream, makeRecorderOptions())
    recorderRef.current = rec
    recorderRunningRef.current = true
    lastRecorderTypeRef.current = rec.mimeType || ""

    dlog("[REC] start session", rec.mimeType || "(default)")

    rec.ondataavailable = (ev: BlobEvent) => {
      if (!isCallActiveRef.current) return
      if (!ev.data || ev.data.size <= 0) return

      // preroll ring
      const pre = preChunksRef.current
      pre.push(ev.data)
      while (pre.length > PREROLL_CHUNKS) pre.shift()
      preChunksRef.current = pre

      // segment collect
      if (!segmentActiveRef.current) return
      segmentChunksRef.current.push(ev.data)
      segmentBytesRef.current += ev.data.size
    }

    rec.onerror = (e: any) => {
      console.error("[REC] error", e)
    }

    rec.start(TIMESLICE_MS)
  }

  async function finalizeSegment(reason: string) {
    if (!isCallActiveRef.current) return
    if (isMicMutedRef.current) return
    if (isAiSpeakingRef.current) return
    if (isProcessingRef.current) return

    const chunks = segmentChunksRef.current
    const bytes = segmentBytesRef.current
    const startedAt = segmentStartAtRef.current
    const dur = startedAt ? Date.now() - startedAt : 0

    segmentActiveRef.current = false
    segmentChunksRef.current = []
    segmentBytesRef.current = 0
    segmentStartAtRef.current = 0
    utteranceStartAtRef.current = 0
    lastVoiceAtRef.current = 0
    voiceActiveMsRef.current = 0

    dlog("[SEG] finalize", { reason, bytes, dur })

    if (dur < MIN_UTTERANCE_MS) return
    if (bytes < MIN_BLOB_BYTES) return
    if (!chunks.length) return

    const recType = lastRecorderTypeRef.current || chunks[0]?.type || "application/octet-stream"
    const blob = new Blob(chunks, { type: recType })

    isProcessingRef.current = true
    try {
      const text = await sendBlobToStt(blob)
      const clean = (text || "").trim()
      dlog("[STT] text:", clean)
      if (!clean) return

      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-user`, role: "user", text: clean },
      ])

      await handleUserText(clean)
    } finally {
      isProcessingRef.current = false
      await sleep(60)
    }
  }

  function startVadLoop() {
    const analyser = analyserRef.current
    if (!analyser) return

    const data = new Float32Array(new ArrayBuffer(analyser.fftSize * 4))

    const tick = () => {
      if (!isCallActiveRef.current) return

      // keep audio ctx alive
      void ensureCtxRunning()

      if (isMicMutedRef.current || isAiSpeakingRef.current || isProcessingRef.current) {
        if (segmentActiveRef.current) {
          segmentActiveRef.current = false
          segmentChunksRef.current = []
          segmentBytesRef.current = 0
          segmentStartAtRef.current = 0
        }
        setListeningSafe(false)
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      analyser.getFloatTimeDomainData(data)

      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = data[i]
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)
      updateThreshold(rms)

      const thr = thrRef.current
      const now = Date.now()
      const isVoice = rms > thr

      if (isVoice) {
        lastVoiceAtRef.current = now
        voiceActiveMsRef.current += 16
      } else {
        voiceActiveMsRef.current = Math.max(0, voiceActiveMsRef.current - 10)
      }

      // start segment
      if (!segmentActiveRef.current && isVoice && voiceActiveMsRef.current >= VOICE_START_MS) {
        segmentActiveRef.current = true
        segmentChunksRef.current = [...preChunksRef.current] // preroll
        segmentBytesRef.current = segmentChunksRef.current.reduce((a, b) => a + (b?.size || 0), 0)
        segmentStartAtRef.current = now
        utteranceStartAtRef.current = now
        setListeningSafe(true)
        dlog("[SEG] start")
      }

      // stop segment
      if (segmentActiveRef.current) {
        const started = segmentStartAtRef.current || now
        const dur = now - started
        const sinceVoice = lastVoiceAtRef.current ? now - lastVoiceAtRef.current : 0

        if (dur >= MAX_UTTERANCE_MS) {
          void finalizeSegment("max")
        } else if (lastVoiceAtRef.current && sinceVoice >= SILENCE_MS && dur >= MIN_UTTERANCE_MS) {
          void finalizeSegment("silence")
        }
      }

      if (debugEnabled) {
        const last = lastLogAtRef.current
        if (now - last >= 500) {
          lastLogAtRef.current = now
          dlog("[VAD]", {
            rms: +rms.toFixed(4),
            thr: +thr.toFixed(4),
            voice: isVoice,
            seg: segmentActiveRef.current,
            bytes: segmentBytesRef.current,
          })
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  function attachTrackHandlers(stream: MediaStream) {
    const tr = stream.getAudioTracks()[0]
    if (!tr) return

    dlog("[MIC] label:", tr.label, "readyState:", tr.readyState)

    tr.onended = () => {
      console.warn("[MIC] track ended")
      setNetworkError(t("Microphone stopped unexpectedly. Please reload the page and try again."))
      endCall()
    }
  }

  const startCall = async (gender: Gender) => {
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

      await new Promise<void>((r) => requestAnimationFrame(() => r()))

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })

      mediaStreamRef.current = stream
      attachTrackHandlers(stream)

      isCallActiveRef.current = true
      setIsCallActive(true)

      isMicMutedRef.current = false
      setIsMicMuted(false)

      isAiSpeakingRef.current = false
      setIsAiSpeaking(false)

      setListeningSafe(true)

      resetCalibration()
      resetVadState()

      cleanupAudioGraph()
      await buildAudioGraph(stream)

      startRecorder(stream)

      stopMonitoring()
      startVadLoop()

      setIsConnecting(false)
    } catch (e: any) {
      console.error("[CALL] start error", e)
      const name = e?.name
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(t("Microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page."))
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setNetworkError(t("No microphone was found on this device. Please check your hardware."))
      } else {
        setNetworkError(t("Could not start microphone. Check permissions in the browser and system settings, then try again."))
      }
      setIsConnecting(false)
      endCall()
    }
  }

  const endCall = () => {
    isCallActiveRef.current = false
    setIsCallActive(false)

    setListeningSafe(false)
    isMicMutedRef.current = false
    setIsMicMuted(false)

    isAiSpeakingRef.current = false
    setIsAiSpeaking(false)

    setNetworkError(null)

    stopAiAudio()

    segmentActiveRef.current = false
    segmentChunksRef.current = []
    segmentBytesRef.current = 0
    segmentStartAtRef.current = 0
    preChunksRef.current = []

    stopRecorder()
    cleanupAudioGraph()
    stopStreamTracks()
  }

  const toggleMic = () => {
    const next = !isMicMutedRef.current
    isMicMutedRef.current = next
    setIsMicMuted(next)

    if (next) {
      setListeningSafe(false)
      segmentActiveRef.current = false
      segmentChunksRef.current = []
      segmentBytesRef.current = 0
      segmentStartAtRef.current = 0
    } else {
      if (isCallActiveRef.current && !isAiSpeakingRef.current) setListeningSafe(true)
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
    return () => endCall()
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
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 pr-12 text-white">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold leading-tight sm:text-lg">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Phone className="h-4 w-4" />
              </span>
              <span className="block min-w-0 truncate">{t("Voice session with AI-psychologist")}</span>
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-indigo-100">
              {t("You can talk out loud, the assistant will listen, answer and voice the reply.")}
            </DialogDescription>
          </DialogHeader>

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
                        isMicMuted ? "border-rose-200 bg-rose-50 text-rose-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"
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
                      className="h-11 flex-1 rounded-full bg-pink-50 px-5 text-xs font-semibold text-pink-700 shadow-sm hover:bg-pink-100 sm:max-w-xs"
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
                      className="h-11 flex-1 rounded-full bg-sky-50 px-5 text-xs font-semibold text-sky-700 shadow-sm hover:bg-sky-100 sm:max-w-xs"
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
      </DialogContent>
    </Dialog>
  )
}
