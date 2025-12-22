// @ts-nocheck
"use client"

import { useEffect, useRef, useState } from "react"
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
import Image from "next/image"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import {
  getLocaleForLanguage,
  getNativeSpeechParameters,
  getNativeVoicePreferences,
} from "@/lib/i18n/translation-utils"
import { shouldUseGoogleTTS, generateGoogleTTS } from "@/lib/google-tts"

const VIDEO_ASSISTANT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AI_VIDEO_ASSISTANT_WEBHOOK_URL ||
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL ||
  "/api/turbotaai-agent"

const STT_ENDPOINT = "/api/stt"

// если у тебя Google TTS реально используется — креды/конфиги остаются как были
const VIDEO_CALL_GOOGLE_TTS_CREDENTIALS: any = {}

const VIDEO_CALL_VOICE_CONFIGS = {
  uk: {
    female: { languageCode: "uk-UA", name: "uk-UA-Standard-A", ssmlGender: "FEMALE" },
    male: { languageCode: "uk-UA", name: "uk-UA-Chirp3-HD-Schedar", ssmlGender: "MALE" },
  },
  ru: {
    female: { languageCode: "ru-RU", name: "ru-RU-Standard-A", ssmlGender: "FEMALE" },
    male: { languageCode: "ru-RU", name: "ru-RU-Standard-B", ssmlGender: "MALE" },
  },
  en: {
    female: { languageCode: "en-US", name: "en-US-Neural2-F", ssmlGender: "FEMALE" },
    male: { languageCode: "en-US", name: "en-US-Neural2-D", ssmlGender: "MALE" },
  },
}

interface AICharacter {
  id: string
  name: string
  gender: "male" | "female"
  description: string
  avatar: string
  voice: string
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
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-18-BmxDH7DCv7e3p0y8HobTyoPkQw1COM.jpg",
    voice: "en-US-GuyNeural",
    animated: true,
    idleVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_7660-2BvRYFiYOwNRwDjKtBtSCtEGUbLMEh.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9968-64neCIRuZ7CYXDT86QGYu4XSE7j0Ug.MP4",
  },
  {
    id: "dr-sophia",
    name: "Dr. Sophia",
    gender: "female",
    description:
      "Clinical psychologist specializing in anxiety, depression, and workplace stress management",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-ds8y3Pe7RedqJBqZMDPltEeFI149ki.jpg",
    voice: "en-US-JennyNeural",
    animated: true,
    idleVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9962-fVXHRSVmzv64cpPJf4FddeCDXqxdGE.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9950-XyDJMndgIHEWrKcLj25FUlV4c18GLp.MP4",
  },
  {
    id: "dr-maria",
    name: "Dr. Maria",
    gender: "female",
    description:
      "Psychotherapist specializing in emotional regulation, trauma recovery, and relationship counseling",
    avatar:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-19%D1%83-iWDrUd3gH9sLBeOjmIvu8wX3yxwBuq.jpg",
    voice: "en-US-JennyNeural",
    animated: true,
    idleVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9963-sneJ4XhoEuemkYgVb425Mscu7X9OC6.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9949-mYErfm0ubE19kr4trLKJrggtvoh4zy.MP4",
  },
]

declare global {
  interface Window {
    AudioContext?: any
    webkitAudioContext?: any
    speechSynthesis?: SpeechSynthesis
  }
}

interface VideoCallDialogProps {
  isOpen: boolean
  onClose: () => void
  openAiApiKey?: string // OPTIONAL (чтобы билд не падал)
  onError?: (error: Error) => void
}

type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
}

function normalizeLang(code: string) {
  const s = (code || "").toLowerCase()
  if (s.startsWith("uk")) return "uk"
  if (s.startsWith("ru")) return "ru"
  if (s.startsWith("en")) return "en"
  return "uk"
}

function pickRecorderMimeType() {
  if (typeof window === "undefined" || !(window as any).MediaRecorder) return ""
  const MR = (window as any).MediaRecorder
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ]
  for (const t of candidates) {
    try {
      if (MR.isTypeSupported && MR.isTypeSupported(t)) return t
    } catch {}
  }
  return ""
}

function mimeToExt(mime: string) {
  const m = String(mime || "").toLowerCase()
  if (m.includes("ogg")) return "ogg"
  return "webm"
}

