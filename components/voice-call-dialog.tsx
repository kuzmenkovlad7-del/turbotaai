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

// Настройки “дослушивания”
const VOICE_START_MS = 140
const SILENCE_MS = 2800
const MIN_UTTERANCE_MS = 700
const MAX_UTTERANCE_MS = 20000
const MIN_BLOB_BYTES = 7000

// ВАЖНО: порог теперь будет автокалиброваться, но базу задаём разную для desktop/mobile
const BASE_THRESHOLD_DESKTOP = 0.0045
const BASE_THRESHOLD_MOBILE = 0.010

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

function detectLangFromText(s: string): "uk" | "ru" | null {
  const text = (s || "").toLowerCase()
  const hasUk = /[іїєґ]/.test(text)
  const hasRu = /[ёыэъ]/.test(text)
  if (hasUk && !hasRu) return "uk"
  if (hasRu && !hasUk) return "ru"
  if (hasUk) return "uk"
  if (hasRu) return "ru"
  return null
}

function mapShortToTts(lang: string): string {
  if (lang === "uk") return "uk-UA"
  if (lang === "ru") return "ru-RU"
  return "en-US"
}

function isMobileUA(): boolean {
  if (typeof navigator === "undefined") return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "")
}

function getDebugFlag(): boolean {
  if (typeof window === "undefined") return false
  try {
    const p = new URLSearchParams(window.location.search)
    return p.get("debug") === "1" || localStorage.getItem("turbota_debug") === "1"
  } catch {
    return false
  }
}

