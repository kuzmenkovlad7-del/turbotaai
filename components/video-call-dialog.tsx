// @ts-nocheck
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  X,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  Sparkles,
  Brain,
  Video,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import {
  getLocaleForLanguage,
  getNativeSpeechParameters,
  getNativeVoicePreferences,
} from "@/lib/i18n/translation-utils"

const VIDEO_ASSISTANT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AI_VIDEO_ASSISTANT_WEBHOOK_URL ||
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL ||
  "/api/turbotaai-agent"

interface AICharacter {
  id: string
  name: string
  gender: "male" | "female"
  description: string
  avatar: string
  animated?: boolean
  idleVideo?: string
  speakingVideo?: string
}

const AI_CHARACTERS: AICharacter[] = [
  {
    id: "dr-alexander",
    name: "Dr. Alexander",
    gender: "male",
    description:
      "Senior psychologist specializing in cognitive behavioral therapy with 15+ years of experience",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-19%D1%83-iWDrUd3gH9sLBeOjmIvu8wX3yxwBuq.jpg",
    animated: true,
    idleVideo:
      "/avatars/avatar3_idle.mp4",
    speakingVideo:
      "/avatars/avatar3_speaking.mp4",
  },
    {
    id: "dr-maria",
    name: "Dr. Maria",
    gender: "female",
    description:
      "Psychotherapist specializing in emotional regulation, trauma recovery, and relationship counseling",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-18-BmxDH7DCv7e3p0y8HobTyoPkQw1COM.jpg",
    animated: true,
    idleVideo:
      "/avatars/avatar1_idle.mp4",
    speakingVideo:
      "/avatars/avatar1_speaking.mp4",
  },
{
    id: "dr-sophia",
    name: "Dr. Sophia",
    gender: "female",
    description:
      "Clinical psychologist specializing in anxiety, depression, and workplace stress management",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-ds8y3Pe7RedqJBqZMDPltEeFI149ki.jpg",
    animated: true,
    idleVideo:
      "/avatars/avatar2_idle.mp4",
    speakingVideo:
      "/avatars/avatar2_speaking.mp4",
  },
]

declare global {
  interface Window {
    speechSynthesis?: SpeechSynthesis
    AudioContext?: any
    webkitAudioContext?: any
  }
}

interface VideoCallDialogProps {
  isOpen: boolean
  onClose: () => void
  openAiApiKey?: string
  onError?: (error: Error) => void
}

type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
}

function pickMime(): string | null {
  const MR: any = typeof MediaRecorder !== "undefined" ? MediaRecorder : null
  if (!MR || !MR.isTypeSupported) return null

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
  ]

  for (const c of candidates) {
    try {
      if (MR.isTypeSupported(c)) return c
    } catch {}
  }
  return null
}

function normalizeUtterance(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[.,!?;:«»"“”‚‘’…]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function collapseLeadingWordRepeats(text: string): string {
  let t = (text || "").trim()
  if (!t) return t
  for (let i = 0; i < 6; i++) {
    const parts = t.split(/\s+/)
    if (parts.length < 2) break
    const a = normalizeUtterance(parts[0])
    const b = normalizeUtterance(parts[1])
    if (a && b && a === b) {
      t = parts.slice(1).join(" ").trim()
      continue
    }
    break
  }
  return t
}

function splitSentencesKeepPunct(text: string): string[] {
  const t = (text || "").replace(/\s+/g, " ").trim()
  if (!t) return []
  const parts = t.match(/[^.!?]+[.!?]?/g)
  if (!parts) return [t]
  return parts.map((p) => p.trim()).filter(Boolean)
}

function dedupeConsecutive(parts: string[]): string[] {
  const out: string[] = []
  let prevNorm = ""
  for (const raw of parts) {
    const p = (raw || "").trim()
    if (!p) continue
    const n = normalizeUtterance(p)
    if (!n) continue
    if (n === prevNorm) continue
    out.push(p)
    prevNorm = n
  }
  return out
}

function sanitizeCommaRepeatsInSentence(sentence: string): string {
  let s = (sentence || "").trim()
  if (!s) return s

  const endPunct = /[.!?]$/.test(s) ? s.slice(-1) : ""
  const body = endPunct ? s.slice(0, -1) : s

  const commaCount = (body.match(/,/g) || []).length
  if (commaCount < 2) return s

  const parts = body.split(/\s*,\s*/g).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 3) return s

  const deduped = dedupeConsecutive(parts)
  const joined = deduped.join(", ").trim()
  return (joined + endPunct).trim()
}

function sanitizeTextRepetitions(text: string): string {
  let t = (text || "").trim()
  if (!t) return t

  const sentences = splitSentencesKeepPunct(t)
  if (sentences.length >= 2) {
    t = dedupeConsecutive(sentences).join(" ").trim()
  }

  const sentences2 = splitSentencesKeepPunct(t).map(sanitizeCommaRepeatsInSentence)
  t = sentences2.join(" ").replace(/\s+/g, " ").trim()

  const toks = normalizeUtterance(t).split(" ").filter(Boolean)
  if (toks.length >= 40) {
    const uniq = new Set(toks).size
    const ratio = uniq / toks.length
    if (ratio < 0.35) {
      const first = splitSentencesKeepPunct(t).slice(0, 2)
      t = first.join(" ").trim()
    }
  }

  return t
}

function sanitizeUserText(text: string): string {
  let t = (text || "").trim()
  if (!t) return t
  t = collapseLeadingWordRepeats(t)
  t = sanitizeTextRepetitions(t)
  return t.trim()
}

function sanitizeAssistantText(text: string): string {
  let t = (text || "").trim()
  if (!t) return t
  t = collapseLeadingWordRepeats(t)
  t = sanitizeTextRepetitions(t)
  const sents = splitSentencesKeepPunct(t)
  if (sents.length > 5) t = sents.slice(0, 5).join(" ").trim()
  return t.trim()
}