export default function VideoCallDialog({
  isOpen,
  onClose,
  onError,
}: VideoCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const activeLanguage =
    currentLanguage || ({ code: "en", name: "English", flag: "🇺🇸" } as any)

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
  const isAiSpeakingRef = useRef(false)
  const isSendingRef = useRef(false)

  const lastUserSpeechAtRef = useRef<number | null>(null)
  const lastTranscriptRef = useRef<{ text: string; at: number } | null>(null)

  // audio capture + VAD
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const recordingRef = useRef(false)
  const recordStartAtRef = useRef(0)
  const lastVoiceAtRef = useRef(0)

  const AUTO_MUTE_AFTER_MS = 15 * 60 * 1000

  const hasEnhancedVideo =
    !!selectedCharacter?.idleVideo && !!selectedCharacter?.speakingVideo

  useEffect(() => {
    isCallActiveRef.current = isCallActive
  }, [isCallActive])

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
  }, [isMicMuted])

  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking
  }, [isAiSpeaking])

  // preload voices
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

  // camera PIP
  useEffect(() => {
    if (isCallActive && !isCameraOff && userVideoRef.current) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          if (userVideoRef.current) {
            userVideoRef.current.srcObject = stream
          }
        })
        .catch(() => {
          setIsCameraOff(true)
        })
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

  // close modal -> стоп звонок
  useEffect(() => {
    if (!isOpen && isCallActive) {
      endCall()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  async function requestMicrophoneAccess(): Promise<MediaStream | null> {
    try {
      const hasMediaDevices =
        typeof navigator !== "undefined" &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function"
      if (!hasMediaDevices) {
        setSpeechError(
          t(
            "Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari.",
          ),
        )
        return null
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } as any,
      })

      setSpeechError(null)
      return stream
    } catch (error: any) {
      const name = error?.name
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setSpeechError(
          t(
            "Microphone is blocked in the browser. Please allow access in the site permissions and reload the page.",
          ),
        )
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setSpeechError(
          t("No microphone was found on this device. Please check your hardware."),
        )
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

  function stopCurrentSpeech() {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause()
        currentAudioRef.current.currentTime = 0
      } catch {}
      currentAudioRef.current = null
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel()
      } catch {}
    }
    currentUtteranceRef.current = null
  }

  function browserSpeak(
    text: string,
    gender: "male" | "female",
    onDone: () => void,
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

    utterance.onend = () => onDone()
    utterance.onerror = () => onDone()

    try {
      window.speechSynthesis.speak(utterance)
    } catch {
      onDone()
    }
  }

  function pauseListening() {
    setIsListening(false)
    recordingRef.current = false
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
      }
    } catch {}
  }

  function stopAudioCapture() {
    pauseListening()

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    try {
      analyserRef.current?.disconnect()
    } catch {}
    analyserRef.current = null

    try {
      audioContextRef.current?.close()
    } catch {}
    audioContextRef.current = null

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t: any) => {
        try {
          t.stop()
        } catch {}
      })
      audioStreamRef.current = null
    }

    mediaRecorderRef.current = null
    chunksRef.current = []
  }

  async function speakText(text: string): Promise<void> {
    if (!isCallActiveRef.current) return
    if (!isSoundEnabled) return

    const cleaned = cleanResponseText(text)
    if (!cleaned) return

    // stop STT while TTS
    pauseListening()
    stopCurrentSpeech()

    setIsAiSpeaking(true)
    setActivityStatus("speaking")

    if (hasEnhancedVideo && speakingVideoRef.current && selectedCharacter.speakingVideo) {
      try {
        speakingVideoRef.current.currentTime = 0
        await speakingVideoRef.current.play()
      } catch {}
    }

    const gender: "male" | "female" = selectedCharacter.gender || "female"

    const finish = () => {
      setIsAiSpeaking(false)

      if (hasEnhancedVideo && speakingVideoRef.current) {
        try {
          speakingVideoRef.current.pause()
          speakingVideoRef.current.currentTime = 0
        } catch {}
      }

      if (
        hasEnhancedVideo &&
        idleVideoRef.current &&
        selectedCharacter.idleVideo &&
        isCallActiveRef.current
      ) {
        try {
          idleVideoRef.current.play().catch(() => {})
        } catch {}
      }

      if (isCallActiveRef.current && !isMicMutedRef.current) {
        setActivityStatus("listening")
        // resume STT after TTS
        startVadLoop()
      }
    }

    try {
      if (shouldUseGoogleTTS(activeLanguage.code)) {
        try {
          const audioDataUrl = await generateGoogleTTS(
            cleaned,
            currentLocale,
            gender,
            VIDEO_CALL_GOOGLE_TTS_CREDENTIALS,
            VIDEO_CALL_VOICE_CONFIGS,
          )

          if (!audioDataUrl) throw new Error("No audio from Google TTS")

          await new Promise<void>((resolve) => {
            const audio = new Audio()
            currentAudioRef.current = audio
            audio.preload = "auto"
            audio.volume = 1
            audio.playsInline = true
            audio.crossOrigin = "anonymous"
            audio.src = audioDataUrl
            audio.onended = () => resolve()
            audio.onerror = () => resolve()
            audio.play().catch(() => resolve())
          })
        } catch {
          await new Promise<void>((resolve) => {
            browserSpeak(cleaned, gender, resolve)
          })
        }
      } else {
        await new Promise<void>((resolve) => {
          browserSpeak(cleaned, gender, resolve)
        })
      }
    } finally {
      finish()
    }
  }

  async function callStt(blob: Blob): Promise<string> {
    const mime = blob.type || pickRecorderMimeType() || "audio/webm"
    const ext = mimeToExt(mime)
    const file = new File([blob], `speech.${ext}`, { type: mime })

    const fd = new FormData()
    fd.append("file", file, file.name)
    fd.append("language", normalizeLang(activeLanguage.code))

    const res = await fetch(STT_ENDPOINT, { method: "POST", body: fd })
    const raw = await res.text()

    if (!res.ok) {
      throw new Error(`STT ${res.status}: ${raw?.slice(0, 200)}`)
    }

    try {
      const j = JSON.parse(raw)
      return (j?.text || j?.result || j?.output || "").toString().trim()
    } catch {
      return (raw || "").toString().trim()
    }
  }

  async function handleUserText(text: string) {
    const trimmed = (text || "").trim()
    if (!trimmed) return
    if (!isCallActiveRef.current) return

    const now = Date.now()
    const last = lastTranscriptRef.current
    if (last && last.text === trimmed && now - last.at < 1500) {
      return
    }
    lastTranscriptRef.current = { text: trimmed, at: now }

    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, role: "user", text: trimmed },
    ])
    setActivityStatus("thinking")
    setSpeechError(null)

    try {
      const langForBackend = normalizeLang(activeLanguage.code)

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

      const aiRaw = extractAnswer(data)
      const cleaned = cleanResponseText(aiRaw)
      if (!cleaned) throw new Error("Empty response received")

      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, role: "assistant", text: cleaned },
      ])

      await speakText(cleaned)
    } catch (error: any) {
      console.error("Video assistant error:", error)
      const msg = t("I couldn't process your message. Could you try again?")
      setSpeechError(msg)

      if (onError && error instanceof Error) onError(error)
      setActivityStatus("listening")
      if (isCallActiveRef.current && !isMicMutedRef.current) startVadLoop()
    }
  }

  function ensureAudioGraph(stream: MediaStream) {
    if (analyserRef.current && audioContextRef.current) return

    const AC = (window.AudioContext || (window as any).webkitAudioContext)
    const ctx = new AC()
    audioContextRef.current = ctx

    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)

    analyserRef.current = analyser
  }

  function ensureRecorder(stream: MediaStream) {
    if (mediaRecorderRef.current) return mediaRecorderRef.current

    const mimeType = pickRecorderMimeType()
    const rec = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream)

    rec.ondataavailable = (e: any) => {
      if (e?.data && e.data.size > 0) chunksRef.current.push(e.data)
    }

    rec.onstop = async () => {
      const parts = chunksRef.current
      chunksRef.current = []
      recordingRef.current = false

      if (!isCallActiveRef.current || isMicMutedRef.current) return
      if (isAiSpeakingRef.current) return

      const blob = new Blob(parts, { type: rec.mimeType || "audio/webm" })

      // anti-zero
      if (!blob || blob.size < 1500) {
        setInterimTranscript("")
        setActivityStatus("listening")
        startVadLoop()
        return
      }

      isSendingRef.current = true
      setActivityStatus("thinking")

      try {
        const text = await callStt(blob)
        const cleaned = (text || "").trim()
        if (!cleaned) {
          setActivityStatus("listening")
          startVadLoop()
          return
        }
        await handleUserText(cleaned)
      } catch (e: any) {
        console.error("STT error:", e?.message || e)
        setSpeechError(t("Error while listening. Please try again."))
        setActivityStatus("listening")
        startVadLoop()
      } finally {
        isSendingRef.current = false
      }
    }

    mediaRecorderRef.current = rec
    return rec
  }

  function startSegment() {
    if (!audioStreamRef.current) return
    const rec = ensureRecorder(audioStreamRef.current)
    if (!rec) return
    if (rec.state !== "inactive") return

    chunksRef.current = []
    recordingRef.current = true
    recordStartAtRef.current = Date.now()
    lastVoiceAtRef.current = Date.now()

    try {
      rec.start(250) // timeslice
    } catch {}
  }

  function stopSegment() {
    const rec = mediaRecorderRef.current
    if (!rec) return
    if (rec.state === "inactive") return
    try {
      rec.stop()
    } catch {}
  }

  function startVadLoop() {
    if (!isCallActiveRef.current) return
    if (isMicMutedRef.current) {
      setIsListening(false)
      return
    }
    if (isAiSpeakingRef.current) {
      setIsListening(false)
      return
    }

    if (!audioStreamRef.current) return
    ensureAudioGraph(audioStreamRef.current)
    ensureRecorder(audioStreamRef.current)

    const analyser = analyserRef.current
    if (!analyser) return

    const data = new Uint8Array(analyser.fftSize)
    const THRESH = 0.018
    const SILENCE_MS = 800
    const MIN_SEGMENT_MS = 650
    const MAX_SEGMENT_MS = 6500

    setIsListening(true)
    setActivityStatus("listening")

    const tick = () => {
      if (!isCallActiveRef.current) return

      if (isMicMutedRef.current || isAiSpeakingRef.current || isSendingRef.current) {
        setIsListening(false)
        rafRef.current = requestAnimationFrame(tick)
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

      const hasVoice = rms > THRESH

      // inactivity auto-mute
      const last = lastUserSpeechAtRef.current || now
      const inactiveFor = now - last
      if (!recordingRef.current && inactiveFor > AUTO_MUTE_AFTER_MS) {
        setIsMicMuted(true)
        isMicMutedRef.current = true
        setIsListening(false)
        return
      }

      if (!recordingRef.current) {
        if (hasVoice) {
          lastUserSpeechAtRef.current = now
          setInterimTranscript("…")
          startSegment()
        }
      } else {
        if (hasVoice) {
          lastUserSpeechAtRef.current = now
          lastVoiceAtRef.current = now
        }

        const dur = now - recordStartAtRef.current
        const silentFor = now - lastVoiceAtRef.current

        if (dur >= MAX_SEGMENT_MS) {
          setInterimTranscript("")
          stopSegment()
        } else if (dur >= MIN_SEGMENT_MS && silentFor >= SILENCE_MS) {
          setInterimTranscript("")
          stopSegment()
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
  }

  async function startCall() {
    setIsConnecting(true)
    setSpeechError(null)

    try {
      const stream = await requestMicrophoneAccess()
      if (!stream) {
        setIsConnecting(false)
        return
      }

      audioStreamRef.current = stream
      ensureAudioGraph(stream)
      ensureRecorder(stream)

      setIsCallActive(true)
      isCallActiveRef.current = true

      setMessages([])
      setInterimTranscript("")
      setIsMicMuted(false)
      isMicMutedRef.current = false
      lastUserSpeechAtRef.current = Date.now()
      lastTranscriptRef.current = null

      if (hasEnhancedVideo && idleVideoRef.current && selectedCharacter.idleVideo) {
        try {
          idleVideoRef.current.play().catch(() => {})
        } catch {}
      }

      startVadLoop()
    } catch (error: any) {
      console.error("Failed to start call:", error)
      setSpeechError(
        error?.message ||
          t("Failed to start the call. Please check your microphone and camera permissions."),
      )
      setIsCallActive(false)
      isCallActiveRef.current = false
      stopAudioCapture()
    } finally {
      setIsConnecting(false)
    }
  }

  function endCall() {
    setIsCallActive(false)
    isCallActiveRef.current = false

    stopAudioCapture()
    stopCurrentSpeech()

    setIsAiSpeaking(false)
    setActivityStatus("listening")
    setInterimTranscript("")
    setMessages([])
    setSpeechError(null)
    lastUserSpeechAtRef.current = null
    lastTranscriptRef.current = null
    isSendingRef.current = false

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
  }

  async function toggleMicrophone() {
    if (!isCallActiveRef.current) return

    if (isMicMuted) {
      const stream = audioStreamRef.current || (await requestMicrophoneAccess())
      if (!stream) return

      audioStreamRef.current = stream
      ensureAudioGraph(stream)
      ensureRecorder(stream)

      setIsMicMuted(false)
      isMicMutedRef.current = false
      setSpeechError(null)
      lastUserSpeechAtRef.current = Date.now()
      startVadLoop()
    } else {
      setIsMicMuted(true)
      isMicMutedRef.current = true
      pauseListening()
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
      if (isCallActiveRef.current && !isMicMutedRef.current) startVadLoop()
    }
  }

  if (!isOpen) return null

  const micOn = isCallActive && !isMicMuted && isListening

  const statusText = (() => {
    if (!isCallActive)
      return t("Choose an AI psychologist and press “Start video call” to begin.")
    if (isAiSpeaking) return t("Assistant is speaking. Please wait a moment.")
    if (micOn) return t("Listening… you can speak.")
    return t("Paused. Turn on microphone to continue.")
  })()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl flex flex-col h-[100dvh] sm:h-[90vh] max-h-none sm:max-h-[860px] overflow-hidden">
        {/* HEADER */}
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
            className="text-white bg-black/20 hover:bg-black/30 rounded-full min-w-[44px] min-h-[44px] flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* BODY (fixed height, no growing) */}
        <div className="flex-1 overflow-hidden p-3 sm:p-4 flex flex-col touch-pan-y">
          {!isCallActive ? (
            // PRE-CALL SCREEN
            <div className="flex-1 flex flex-col items-center justify-center">
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
                  {shouldUseGoogleTTS(activeLanguage.code)
                    ? t("All characters use Google TTS for authentic native accent.")
                    : t("AI will understand and respond in this language with native accent")}
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
                              preload="auto"
                            >
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

              <div className="mt-6 sm:mt-8 w-full max-w-md px-2">
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
            // IN-CALL SCREEN (no growing)
            <div className="flex-1 min-h-0 flex flex-col sm:flex-row gap-3 sm:gap-4">
              {/* LEFT: VIDEO */}
              <div className="w-full sm:w-2/3 flex flex-col min-h-0">
                <div className="relative w-full aspect-video sm:flex-1 bg-white rounded-lg overflow-hidden min-h-0">
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
                            preload="auto"
                          >
                            <source src={selectedCharacter.idleVideo} type="video/mp4" />
                          </video>
                        )}

                        {selectedCharacter.speakingVideo && (
                          <video
                            ref={speakingVideoRef}
                            className={`absolute inset-0 w-full h-full object-cover scale-[1.08] transition-opacity duration-700 ease-in-out ${
                              isAiSpeaking ? "opacity-100" : "opacity-0"
                            }`}
                            muted
                            loop
                            playsInline
                            autoPlay
                            preload="auto"
                          >
                            <source src={selectedCharacter.speakingVideo} type="video/mp4" />
                          </video>
                        )}
                      </>
                    ) : (
                      <>
                        {selectedCharacter && !isAiSpeaking && (
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
                              isAiSpeaking ? "opacity-100" : "opacity-0"
                            }`}
                            muted
                            loop
                            playsInline
                            autoPlay
                            preload="auto"
                          >
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

              {/* RIGHT: CHAT (scroll only inside) */}
              <div className="w-full sm:w-1/3 min-h-0 flex flex-col bg-gray-50 rounded-lg border overflow-hidden">
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
                      {t("You can start speaking when you're ready. The assistant will answer with voice and text here.")}
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
                      {interimTranscript}
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

        {/* BOTTOM BAR */}
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
                {isMicMuted ? <MicOff className="h-6 w-6 sm:h-5 sm:w-5" /> : <Mic className="h-6 w-6 sm:h-5 sm:w-5" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-14 w-14 sm:h-12 sm:w-12 touch-manipulation ${
                  isCameraOff ? "bg-red-100 text-red-600" : "bg-gray-100"
                }`}
                onClick={toggleCamera}
              >
                {isCameraOff ? <CameraOff className="h-6 w-6 sm:h-5 sm:w-5" /> : <Camera className="h-6 w-6 sm:h-5 sm:w-5" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-14 w-14 sm:h-12 sm:w-12 touch-manipulation ${
                  isSoundEnabled ? "bg-gray-100" : "bg-red-100 text-red-600"
                }`}
                onClick={toggleSound}
              >
                {isSoundEnabled ? <Volume2 className="h-6 w-6 sm:h-5 sm:w-5" /> : <VolumeX className="h-6 w-6 sm:h-5 sm:w-5" />}
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