function getRms(analyser: AnalyserNode): number {
  // Chrome/Edge: getFloatTimeDomainData есть
  // Если вдруг нет — fallback на byte
  const anyA: any = analyser as any
  if (typeof anyA.getFloatTimeDomainData === "function") {
    const data = new Float32Array(analyser.fftSize)
    anyA.getFloatTimeDomainData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const v = data[i]
      sum += v * v
    }
    return Math.sqrt(sum / data.length)
  }

  const data = new Uint8Array(analyser.fftSize)
  analyser.getByteTimeDomainData(data)
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128
    sum += v * v
  }
  return Math.sqrt(sum / data.length)
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

  const voiceGenderRef = useRef<"female" | "male">("female")
  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  // refs чтобы state не “устаревал”
  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const isAiSpeakingRef = useRef(false)

  const sessionLangRef = useRef<"uk" | "ru" | "en">("uk")

  const mediaStreamRef = useRef<MediaStream | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingRef = useRef(false)

  const voiceActiveMsRef = useRef(0)
  const lastVoiceAtRef = useRef(0)
  const utteranceStartAtRef = useRef(0)

  // автокалибровка порога
  const noiseFloorRef = useRef(0.002)
  const lastDebugLogAtRef = useRef(0)
  const everHadVoiceRef = useRef(false)
  const noVoiceWarnedRef = useRef(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
  }, [isMicMuted])

  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking
  }, [isAiSpeaking])

  useEffect(() => {
    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    const lower = String(lang).toLowerCase()
    if (lower.startsWith("uk")) sessionLangRef.current = "uk"
    else if (lower.startsWith("ru")) sessionLangRef.current = "ru"
    else sessionLangRef.current = "en"
  }, [currentLanguage, isOpen])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  function getCurrentGender(): "MALE" | "FEMALE" {
    const g = voiceGenderRef.current || "female"
    return g === "male" ? "MALE" : "FEMALE"
  }

  function getAgentLangShort(): string {
    return sessionLangRef.current
  }

  function getAgentLangCode(): string {
    return mapShortToTts(sessionLangRef.current)
  }

  function cleanupRecorder() {
    const rec = recorderRef.current
    if (rec) {
      try {
        if (rec.state !== "inactive") rec.stop()
      } catch {}
    }
    recorderRef.current = null
    chunksRef.current = []
    recordingRef.current = false
  }

  function stopMonitoring() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  function cleanupAudioGraph() {
    stopMonitoring()

    try {
      sourceRef.current?.disconnect()
    } catch {}
    try {
      analyserRef.current?.disconnect()
    } catch {}

    sourceRef.current = null
    analyserRef.current = null

    const ctx = audioCtxRef.current
    audioCtxRef.current = null
    if (ctx) {
      try {
        ctx.close()
      } catch {}
    }
  }

  async function sendBlobToStt(blob: Blob) {
    try {
      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
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

    const agentLang = getAgentLangShort()
    const agentVoiceLang = getAgentLangCode()

    try {
      const res = await fetch(resolvedWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          language: agentLang,
          email: effectiveEmail,
          mode: "voice",
          gender: voiceGenderRef.current,
          voiceLanguage: agentVoiceLang,
        }),
      })

      if (!res.ok) throw new Error(`Chat API error: ${res.status}`)

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {}

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

  function stopAiAudio() {
    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch {}
      audioRef.current = null
    }
  }

  function speakText(text: string) {
    if (typeof window === "undefined") return
    const cleanText = (text || "").trim()
    if (!cleanText) return

    setIsAiSpeaking(true)
    isAiSpeakingRef.current = true
    setIsListening(false)

    // если сейчас писали — оборвём сегмент, чтобы не смешивать
    cleanupRecorder()

    const language = getAgentLangCode()
    const gender = getCurrentGender()

    ;(async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText, language, gender }),
        })

        const raw = await res.text()
        let data: any = null
        try {
          data = raw ? JSON.parse(raw) : null
        } catch {
          data = null
        }

        if (!res.ok || !data || data.success === false || !data.audioContent) {
          console.error("[TTS] error", data || raw)
          setIsAiSpeaking(false)
          isAiSpeakingRef.current = false
          if (!isMicMutedRef.current && isCallActiveRef.current) setIsListening(true)
          return
        }

        const audioUrl = `data:audio/mp3;base64,${data.audioContent}`
        stopAiAudio()

        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onended = () => {
          setIsAiSpeaking(false)
          isAiSpeakingRef.current = false
          if (!isMicMutedRef.current && isCallActiveRef.current) setIsListening(true)
        }

        audio.onerror = () => {
          setIsAiSpeaking(false)
          isAiSpeakingRef.current = false
          if (!isMicMutedRef.current && isCallActiveRef.current) setIsListening(true)
        }

        try {
          await audio.play()
        } catch (e) {
          console.error("[TTS] play rejected", e)
          setIsAiSpeaking(false)
          isAiSpeakingRef.current = false
          if (!isMicMutedRef.current && isCallActiveRef.current) setIsListening(true)
        }
      } catch (e) {
        console.error("[TTS] fatal", e)
        setIsAiSpeaking(false)
        isAiSpeakingRef.current = false
        if (!isMicMutedRef.current && isCallActiveRef.current) setIsListening(true)
      }
    })()
  }

  function makeRecorderOptions(): MediaRecorderOptions {
    const options: MediaRecorderOptions = {}
    if (typeof MediaRecorder === "undefined") return options

    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      options.mimeType = "audio/webm;codecs=opus"
    } else if (MediaRecorder.isTypeSupported("audio/webm")) {
      options.mimeType = "audio/webm"
    } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
      options.mimeType = "audio/mp4"
    }
    return options
  }

  function startNewUtteranceRecorder(stream: MediaStream) {
    if (recordingRef.current) return
    if (isMicMutedRef.current) return
    if (isAiSpeakingRef.current) return
    if (!isCallActiveRef.current) return

    chunksRef.current = []

    const rec = new MediaRecorder(stream, makeRecorderOptions())
    recorderRef.current = rec
    recordingRef.current = true
    utteranceStartAtRef.current = Date.now()

    rec.ondataavailable = (ev: BlobEvent) => {
      if (!ev.data || ev.data.size <= 0) return
      chunksRef.current.push(ev.data)
    }

    rec.onstop = async () => {
      recordingRef.current = false

      const duration = Date.now() - utteranceStartAtRef.current
      const blobType =
        rec.mimeType || chunksRef.current[0]?.type || "application/octet-stream"
      const blob = new Blob(chunksRef.current, { type: blobType })
      chunksRef.current = []

      if (duration < MIN_UTTERANCE_MS) return
      if (blob.size < MIN_BLOB_BYTES) return
      if (!isCallActiveRef.current) return
      if (isMicMutedRef.current) return
      if (isAiSpeakingRef.current) return

      const text = await sendBlobToStt(blob)
      const clean = (text || "").trim()
      if (!clean) return

      const detected = detectLangFromText(clean)
      if (detected) sessionLangRef.current = detected

      const userMsg: VoiceMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text: clean,
      }
      setMessages((prev) => [...prev, userMsg])

      await handleUserText(clean)
    }

    rec.start(250)
  }

  function stopUtteranceRecorder() {
    const rec = recorderRef.current
    if (!rec) return
    try {
      if (rec.state === "recording" || rec.state === "paused") {
        try {
          rec.requestData()
        } catch {}
        rec.stop()
      }
    } catch {}
  }

  function monitorVadLoop() {
    const analyser = analyserRef.current
    const ctx = audioCtxRef.current
    if (!analyser || !ctx) return

    const DEBUG = getDebugFlag()
    const base = isMobileUA() ? BASE_THRESHOLD_MOBILE : BASE_THRESHOLD_DESKTOP
    const startedAt = Date.now()

    const tick = () => {
      if (!isCallActiveRef.current) return

      // если AudioContext заморожен — пробуем резюм
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {})
      }

      // если микрофон выключен или ассистент говорит — стопаем запись и ждём
      if (isMicMutedRef.current || isAiSpeakingRef.current) {
        if (recordingRef.current) stopUtteranceRecorder()
        voiceActiveMsRef.current = 0
        lastVoiceAtRef.current = 0
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const rms = getRms(analyser)

      // автокалибровка noise floor (когда “тишина”)
      // чем ниже mic на ПК — тем ниже noise floor → тем ниже threshold
      const nf = noiseFloorRef.current
      const nf2 = nf * 0.96 + rms * 0.04
      noiseFloorRef.current = Math.min(Math.max(nf2, 0.0005), 0.05)

      const dynamicThreshold = Math.max(base, noiseFloorRef.current * 4 + 0.0015)
      const now = Date.now()

      const isVoice = rms > dynamicThreshold

      if (isVoice) {
        everHadVoiceRef.current = true
        if (!lastVoiceAtRef.current) lastVoiceAtRef.current = now
        lastVoiceAtRef.current = now
        voiceActiveMsRef.current += 16
      } else {
        voiceActiveMsRef.current = Math.max(0, voiceActiveMsRef.current - 10)
      }

      // старт записи, когда голос стабильно появился
      if (!recordingRef.current && isVoice && voiceActiveMsRef.current >= VOICE_START_MS) {
        startNewUtteranceRecorder(mediaStreamRef.current!)
        setIsListening(true)
      }

      if (recordingRef.current) {
        const started = utteranceStartAtRef.current || now
        const dur = now - started
        const sinceVoice = lastVoiceAtRef.current ? now - lastVoiceAtRef.current : 0

        if (dur >= MAX_UTTERANCE_MS) {
          stopUtteranceRecorder()
        } else if (lastVoiceAtRef.current && sinceVoice >= SILENCE_MS && dur >= MIN_UTTERANCE_MS) {
          stopUtteranceRecorder()
        }
      }

      // если на ПК вообще нет энергии (или выбран не тот input) — покажем подсказку
      if (!noVoiceWarnedRef.current) {
        const elapsed = now - startedAt
        if (elapsed > 4500 && !everHadVoiceRef.current) {
          noVoiceWarnedRef.current = true
          setNetworkError(
            "На ПК не вижу сигнал микрофона. Проверь: разрешение микрофона в адресной строке, выбранный input в системе/браузере, и что микрофон не занят другим приложением. Для логов открой страницу с ?debug=1.",
          )
        }
      }

      if (DEBUG && now - lastDebugLogAtRef.current > 1000) {
        lastDebugLogAtRef.current = now
        // eslint-disable-next-line no-console
        console.log("[VAD]", {
          rms: Number(rms.toFixed(5)),
          noise: Number(noiseFloorRef.current.toFixed(5)),
          thr: Number(dynamicThreshold.toFixed(5)),
          ctx: ctx.state,
          rec: recorderRef.current?.state || "none",
        })
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  const startCall = async (gender: "female" | "male") => {
    voiceGenderRef.current = gender

    setIsConnecting(true)
    setNetworkError(null)

    // reset diagnostics
    noiseFloorRef.current = 0.002
    lastDebugLogAtRef.current = 0
    everHadVoiceRef.current = false
    noVoiceWarnedRef.current = false

    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setNetworkError(
          t(
            "Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari.",
          ),
        )
        setIsConnecting(false)
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } as any,
      })

      mediaStreamRef.current = stream

      const AudioCtx = (window.AudioContext ||
        (window as any).webkitAudioContext) as typeof AudioContext
      const ctx = new AudioCtx()
      audioCtxRef.current = ctx

      try {
        if (ctx.state === "suspended") await ctx.resume()
      } catch {}

      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyserRef.current = analyser

      source.connect(analyser)

      cleanupRecorder()
      voiceActiveMsRef.current = 0
      lastVoiceAtRef.current = 0
      utteranceStartAtRef.current = 0

      isCallActiveRef.current = true
      setIsCallActive(true)
      setIsMicMuted(false)
      isMicMutedRef.current = false

      setIsAiSpeaking(false)
      isAiSpeakingRef.current = false

      setIsListening(true)

      stopMonitoring()
      monitorVadLoop()

      setIsConnecting(false)
    } catch (error: any) {
      console.error("[CALL] start error:", error)

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
          t(
            "Could not start microphone. Check permissions in the browser and system settings, then try again.",
          ),
        )
      }

      setIsConnecting(false)
      isCallActiveRef.current = false
      setIsCallActive(false)
      cleanupRecorder()
      cleanupAudioGraph()
    }
  }

  const endCall = () => {
    isCallActiveRef.current = false
    setIsCallActive(false)

    setIsListening(false)
    setIsMicMuted(false)
    isMicMutedRef.current = false

    setIsAiSpeaking(false)
    isAiSpeakingRef.current = false

    setNetworkError(null)

    stopAiAudio()
    cleanupRecorder()
    cleanupAudioGraph()

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {}
      })
      mediaStreamRef.current = null
    }
  }

  const toggleMic = () => {
    const next = !isMicMutedRef.current
    isMicMutedRef.current = next
    setIsMicMuted(next)

    if (next) {
      setIsListening(false)
      if (recordingRef.current) stopUtteranceRecorder()
    } else {
      if (isCallActiveRef.current && !isAiSpeakingRef.current) setIsListening(true)
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
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 text-base font-semibold leading-tight sm:text-lg">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <Phone className="h-4 w-4" />
                  </span>
                  <span className="block min-w-0 truncate">
                    {t("Voice session with AI-psychologist")}
                  </span>
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {t(
                    "You can talk out loud, the assistant will listen, answer and voice the reply.",
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex h-[500px] flex-col md:h-[540px]">
            <ScrollArea className="flex-1 px-5 pt-4 pb-2">
              <div ref={scrollRef} className="max-h-full space-y-3 pr-1 text-xs md:text-sm">
                {!isCallActive && messages.length === 0 && (
                  <div className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-slate-700">
                    <p className="mb-1 font-medium text-slate-900">{t("How it works")}</p>
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
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
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