function stripLeadingEchoOfPrev(delta: string, prevSentNorm: string, prevSentTs: number): string {
  let t = (delta || "").trim()
  if (!t) return t
  const dt = Date.now() - (prevSentTs || 0)
  if (!prevSentNorm || dt > 15000) return t

  const prevWords = prevSentNorm.split(" ").filter(Boolean)
  if (prevWords.length === 0 || prevWords.length > 2) return t

  const firstWord = normalizeUtterance(t.split(/\s+/)[0] || "")
  const prevLast = prevWords[prevWords.length - 1] || ""
  if (firstWord && prevLast && firstWord === prevLast) {
    const parts = t.split(/\s+/)
    if (parts.length >= 2) return parts.slice(1).join(" ").trim()
  }
  return t
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

function isMostlyGarbage(text: string): boolean {
  const t = (text || "").trim()
  if (!t) return true
  const norm = normalizeUtterance(t)
  if (!norm) return true

  if (norm.length < 3) return true

  const toks = norm.split(" ")
  if (toks.length === 1 && toks[0].length <= 2) return true

  const letters = (t.match(/[A-Za-zА-Яа-яЇїІіЄєҐґ]/g) || []).length
  const total = t.length
  if (total > 0 && letters / total < 0.45) return true

  const bannedSub = [
    "обратите внимание",
    "зверніть увагу",
    "звернить увагу",
    "на экран",
    "на екрані",
    "на екрані",
    "подпиш",
    "подписывай",
    "лайк",
    "ставьте",
    "на канал",
    "в описании",
    "ссылка",
    "спонсор",
    "реклама",
    "промокод",
    "фотография",
    "скриншот",
    "нажмите",
    "кнопк",
  ]
  for (const b of bannedSub) {
    if (norm.includes(b)) return true
  }

  const bannedExact = new Set([
    "угу",
    "ага",
    "мм",
    "м",
    "а",
    "ну",
    "так",
    "ок",
    "okay",
    "yes",
    "no",
    "hello",
    "hi",
  ])
  if (toks.length === 1 && bannedExact.has(toks[0])) return true

  if (/(\b\w+\b)(?:\s+\1){5,}/i.test(norm)) return true

  return false
}

function cleanResponseText(text: string): string {
  if (!text) return ""
  if (text.startsWith('[{"output":')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].output) {
        return String(parsed[0].output).trim()
      }
    } catch {}
  }
  return text
    .replace(/\n\n/g, " ")
    .replace(/\*\*/g, "")
    .replace(/```/g, "")
    .replace(/[\n\r]/g, " ")
    .trim()
}

function extractAnswer(data: any): string {
  if (!data) return ""
  if (typeof data === "string") return data.trim()

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] ?? {}
    return (
      first.output ||
      first.response ||
      first.text ||
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
      data.output ||
      data.response ||
      data.text ||
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

function b64ToBlobUrl(b64: string, mime: string): { url: string; revoke: () => void } {
  const clean = (b64 || "").trim()
  const binary = typeof atob === "function" ? atob(clean) : ""
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: mime || "audio/mpeg" })
  const url = URL.createObjectURL(blob)
  return { url, revoke: () => URL.revokeObjectURL(url) }
}

export default function VideoCallDialog({
  isOpen,
  onClose,
  openAiApiKey,
  onError,
}: VideoCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const activeLanguage =
    currentLanguage || ({ code: "en", name: "English", flag: "🇺��" } as any)

  const languageDisplayName =
    activeLanguage.name ||
    (activeLanguage.code === "uk"
      ? "Ukrainian"
      : activeLanguage.code === "ru"
      ? "Russian"
      : "English")

  const currentLocale = getLocaleForLanguage(activeLanguage.code)
  const nativeVoicePreferences = getNativeVoicePreferences()

  const [selectedCharacter, setSelectedCharacter] = useState<AICharacter>(
    AI_CHARACTERS[1] || AI_CHARACTERS[0],
  )

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)

  const [isListening, setIsListening] = useState(false)
  const [activityStatus, setActivityStatus] = useState<
    "listening" | "thinking" | "speaking"
  >("listening")
  const [speechError, setSpeechError] = useState<string | null>(null)

  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const isAiSpeakingRef = useRef(false)

  // ВАЖНО: это состояние отвечает именно за "анимацию/спик" аватара в момент реального начала/конца озвучки
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false)
  const isAvatarSpeakingRef = useRef(false)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [interimTranscript, setInterimTranscript] = useState("")

  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const idleVideoRef = useRef<HTMLVideoElement | null>(null)
  const speakingVideoRef = useRef<HTMLVideoElement | null>(null)

  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const voiceCacheRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map())

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)

  const stopReasonRef = useRef<"silence" | "tts" | "manual" | "end" | null>(null)

  const rawStreamRef = useRef<MediaStream | null>(null)
  const bridgedStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)

  const keepAudioElRef = useRef<HTMLAudioElement | null>(null)

  // recorder chunking (как в voice-assistant)
  const audioChunksRef = useRef<Blob[]>([])
  const sentIdxRef = useRef(0)

  const pendingSttReasonRef = useRef<string | null>(null)
  const pendingSttTimerRef = useRef<number | null>(null)

  const isSttBusyRef = useRef(false)
  const lastTranscriptRef = useRef("") // ВАЖНО: не сбрасывать на TTS
  const lastUserSentNormRef = useRef("")
  const lastUserSentTsRef = useRef(0)

  const lastAssistantSentNormRef = useRef("")
  const lastAssistantSentTsRef = useRef(0)

  const ttsCooldownUntilRef = useRef(0)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const ttsObjectUrlRef = useRef<string | null>(null)

  const MIN_UTTERANCE_MS = 450
  const hangoverMs = 1800
  const maxUtteranceMs = 20000

  const startListeningInFlightRef = useRef(false)

  // фиксируем язык на момент старта звонка (STT/TTS/агент)
  const sessionVoiceLangRef = useRef<string>("uk-UA")
  const sessionAgentLangRef = useRef<"uk" | "ru" | "en">("uk")

  // iOS/Safari: prime audio playback on first user gesture
  useEffect(() => {
    let done = false
    const prime = () => {
      if (done) return
      done = true
      try {
        const a = ttsAudioRef.current ?? new Audio()
        ;(a as any).playsInline = true
        ;(a as any).preload = "auto"
        a.muted = true
        a.src =
          "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA="
        ttsAudioRef.current = a
        const p = a.play()
        ;(p as any)?.catch?.(() => {})
        try {
          a.pause()
          a.currentTime = 0
          a.muted = false
          a.src = ""
        } catch {}
      } catch (e) {
        console.warn("[TTS] prime failed", e)
      }
    }

    window.addEventListener("touchstart", prime as any, {
      passive: true,
      once: true,
    } as any)
    window.addEventListener("mousedown", prime as any, { once: true } as any)
    return () => {
      window.removeEventListener("touchstart", prime as any)
      window.removeEventListener("mousedown", prime as any)
    }
  }, [])

  const vad = useRef({
    noiseFloor: 0,
    thr: 0.008,
    voice: false,
    voiceUntilTs: 0,
    utteranceStartTs: 0,
  })

  const isMobile = useMemo(() => {
    if (typeof navigator === "undefined") return false
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  }, [])

  useEffect(() => {
    isCallActiveRef.current = isCallActive
  }, [isCallActive])

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
  }, [isMicMuted])

  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking
  }, [isAiSpeaking])

  useEffect(() => {
    isAvatarSpeakingRef.current = isAvatarSpeaking
  }, [isAvatarSpeaking])

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    const load = () => {
      const voices = window.speechSynthesis!.getVoices()
      if (voices.length) {
        getRefinedVoiceForLanguage(activeLanguage.code, "female")
        getRefinedVoiceForLanguage(activeLanguage.code, "male")
      }
    }
    load()
    window.speechSynthesis.addEventListener("voiceschanged", load)
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", load)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isCallActive && !isCameraOff && userVideoRef.current) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          if (userVideoRef.current) userVideoRef.current.srcObject = stream
        })
        .catch(() => setIsCameraOff(true))
    }

    return () => {
      const videoEl = userVideoRef.current
      if (videoEl?.srcObject) {
        const stream = videoEl.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        videoEl.srcObject = null
      }
    }
  }, [isCallActive, isCameraOff])

  useEffect(() => {
    if (!isOpen && isCallActive) endCall()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  function setSessionLangFromUi() {
    const code = String(activeLanguage.code || "uk").toLowerCase()
    if (code.startsWith("ru")) {
      sessionVoiceLangRef.current = "ru-RU"
      sessionAgentLangRef.current = "ru"
      return
    }
    if (code.startsWith("en")) {
      sessionVoiceLangRef.current = "en-US"
      sessionAgentLangRef.current = "en"
      return
    }
    sessionVoiceLangRef.current = "uk-UA"
    sessionAgentLangRef.current = "uk"
  }

  function computeLangCode(): string {
    return sessionVoiceLangRef.current || "uk-UA"
  }

  function computeHint3(): "uk" | "ru" | "en" {
    return sessionAgentLangRef.current || "uk"
  }

  function shouldDedupUser(text: string): boolean {
    const norm = normalizeUtterance(text)
    if (!norm) return true
    const last = lastUserSentNormRef.current || ""
    const dt = Date.now() - (lastUserSentTsRef.current || 0)
    if (last && norm === last && dt < 12000) return true
    if (last && dt < 3500) {
      const a = norm.slice(0, 25)
      const b = last.slice(0, 25)
      if (a && b && a === b) return true
    }
    return false
  }

  function shouldDedupAssistant(text: string): boolean {
    const norm = normalizeUtterance(text)
    if (!norm) return true
    const last = lastAssistantSentNormRef.current || ""
    const dt = Date.now() - (lastAssistantSentTsRef.current || 0)
    if (last && norm === last && dt < 12000) return true
    return false
  }

  async function requestMicrophoneStream(): Promise<MediaStream | null> {
    if (typeof navigator === "undefined") {
      setSpeechError(
        t(
          "Microphone access is not available in this environment. Please open the assistant in a regular browser window.",
        ),
      )
      return null
    }

    const hasMediaDevices =
      typeof navigator.mediaDevices !== "undefined" &&
      typeof navigator.mediaDevices.getUserMedia === "function"

    if (!hasMediaDevices) {
      setSpeechError(
        t(
          "Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari.",
        ),
      )
      return null
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      setSpeechError(null)
      rawStreamRef.current = stream
      return stream
    } catch (error: any) {
      console.log("[Video] getUserMedia error:", error)
      const name = error?.name

      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setSpeechError(
          t(
            "Microphone is blocked in the browser. Please allow access in the site permissions and reload the page.",
          ),
        )
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setSpeechError(t("No microphone was found on this device. Please check your hardware."))
      } else {
        setSpeechError(
          t(
            "Could not start microphone. Check permissions in the browser and system settings, then try again.",
          ),
        )
      }

      return null
    }
  }

  function stopKeepAlive() {
    const a = keepAudioElRef.current
    if (a) {
      try {
        a.pause()
      } catch {}
      try {
        ;(a as any).srcObject = null
      } catch {}
      keepAudioElRef.current = null
    }
  }

  function stopAudioGraph() {
    if (rafRef.current) {
      try {
        cancelAnimationFrame(rafRef.current)
      } catch {}
      rafRef.current = null
    }

    analyserRef.current = null

    const ctx = audioCtxRef.current
    if (ctx) {
      try {
        ctx.close()
      } catch {}
      audioCtxRef.current = null
    }
  }

  function stopStreams() {
    const raw = rawStreamRef.current
    if (raw) {
      try {
        raw.getTracks().forEach((tr) => tr.stop())
      } catch {}
      rawStreamRef.current = null
    }
    bridgedStreamRef.current = null
  }

  function stopRecorder() {
    const rec: any = mediaRecorderRef.current
    if (rec && rec._reqTimer) {
      try {
        clearInterval(rec._reqTimer)
      } catch {}
      rec._reqTimer = null
    }
    if (rec) {
      try {
        if (rec.state !== "inactive") rec.stop()
      } catch {}
    }
    mediaRecorderRef.current = null
    audioChunksRef.current = []
    sentIdxRef.current = 0
    setIsListening(false)
  }

  function resetVadState() {
    vad.current = {
      noiseFloor: 0,
      thr: 0.008,
      voice: false,
      voiceUntilTs: 0,
      utteranceStartTs: 0,
    }
  }

  async function ensureAudioGraphStarted() {
    const raw = rawStreamRef.current
    if (!raw) return

    try {
      const a = new Audio()
      a.muted = true
      ;(a as any).playsInline = true
      ;(a as any).srcObject = raw
      keepAudioElRef.current = a
      await a.play().catch(() => {})
    } catch {}

    if (audioCtxRef.current && analyserRef.current && bridgedStreamRef.current) return

    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext
    const ctx: AudioContext = new AC()
    audioCtxRef.current = ctx
    try {
      await ctx.resume()
    } catch {}

    const src = ctx.createMediaStreamSource(raw)
    const gain = ctx.createGain()
    gain.gain.value = 1.0

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyserRef.current = analyser

    const dest = ctx.createMediaStreamDestination()

    src.connect(gain)
    gain.connect(analyser)
    gain.connect(dest)

    bridgedStreamRef.current = dest.stream
  }

  function startVadLoop() {
    const analyser = analyserRef.current
    if (!analyser) return

    const data = new Uint8Array(analyser.fftSize)
    const baseThr = isMobile ? 0.012 : 0.008

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)

      if (!isCallActiveRef.current) return

      const rec: any = mediaRecorderRef.current
      if (!rec || rec.state !== "recording") return

      if (
        isAiSpeakingRef.current ||
        isMicMutedRef.current ||
        Date.now() < ttsCooldownUntilRef.current ||
        stopReasonRef.current === "tts"
      ) {
        const st = vad.current
        st.voice = false
        st.voiceUntilTs = 0
        st.utteranceStartTs = 0
        return
      }

      analyser.getByteTimeDomainData(data)

      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)

      const now = Date.now()
      const st = vad.current

      if (!st.voice) st.noiseFloor = st.noiseFloor * 0.995 + rms * 0.005
      const thr = Math.max(baseThr, st.noiseFloor * 3.6)
      const voiceNow = rms > thr

      if (voiceNow) {
        st.voiceUntilTs = now + hangoverMs
        if (!st.voice) {
          st.voice = true
          st.utteranceStartTs = now
        }
      } else {
        if (st.voice && now > st.voiceUntilTs) {
          const voiceMs = st.utteranceStartTs ? now - st.utteranceStartTs : 0
          st.voice = false
          st.utteranceStartTs = 0
          if (voiceMs >= MIN_UTTERANCE_MS) void flushAndSendStt("vad_end")
        }
      }

      if (st.voice && st.utteranceStartTs && now - st.utteranceStartTs > maxUtteranceMs) {
        st.utteranceStartTs = now
        void flushAndSendStt("max_utt")
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  async function startRecorder() {
    if (!isCallActiveRef.current) return
    if (isMicMutedRef.current) return

    const stream = bridgedStreamRef.current || rawStreamRef.current
    if (!stream) return
    const audioTracks = stream.getAudioTracks?.() || []
    if (!audioTracks.length) {
      setSpeechError(t("Microphone is not available."))
      return
    }

    // уже есть рекордер
    const existing: any = mediaRecorderRef.current
    if (existing && (existing.state === "recording" || existing.state === "paused")) return

    // сброс буфера, но НЕ lastTranscript (он нужен для delta-дедупа в рамках сессии)
    audioChunksRef.current = []
    sentIdxRef.current = 1 // ждём header + body
    resetVadState()
    setInterimTranscript("")
    setSpeechError(null)

    const mime = pickMime()
    const opts: MediaRecorderOptions = {}
    if (mime) opts.mimeType = mime

    let rec: any = null
    try {
      rec = new MediaRecorder(stream, opts)
    } catch {
      try {
        rec = new MediaRecorder(stream)
      } catch (e) {
        setSpeechError(
          t("Your browser does not support voice recording. Please use Chrome or another modern browser."),
        )
        return
      }
    }

    mediaRecorderRef.current = rec

    rec.onstart = () => {
      setIsListening(true)
      setActivityStatus("listening")
    }

    rec.ondataavailable = (ev: any) => {
      const b = ev?.data
      const size = b?.size || 0
      if (size > 0) {
        if (!isAiSpeakingRef.current && !isMicMutedRef.current) {
          audioChunksRef.current.push(b)
        }
      }

      const pending = pendingSttReasonRef.current
      if (pending) {
        pendingSttReasonRef.current = null
        if (pendingSttTimerRef.current) {
          try {
            window.clearTimeout(pendingSttTimerRef.current)
          } catch {}
          pendingSttTimerRef.current = null
        }
        void maybeSendStt(pending)
      }
    }

    rec.onerror = () => {
      setSpeechError(t("Error while listening. Please try again."))
      stopRecorder()
    }

    rec.onstop = () => {
      setIsListening(false)
    }

    try {
      rec.start()
      setIsListening(true)
      setActivityStatus("listening")
    } catch (e) {
      console.log("MediaRecorder start error:", e)
      setSpeechError(t("Error while listening. Please try again."))
      stopRecorder()
      return
    }

    const sliceMs = isMobile ? 1200 : 1000
    ;(rec as any)._reqTimer = window.setInterval(() => {
      try {
        const r = mediaRecorderRef.current
        if (r && r.state === "recording" && typeof (r as any).requestData === "function") {
          ;(r as any).requestData()
        }
      } catch {}
    }, sliceMs)

    if (!rafRef.current) startVadLoop()
  }

  function safeStartListening() {
    if (startListeningInFlightRef.current) return
    startListeningInFlightRef.current = true
    Promise.resolve()
      .then(async () => {
        await ensureAudioGraphStarted()
        if (!isCallActiveRef.current || isMicMutedRef.current) return
        if (isAiSpeakingRef.current || stopReasonRef.current === "tts") return

        const r: any = mediaRecorderRef.current
        if (r) {
          if (r.state === "paused") {
            try {
              r.resume()
            } catch {}
            setIsListening(true)
            setActivityStatus("listening")
            return
          }
          if (r.state === "recording") return
        }

        await startRecorder()
      })
      .catch(() => {})
      .finally(() => {
        startListeningInFlightRef.current = false
      })
  }

  function flushAndSendStt(reason: string) {
    const rec: any = mediaRecorderRef.current
    if (!rec || rec.state !== "recording" || typeof rec.requestData !== "function") {
      void maybeSendStt(reason)
      return
    }

    if (pendingSttReasonRef.current) return
    pendingSttReasonRef.current = reason

    try {
      rec.requestData()
    } catch {}

    if (pendingSttTimerRef.current) {
      try {
        window.clearTimeout(pendingSttTimerRef.current)
      } catch {}
    }
    pendingSttTimerRef.current = window.setTimeout(() => {
      const r = pendingSttReasonRef.current
      pendingSttReasonRef.current = null
      pendingSttTimerRef.current = null
      if (r) void maybeSendStt(r)
    }, 250)
  }

  async function maybeSendStt(reason: string) {
    if (!isCallActiveRef.current) return
    if (isAiSpeakingRef.current) return
    if (Date.now() < ttsCooldownUntilRef.current) return
    if (isMicMutedRef.current) return
    if (isSttBusyRef.current) return

    const chunks = audioChunksRef.current
    if (!chunks || chunks.length < 2) return

    const header = chunks[0]
    const sentIdx = sentIdxRef.current
    const body = chunks.slice(Math.max(1, sentIdx))
    if (!header || body.length === 0) return

    const roughSize = body.reduce((acc, b) => acc + (b?.size || 0), 0)
    if (roughSize < 7000) return

    const blob = new Blob([header, ...body], { type: header.type || body[0]?.type || "audio/webm" })
    if (blob.size < 6000) return

    try {
      isSttBusyRef.current = true
      setActivityStatus("thinking")

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
          "X-STT-Hint": "auto",
          "X-STT-Lang": computeLangCode(),
        } as any,
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
        console.error("[STT] bad response", res.status, raw)
        setActivityStatus("listening")
        return
      }

      // чистим буфер: оставляем header, чтобы webm не ломался
      const keep = audioChunksRef.current?.[0]
      audioChunksRef.current = keep ? [keep] : []
      sentIdxRef.current = keep ? 1 : 0

      const fullText = (data.text || "").toString().trim()
      if (!fullText) {
        setActivityStatus("listening")
        return
      }

      const prev = lastTranscriptRef.current
      let delta = diffTranscript(prev, fullText)
      lastTranscriptRef.current = fullText

      delta = stripLeadingEchoOfPrev(delta, lastUserSentNormRef.current, lastUserSentTsRef.current)
      delta = sanitizeUserText(delta)

      if (!delta) {
        setActivityStatus("listening")
        return
      }
      if (isMostlyGarbage(delta)) {
        setActivityStatus("listening")
        return
      }
      if (shouldDedupUser(delta)) {
        setActivityStatus("listening")
        return
      }

      lastUserSentNormRef.current = normalizeUtterance(delta)
      lastUserSentTsRef.current = Date.now()

      setMessages((prevMsgs) => [...prevMsgs, { id: prevMsgs.length + 1, role: "user", text: delta }])
      await handleUserText(delta)
    } catch (err: any) {
      console.error("[STT] fatal", err)
      setSpeechError(t("I couldn't recognize speech. Please try again."))
    } finally {
      isSttBusyRef.current = false
      if (isCallActiveRef.current && !isMicMutedRef.current && !isAiSpeakingRef.current) {
        setActivityStatus("listening")
      }
    }
  }

  function stopCurrentSpeech() {
    // stop server audio (keep ttsAudioRef element for iOS unlock)
    const a = currentAudioRef.current
    if (a) {
      try {
        a.onended = null
        a.onerror = null
        a.onplay = null
      } catch {}
      try {
        a.pause()
        a.currentTime = 0
      } catch {}
      try {
        a.src = ""
      } catch {}
      currentAudioRef.current = null
    }

    if (ttsObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(ttsObjectUrlRef.current)
      } catch {}
      ttsObjectUrlRef.current = null
    }

    // stop browser speech synthesis
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel()
      } catch {}
    }
    currentUtteranceRef.current = null

    setIsAvatarSpeaking(false)
    isAvatarSpeakingRef.current = false
  }

  function getRefinedVoiceForLanguage(
    langCode: string,
    preferredGender: "female" | "male" = "female",
  ): SpeechSynthesisVoice | null {
    if (typeof window === "undefined" || !window.speechSynthesis) return null

    const cacheKey = `${langCode}-${preferredGender}-${selectedCharacter.id}`
    const cache = voiceCacheRef.current
    if (cache.has(cacheKey)) return cache.get(cacheKey)!

    const voices = window.speechSynthesis.getVoices()
    if (!voices.length) return null

    const nativeList = nativeVoicePreferences[langCode]?.[preferredGender] || []

    for (const name of nativeList) {
      const v = voices.find((voice) => voice.name === name)
      if (v) {
        cache.set(cacheKey, v)
        return v
      }
    }

    const langVoices = voices.filter((v) =>
      v.lang.toLowerCase().startsWith(langCode.toLowerCase()),
    )
    if (langVoices.length) {
      cache.set(cacheKey, langVoices[0]!)
      return langVoices[0]!
    }

    if (langCode !== "en") {
      const en = getRefinedVoiceForLanguage("en", preferredGender)
      if (en) {
        cache.set(cacheKey, en)
        return en
      }
    }

    cache.set(cacheKey, voices[0]!)
    return voices[0]!
  }

  function browserSpeak(
    text: string,
    gender: "male" | "female",
    onDone: () => void,
    onStart?: () => void,
  ) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      onDone()
      return
    }

    try {
      window.speechSynthesis.cancel()
    } catch {}

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = currentLocale

    const voice = getRefinedVoiceForLanguage(activeLanguage.code, gender)
    if (voice) utterance.voice = voice

    const speechParams = getNativeSpeechParameters(activeLanguage.code, gender)
    utterance.rate = speechParams.rate
    utterance.pitch = speechParams.pitch
    utterance.volume = speechParams.volume

    currentUtteranceRef.current = utterance

    let started = false
    const startOnce = () => {
      if (started) return
      started = true
      try {
        onStart?.()
      } catch {}
    }

    utterance.onstart = () => startOnce()
    utterance.onend = () => onDone()
    utterance.onerror = () => onDone()

    // страховка: если onstart не вызвался, запускаем сразу
    startOnce()

    try {
      window.speechSynthesis.speak(utterance)
    } catch {
      onDone()
    }
  }

  async function speakViaServerTTS(
    text: string,
    gender: "male" | "female",
    onAudioStart?: () => void,
  ) {
    const ttsGender = gender === "male" ? "MALE" : "FEMALE"
    const langCode = computeLangCode()

    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        language: langCode,
        gender: ttsGender,
      }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success || !json?.audioContent) {
      throw new Error(json?.error || `TTS error: ${res.status}`)
    }

    const contentType = (json.contentType || "audio/mpeg").toString()
    const audioB64 = String(json.audioContent || "")

    await new Promise<void>((resolve) => {
      const audio = ttsAudioRef.current ?? new Audio()
      ttsAudioRef.current = audio
      currentAudioRef.current = audio

      audio.preload = "auto"
      audio.volume = 1
      ;(audio as any).playsInline = true

      let settled = false
      let timeoutId: any = null
      let started = false

      const cleanup = () => {
        try {
          audio.onended = null
          audio.onerror = null
          audio.onplay = null
        } catch {}
        if (timeoutId) {
          try {
            clearTimeout(timeoutId)
          } catch {}
          timeoutId = null
        }
      }

      const done = () => {
        if (settled) return
        settled = true
        cleanup()
        resolve()
      }

      const startOnce = () => {
        if (started) return
        started = true
        try {
          onAudioStart?.()
        } catch {}
      }

      timeoutId = setTimeout(() => done(), 60000)

      audio.onplay = () => startOnce()
      audio.onended = () => done()
      audio.onerror = () => done()

      // ВАЖНО: не data:base64 (на iOS может “обрезать”), а blob URL
      try {
        if (ttsObjectUrlRef.current) {
          try {
            URL.revokeObjectURL(ttsObjectUrlRef.current)
          } catch {}
          ttsObjectUrlRef.current = null
        }
        const { url, revoke } = b64ToBlobUrl(audioB64, contentType)
        ttsObjectUrlRef.current = url
        audio.src = url

        const p = audio.play()
        ;(p as any)?.catch?.((err: any) => {
          console.warn("[TTS] play blocked", err)
          try {
            revoke()
          } catch {}
          ttsObjectUrlRef.current = null
          done()
        })
      } catch (e) {
        console.warn("[TTS] blob decode failed", e)
        done()
      }
    })
  }

  const hasEnhancedVideo =
    !!selectedCharacter?.idleVideo && !!selectedCharacter?.speakingVideo

  function startAvatarSpeakingPlayback() {
    if (!hasEnhancedVideo) return
    const idle = idleVideoRef.current
    const speak = speakingVideoRef.current
    try {
      if (idle) idle.pause()
    } catch {}
    try {
      if (speak && selectedCharacter.speakingVideo) {
        speak.currentTime = 0
        speak.play().catch(() => {})
      }
    } catch {}
  }

  function stopAvatarSpeakingPlayback() {
    if (!hasEnhancedVideo) return
    const idle = idleVideoRef.current
    const speak = speakingVideoRef.current

    try {
      if (speak) {
        speak.pause()
        speak.currentTime = 0
      }
    } catch {}

    if (idle && selectedCharacter.idleVideo && isCallActiveRef.current) {
      try {
        idle.play().catch(() => {})
      } catch {}
    }
  }

  async function speakText(text: string): Promise<void> {
    if (!isCallActiveRef.current) return
    if (!isSoundEnabled) return

    let cleaned = cleanResponseText(text)
    cleaned = sanitizeAssistantText(cleaned)
    if (!cleaned) return

    stopReasonRef.current = "tts"

    // стопаем только текущую озвучку, запись НЕ убиваем — просто пауза
    stopCurrentSpeech()

    const rec: any = mediaRecorderRef.current
    if (rec && rec.state === "recording") {
      try {
        rec.pause()
      } catch {}
    }

    // очистка чанков, но сохраняем header чтобы не ловить webm-баги
    const hdr = audioChunksRef.current?.[0]
    audioChunksRef.current = hdr ? [hdr] : []
    sentIdxRef.current = hdr ? 1 : 0

    setIsAiSpeaking(true)
    isAiSpeakingRef.current = true

    // ВАЖНО: speaking-статус и анимация включаются ровно на старте аудио
    setIsAvatarSpeaking(false)
    isAvatarSpeakingRef.current = false
    stopAvatarSpeakingPlayback()
    setActivityStatus("thinking")

    ttsCooldownUntilRef.current = Date.now() + 700
    resetVadState()

    const gender: "male" | "female" = selectedCharacter.gender || "female"

    let ttsWatchdog: any = null
    let started = false

    const markAvatarStartOnce = () => {
      if (started) return
      started = true
      if (!isCallActiveRef.current) return
      setIsAvatarSpeaking(true)
      isAvatarSpeakingRef.current = true
      setActivityStatus("speaking")
      startAvatarSpeakingPlayback()
    }

    const finish = () => {
      if (ttsWatchdog) {
        try {
          clearTimeout(ttsWatchdog)
        } catch {}
        ttsWatchdog = null
      }

      ttsCooldownUntilRef.current = Date.now() + 700
      setIsAiSpeaking(false)
      isAiSpeakingRef.current = false

      setIsAvatarSpeaking(false)
      isAvatarSpeakingRef.current = false
      stopAvatarSpeakingPlayback()

      stopReasonRef.current = null

      // resume recorder
      const r: any = mediaRecorderRef.current
      if (r && r.state === "paused" && isCallActiveRef.current && !isMicMutedRef.current) {
        window.setTimeout(() => {
          try {
            r.resume()
          } catch {}
          setIsListening(true)
        }, 250)
      }

      if (isCallActiveRef.current && !isMicMutedRef.current) {
        setActivityStatus("listening")
        resetVadState()
      } else {
        setActivityStatus("listening")
      }
    }

    ttsWatchdog = setTimeout(() => {
      console.warn("[TTS] watchdog fired")
      finish()
    }, 120000)

    try {
      await speakViaServerTTS(cleaned, gender, markAvatarStartOnce)
    } catch {
      await new Promise<void>((resolve) =>
        browserSpeak(cleaned, gender, resolve, markAvatarStartOnce),
      )
    } finally {
      finish()
    }
  }

  async function handleUserText(text: string) {
    const trimmed = (text || "").trim()
    if (!trimmed) return
    if (!isCallActiveRef.current) return

    setActivityStatus("thinking")
    setSpeechError(null)

    try {
      const langForBackend = computeHint3()

      if (!VIDEO_ASSISTANT_WEBHOOK_URL) {
        throw new Error("VIDEO_ASSISTANT_WEBHOOK_URL is not configured")
      }

      const res = await fetch(VIDEO_ASSISTANT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          language: langForBackend,
          email: user?.email || "guest@example.com",
          mode: "video",
          characterId: selectedCharacter.id,
          gender: selectedCharacter.gender,
        }),
      })

      if (!res.ok) throw new Error(`Webhook error: ${res.status}`)

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {}

      let aiRaw = extractAnswer(data)
      aiRaw = cleanResponseText(aiRaw)
      aiRaw = sanitizeAssistantText(aiRaw)

      if (!aiRaw) throw new Error("Empty response received")

      if (shouldDedupAssistant(aiRaw)) {
        setActivityStatus("listening")
        resetVadState()
        safeStartListening()
        return
      }

      lastAssistantSentNormRef.current = normalizeUtterance(aiRaw)
      lastAssistantSentTsRef.current = Date.now()

      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, role: "assistant", text: aiRaw },
      ])

      await speakText(aiRaw)
    } catch (error: any) {
      console.error("Video assistant error:", error)
      const errorMessage =
        error?.message === "Empty response received"
          ? t("I received your message but couldn't generate a response. Could you try rephrasing?")
          : t("I couldn't process your message. Could you try again?")

      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, role: "assistant", text: errorMessage },
      ])

      if (onError && error instanceof Error) onError(error)

      stopReasonRef.current = null

      if (isCallActiveRef.current && !isMicMutedRef.current && !isAiSpeakingRef.current) {
        setActivityStatus("listening")
        resetVadState()
        safeStartListening()
      } else {
        setActivityStatus("listening")
      }
    }
  }

  async function startCall() {
    setIsConnecting(true)
    setSpeechError(null)

    try {
      // фиксируем язык сессии ровно на старте
      setSessionLangFromUi()

      const stream = await requestMicrophoneStream()
      if (!stream) {
        setIsConnecting(false)
        return
      }

      await ensureAudioGraphStarted()

      setIsCallActive(true)
      isCallActiveRef.current = true

      setMessages([])
      setInterimTranscript("")
      setIsMicMuted(false)
      isMicMutedRef.current = false

      // сброс дедупа на новую сессию
      lastTranscriptRef.current = ""
      lastUserSentNormRef.current = ""
      lastUserSentTsRef.current = 0
      lastAssistantSentNormRef.current = ""
      lastAssistantSentTsRef.current = 0

      stopReasonRef.current = null
      ttsCooldownUntilRef.current = 0

      // сброс буфера
      audioChunksRef.current = []
      sentIdxRef.current = 1
      resetVadState()

      setIsAiSpeaking(false)
      isAiSpeakingRef.current = false
      setIsAvatarSpeaking(false)
      isAvatarSpeakingRef.current = false

      if (hasEnhancedVideo && idleVideoRef.current && selectedCharacter.idleVideo) {
        try {
          idleVideoRef.current.play().catch(() => {})
        } catch {}
      }

      setActivityStatus("listening")
      safeStartListening()
    } catch (error: any) {
      console.error("Failed to start call:", error)
      setSpeechError(
        error?.message ||
          t("Failed to start the call. Please check your microphone and camera permissions."),
      )
      setIsCallActive(false)
      isCallActiveRef.current = false
      stopRecorder()
      stopAudioGraph()
      stopKeepAlive()
      stopStreams()
    } finally {
      setIsConnecting(false)
    }
  }

  function endCall() {
    stopReasonRef.current = "end"

    setIsCallActive(false)
    isCallActiveRef.current = false

    stopRecorder()
    stopCurrentSpeech()

    setIsAiSpeaking(false)
    isAiSpeakingRef.current = false
    setIsAvatarSpeaking(false)
    isAvatarSpeakingRef.current = false

    setActivityStatus("listening")
    setInterimTranscript("")
    setMessages([])
    setSpeechError(null)

    if (idleVideoRef.current) {
      try {
        idleVideoRef.current.pause()
        idleVideoRef.current.currentTime = 0
      } catch {}
    }
    if (speakingVideoRef.current) {
      try {
        speakingVideoRef.current.pause()
        speakingVideoRef.current.currentTime = 0
      } catch {}
    }

    if (userVideoRef.current?.srcObject) {
      const stream = userVideoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {}
      })
      userVideoRef.current.srcObject = null
    }

    stopAudioGraph()
    stopKeepAlive()
    stopStreams()
  }

  function toggleMicrophone() {
    if (!isCallActiveRef.current) return

    const rec: any = mediaRecorderRef.current

    if (isMicMuted) {
      setIsMicMuted(false)
      isMicMutedRef.current = false
      stopReasonRef.current = null

      setSpeechError(null)
      setActivityStatus("listening")
      resetVadState()

      if (rec && rec.state === "paused") {
        try {
          rec.resume()
        } catch {}
      } else {
        safeStartListening()
      }
    } else {
      setIsMicMuted(true)
      isMicMutedRef.current = true
      stopReasonRef.current = "manual"

      try {
        if (rec && rec.state === "recording") rec.pause()
      } catch {}
      setInterimTranscript("")
      setActivityStatus("listening")
    }
  }

  function toggleCamera() {
    if (isCameraOff) {
      setIsCameraOff(false)
    } else {
      setIsCameraOff(true)
      if (userVideoRef.current?.srcObject) {
        const stream = userVideoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        userVideoRef.current.srcObject = null
      }
    }
  }

  function toggleSound() {
    const next = !isSoundEnabled
    setIsSoundEnabled(next)
    if (!next) {
      stopCurrentSpeech()
      setIsAiSpeaking(false)
      isAiSpeakingRef.current = false
      setIsAvatarSpeaking(false)
      isAvatarSpeakingRef.current = false
      stopAvatarSpeakingPlayback()
      setActivityStatus("listening")
      stopReasonRef.current = null
    }
  }

  if (!isOpen) return null

  const micOn = isCallActive && !isMicMuted && isListening && !isAiSpeaking

  const statusText = (() => {
    if (!isCallActive) return t("Choose an AI psychologist and press “Start video call” to begin.")
    if (isAvatarSpeaking) return t("Assistant is speaking. Please wait a moment.")
    if (activityStatus === "thinking") return t("Thinking...")
    if (micOn) return t("Listening… you can speak.")
    if (isMicMuted) return t("Paused. Turn on microphone to continue.")
    return t("Waiting... you can start speaking at any moment.")
  })()

  const bodyClass = "flex-1 min-h-0 overflow-hidden p-3 sm:p-4 flex flex-col touch-pan-y"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl flex flex-col h-[100dvh] sm:h-[90vh] max-h-none sm:max-h-[860px] overflow-hidden">
        <div className="p-3 sm:p-4 border-b flex items-center justify-between rounded-t-xl relative bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white">
          <div className="flex flex-col flex-1 min-w-0 pr-2">
            <h3 className="font-semibold text-base sm:text-lg truncate flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                <Video className="h-4 w-4" />
              </span>
              {t("AI Psychologist Video Call")}
            </h3>
            <div className="text-xs text-indigo-100 mt-1 truncate">
              {t("Video session in {{language}}", { language: languageDisplayName })} ·{" "}
              {activeLanguage.flag}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              endCall()
              onClose()
            }}
            className="min-w-[44px] min-h-[44px] flex-shrink-0 rounded-full bg-black/20 hover:bg-black/30 text-white"
          >
            <X className="h-5 w-5 text-white" />
          </Button>
        </div>

        <div className={bodyClass}>
          {!isCallActive ? (
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center">
              <div className="text-center mb-6 sm:mb-8 px-2">
                <h3 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3">
                  {t("Choose Your AI Psychologist")}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto">
                  {t("Select the AI psychologist you'd like to speak with during your video call.")}
                </p>
              </div>

              <div className="mb-6 bg-blue-50 p-4 rounded-lg w-full max-w-xs text-center mx-2">
                <p className="text-sm font-medium text-blue-700 mb-1">
                  {t("Video call language")}:
                </p>
                <div className="text-lg font-semibold text-blue-800 flex items-center justify-center">
                  <span className="mr-2">{activeLanguage.flag}</span>
                  {languageDisplayName}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  {t("AI will understand and respond in this language with voice and text.")}
                </p>
              </div>

              <div className="w-full max-w-4xl px-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {AI_CHARACTERS.map((character) => (
                    <button
                      key={character.id}
                      type="button"
                      onClick={() => setSelectedCharacter(character)}
                      className={`relative bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border-2 ${
                        selectedCharacter.id === character.id
                          ? "border-primary-600"
                          : "border-transparent"
                      }`}
                    >
                      <div className="p-4 sm:p-5 flex flex-col h-full">
                        <div className="relative w-full aspect-square mb-3 sm:mb-4 overflow-hidden rounded-lg bg-black">
                          {character.idleVideo ? (
                            <video
                              className="absolute inset-0 w-full h-full object-cover scale-[1.08]"
                              muted
                              loop
                              playsInline
                              autoPlay
                              preload="metadata"
                            >
                              poster={character.avatar}>
                              <source src={character.idleVideo} type="video/mp4" />
                            </video>
                          ) : (
                            <Image
                              src={character.avatar || "/placeholder.svg"}
                              alt={character.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                              priority={character.id === selectedCharacter.id}
                            />
                          )}
                        </div>
                        <h4 className="font-semibold text-base sm:text-lg text-center mb-1 sm:mb-2">
                          {character.name}
                        </h4>
                        <p className="text-xs sm:text-sm text-gray-600 text-center mb-3 sm:mb-4">
                          {character.description}
                        </p>
                        <div className="mt-auto text-center">
                          <span
                            className={`inline-flex px-3 py-1 rounded-full text-[11px] font-medium ${
                              selectedCharacter.id === character.id
                                ? "bg-primary-600 text-white"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {selectedCharacter.id === character.id ? t("Selected") : t("Select")}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 sm:mt-8 w-full max-w-md px-2 pb-3">
                <Button
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white text-base sm:text-lg py-4 sm:py-6 min-h-[56px]"
                  onClick={startCall}
                  disabled={isConnecting}
                >
                  {isConnecting ? t("Connecting...") : t("Start Video Call")}
                </Button>
                {speechError && (
                  <p className="mt-3 text-xs text-center text-rose-600">{speechError}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 grid grid-rows-[auto_minmax(0,1fr)] gap-3 sm:gap-4 sm:grid-rows-none sm:flex sm:flex-row">
              {/* LEFT: VIDEO (mobile fixed height, never collapses) */}
              <div className="row-start-1 w-full sm:w-2/3 flex flex-col min-h-0">
                <div className="relative w-full h-[38vh] min-h-[220px] max-h-[420px] sm:h-auto sm:flex-1 bg-white rounded-lg overflow-hidden">
                  <div className="absolute inset-0 bg-white overflow-hidden">
                    {hasEnhancedVideo ? (
                      <>
                        {selectedCharacter.idleVideo && (
                          <video
                            ref={idleVideoRef}
                            className="absolute inset-0 w-full h-full object-cover scale-[1.08]"
                            muted
                            loop
                            playsInline
                            autoPlay
                            preload="metadata"
                          >
                            poster={selectedCharacter.avatar}>
                            <source src={selectedCharacter.idleVideo} type="video/mp4" />
                          </video>
                        )}

                        {selectedCharacter.speakingVideo && (
                          <video
                            ref={speakingVideoRef}
                            className={`absolute inset-0 w-full h-full object-cover scale-[1.08] transition-opacity duration-700 ease-in-out ${
                              isAvatarSpeaking ? "opacity-100" : "opacity-0"
                            }`}
                            muted
                            loop
                            playsInline
                            preload="metadata"
                          >
                            poster={selectedCharacter.avatar}>
                            <source src={selectedCharacter.speakingVideo} type="video/mp4" />
                          </video>
                        )}
                      </>
                    ) : (
                      <>
                        {selectedCharacter && !isAvatarSpeaking && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white">
                            <div className="w-40 h-40 sm:w-56 sm:h-56 relative">
                              <Image
                                src={selectedCharacter.avatar || "/placeholder.svg"}
                                alt={selectedCharacter.name}
                                fill
                                className="object-cover rounded-full"
                                sizes="224px"
                              />
                            </div>
                          </div>
                        )}

                        {selectedCharacter.speakingVideo && (
                          <video
                            ref={speakingVideoRef}
                            className={`absolute inset-0 w-full h-full object-cover scale-[1.08] transition-opacity duration-700 ease-in-out ${
                              isAvatarSpeaking ? "opacity-100" : "opacity-0"
                            }`}
                            muted
                            loop
                            playsInline
                            preload="metadata"
                          >
                            poster={selectedCharacter.avatar}>
                            <source src={selectedCharacter.speakingVideo} type="video/mp4" />
                          </video>
                        )}
                      </>
                    )}
                  </div>

                  <div
                    className={`absolute top-2 sm:top-4 right-2 sm:right-4 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                      activityStatus === "listening"
                        ? "bg-green-100 text-green-800"
                        : activityStatus === "thinking"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    {activityStatus === "listening"
                      ? t("Listening...")
                      : activityStatus === "thinking"
                      ? t("Thinking...")
                      : t("Speaking...")}
                  </div>

                  {!isCameraOff && (
                    <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 w-20 sm:w-40 aspect-video bg-gray-800 rounded overflow-hidden shadow-lg">
                      <video
                        ref={userVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover transform scale-x-[-1]"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: CHAT (mobile takes remaining height and scrolls inside) */}
              <div className="row-start-2 w-full sm:w-1/3 flex flex-col min-h-0 bg-gray-50 rounded-lg border overflow-hidden">
                <div className="px-3 pt-3 pb-2 border-b flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Brain className="h-4 w-4 text-emerald-700" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">
                      {selectedCharacter.name}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{statusText}</div>
                  </div>
                </div>

                <div className="flex-1 min-h-0 px-3 py-3 sm:px-4 sm:py-4 space-y-3 sm:space-y-4 overflow-y-auto">
                  {messages.length === 0 && (
                    <div className="bg-primary-50 rounded-2xl p-3 sm:p-4 text-xs sm:text-sm text-slate-800">
                      {t(
                        "You can start speaking when you're ready. The assistant will answer with voice and text here.",
                      )}
                    </div>
                  )}

                  {messages.map((msg) =>
                    msg.role === "user" ? (
                      <div
                        key={msg.id}
                        className="ml-auto max-w-[85%] rounded-2xl bg-blue-50 px-3 py-3 text-xs sm:text-sm text-slate-900"
                      >
                        <p>{msg.text}</p>
                      </div>
                    ) : (
                      <div
                        key={msg.id}
                        className="max-w-[85%] rounded-2xl bg-emerald-50 px-3 py-3 text-xs sm:text-sm text-slate-900"
                      >
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-emerald-800">
                          <Brain className="h-3.5 w-3.5" />
                          {selectedCharacter.name}
                        </p>
                        <p>{msg.text}</p>
                      </div>
                    ),
                  )}

                  {interimTranscript && (
                    <div className="bg-gray-50 rounded-lg p-3 italic text-xs sm:text-sm text-gray-500 break-words">
                      {interimTranscript}...
                    </div>
                  )}

                  {speechError && (
                    <div className="bg-rose-50 rounded-lg p-3 text-xs sm:text-sm text-rose-700 break-words">
                      {speechError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {isCallActive && (
          <div className="p-3 sm:p-4 border-t bg-gray-50 flex flex-col safe-area-bottom">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500">
                <Sparkles className="h-3 w-3" />
                {statusText}
              </div>
            </div>

            <div className="flex justify-center space-x-3 sm:space-x-4">
              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-14 w-14 sm:h-12 sm:w-12 touch-manipulation ${
                  isMicMuted
                    ? "bg-red-100 text-red-600"
                    : micOn
                    ? "bg-green-100 text-green-600 animate-pulse"
                    : "bg-gray-100"
                }`}
                onClick={toggleMicrophone}
              >
                {isMicMuted ? (
                  <MicOff className="h-6 w-6 sm:h-5 sm:w-5" />
                ) : (
                  <Mic className="h-6 w-6 sm:h-5 sm:w-5" />
                )}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-14 w-14 sm:h-12 sm:w-12 touch-manipulation ${
                  isCameraOff ? "bg-red-100 text-red-600" : "bg-gray-100"
                }`}
                onClick={toggleCamera}
              >
                {isCameraOff ? (
                  <CameraOff className="h-6 w-6 sm:h-5 sm:w-5" />
                ) : (
                  <Camera className="h-6 w-6 sm:h-5 sm:w-5" />
                )}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-14 w-14 sm:h-12 sm:w-12 touch-manipulation ${
                  isSoundEnabled ? "bg-gray-100" : "bg-red-100 text-red-600"
                }`}
                onClick={toggleSound}
              >
                {isSoundEnabled ? (
                  <Volume2 className="h-6 w-6 sm:h-5 sm:w-5" />
                ) : (
                  <VolumeX className="h-6 w-6 sm:h-5 sm:w-5" />
                )}
              </Button>

              <Button
                variant="destructive"
                size="icon"
                className="rounded-full h-14 w-14 sm:h-12 sm:w-12 bg-red-600 hover:bg-red-700 text-white touch-manipulation"
                onClick={endCall}
              >
                <Video className="h-6 w-6 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
