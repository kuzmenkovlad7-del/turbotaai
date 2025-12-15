// @ts-nocheck
"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  X,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Phone,
  Volume2,
  VolumeX,
  Sparkles,
  Brain,
} from "lucide-react"
import Image from "next/image"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { shouldUseGoogleTTS } from "@/lib/google-tts"

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

interface VideoCallDialogProps {
  isOpen: boolean
  onClose: () => void
  openAiApiKey: string
  onError?: (error: Error) => void
}

type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
}

// аккуратно вытаскиваем текст из любого формата ответа n8n
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

function cleanResponseText(text: string): string {
  if (!text) return ""

  if (text.startsWith('[{"output":')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].output) {
        return String(parsed[0].output).trim()
      }
    } catch {
      // ignore
    }
  }

  return text
    .replace(/\n\n/g, " ")
    .replace(/\*\*/g, "")
    .replace(/```/g, "")
    .replace(/[\n\r]/g, " ")
    .trim()
}

// вычленяем только "новую" часть распознанного текста (как в voice-call)
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

function computeLangCode(code: string): string {
  const lang = (code || "uk").toLowerCase()
  if (lang.startsWith("uk")) return "uk-UA"
  if (lang.startsWith("ru")) return "ru-RU"
  return "en-US"
}

function getTtsGender(g: "male" | "female"): "MALE" | "FEMALE" {
  return g === "male" ? "MALE" : "FEMALE"
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
    currentLanguage || ({ code: "en", name: "English", flag: "🇺🇸" } as any)

  const languageDisplayName =
    activeLanguage.name ||
    (activeLanguage.code === "uk"
      ? "Ukrainian"
      : activeLanguage.code === "ru"
      ? "Russian"
      : "English")

  const currentLocale = computeLangCode(activeLanguage.code)

  const [selectedCharacter, setSelectedCharacter] = useState<AICharacter>(
    AI_CHARACTERS[1] || AI_CHARACTERS[0],
  )

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  // ВАЖНО: микрофон в видео-звонке по умолчанию выключен (как ты хочешь)
  const [isMicMuted, setIsMicMuted] = useState(true)

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

  // --- VIDEO REFS ---
  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const idleVideoRef = useRef<HTMLVideoElement | null>(null)
  const speakingVideoRef = useRef<HTMLVideoElement | null>(null)

  // --- TTS AUDIO REF ---
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // --- AUDIO (MIC) RECORDER REFS (как в voice-call) ---
  const micStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const isSttBusyRef = useRef(false)
  const lastTranscriptRef = useRef("")

  // --- STATE REFS ---
  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(true)

  const hasEnhancedVideo =
    !!selectedCharacter?.idleVideo && !!selectedCharacter?.speakingVideo

  useEffect(() => {
    isCallActiveRef.current = isCallActive
  }, [isCallActive])

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
  }, [isMicMuted])

  // camera PIP (как было, но чуть аккуратнее)
  useEffect(() => {
    if (isCallActive && !isCameraOff && userVideoRef.current) {
      const constraints: any = {
        video: { facingMode: "user" },
        audio: false,
      }

      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          if (userVideoRef.current) {
            userVideoRef.current.srcObject = stream
          }
        })
        .catch((e) => {
          console.log("[VIDEO] camera getUserMedia error:", e)
          setIsCameraOff(true)
        })
    }

    return () => {
      const videoEl = userVideoRef.current
      if (videoEl?.srcObject) {
        const stream = videoEl.srcObject as MediaStream
        stream.getTracks().forEach((track) => {
          try {
            track.stop()
          } catch {}
        })
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

  function stopMicRecorderAndTracks() {
    const rec = mediaRecorderRef.current
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop()
      } catch {}
    }
    mediaRecorderRef.current = null

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {}
      })
      micStreamRef.current = null
    }

    setIsListening(false)
  }

  async function maybeSendStt() {
    if (!isCallActiveRef.current) return
    if (isMicMutedRef.current) return
    if (isSttBusyRef.current) return
    if (!audioChunksRef.current.length) return

    const recMime = mediaRecorderRef.current?.mimeType || ""
    const firstChunkMime = audioChunksRef.current[0]?.type || ""
    const mimeType = (recMime || firstChunkMime || "audio/webm").toString()

    const blob = new Blob(audioChunksRef.current, { type: mimeType })
    if (blob.size < 8000) return

    try {
      isSttBusyRef.current = true

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
          "x-lang": (activeLanguage.code || "").toString(),
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

      const fullText = (data.text || "").toString().trim()
      if (!fullText) return

      const prev = lastTranscriptRef.current
      const delta = diffTranscript(prev, fullText)
      lastTranscriptRef.current = fullText

      if (!delta) return

      // отдаём текст дальше (handleUserText сам добавит user-message)
      await handleUserText(delta)
    } catch (e) {
      console.error("[STT] fatal error:", e)
    } finally {
      isSttBusyRef.current = false
    }
  }

  function pauseRecorderSafely() {
    const rec = mediaRecorderRef.current
    if (rec && rec.state === "recording") {
      try {
        rec.pause()
      } catch {}
    }
  }

  function resumeRecorderSafely() {
    const rec = mediaRecorderRef.current
    if (rec && rec.state === "paused" && isCallActiveRef.current && !isMicMutedRef.current) {
      try {
        rec.resume()
      } catch {}
    }
  }

  function stopCurrentSpeech() {
    if (audioRef.current) {
      try {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      } catch {}
      audioRef.current = null
    }
    if (typeof window !== "undefined" && (window as any).speechSynthesis) {
      try {
        ;(window as any).speechSynthesis.cancel()
      } catch {}
    }
  }

  async function speakText(text: string): Promise<void> {
    if (!isCallActiveRef.current) return
    if (!isSoundEnabled) return

    const cleaned = cleanResponseText(text)
    if (!cleaned) return

    stopCurrentSpeech()

    setIsAiSpeaking(true)
    setActivityStatus("speaking")

    // переключаем видео на speaking если есть
    if (hasEnhancedVideo && speakingVideoRef.current && selectedCharacter.speakingVideo) {
      try {
        speakingVideoRef.current.currentTime = 0
        await speakingVideoRef.current.play()
      } catch {}
    }

    // пауза записи микрофона, чтобы не ловить эхо
    pauseRecorderSafely()

    const langCode = currentLocale
    const gender = getTtsGender(selectedCharacter.gender || "female")

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleaned, language: langCode, gender }),
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
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.playsInline = true

      await new Promise<void>((resolve) => {
        audio.onended = () => resolve()
        audio.onerror = () => resolve()
        audio.onpause = () => resolve()
        audio
          .play()
          .then(() => {})
          .catch(() => resolve())
      })
    } finally {
      setIsAiSpeaking(false)

      // вернуть idle видео
      if (hasEnhancedVideo && speakingVideoRef.current) {
        try {
          speakingVideoRef.current.pause()
          speakingVideoRef.current.currentTime = 0
        } catch {}
      }
      if (hasEnhancedVideo && idleVideoRef.current && selectedCharacter.idleVideo && isCallActiveRef.current) {
        try {
          idleVideoRef.current.play().catch(() => {})
        } catch {}
      }

      // вернуть запись если микрофон включён
      resumeRecorderSafely()

      if (isCallActiveRef.current && !isMicMutedRef.current) {
        setActivityStatus("listening")
      } else {
        setActivityStatus("listening")
      }
    }
  }

  async function handleUserText(text: string) {
    const trimmed = (text || "").trim()
    if (!trimmed) return
    if (!isCallActiveRef.current) return

    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, role: "user", text: trimmed },
    ])

    setActivityStatus("thinking")
    setSpeechError(null)

    try {
      const langForBackend =
        activeLanguage.code?.startsWith("uk") ||
        activeLanguage.code?.startsWith("ru") ||
        activeLanguage.code?.startsWith("en")
          ? activeLanguage.code
          : activeLanguage.code || "uk"

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

      if (!res.ok) {
        throw new Error(`Webhook error: ${res.status}`)
      }

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {
        // string
      }

      const aiRaw = extractAnswer(data)
      const cleaned = cleanResponseText(aiRaw)

      if (!cleaned) {
        throw new Error("Empty response received")
      }

      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, role: "assistant", text: cleaned },
      ])

      await speakText(cleaned)
    } catch (error: any) {
      console.error("Video assistant error:", error)

      let errorMessage = ""
      if (error?.name === "AbortError") {
        errorMessage = t("Connection timeout. Please try again.")
      } else if (error?.message === "Empty response received") {
        errorMessage = t(
          "I received your message but couldn't generate a response. Could you try rephrasing?",
        )
      } else if (
        error?.message === "VIDEO_ASSISTANT_WEBHOOK_URL is not configured"
      ) {
        errorMessage = t(
          "The video assistant is temporarily unavailable. Please contact support.",
        )
      } else {
        errorMessage = t("I couldn't process your message. Could you try again?")
      }

      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, role: "assistant", text: errorMessage },
      ])

      if (onError && error instanceof Error) {
        onError(error)
      }
    } finally {
      if (isCallActiveRef.current && !isMicMutedRef.current) {
        setActivityStatus("listening")
      } else {
        setActivityStatus("listening")
      }
    }
  }

  async function startCall() {
    if (isConnecting) return
    setIsConnecting(true)
    setSpeechError(null)

    try {
      setIsCallActive(true)
      isCallActiveRef.current = true

      setIsCameraOff(false)

      setMessages([])
      setInterimTranscript("")

      // микрофон на старте НЕ трогаем
      setIsMicMuted(true)
      isMicMutedRef.current = true
      setIsListening(false)

      setActivityStatus("listening")

      // чистим STT состояние
      audioChunksRef.current = []
      lastTranscriptRef.current = ""
      isSttBusyRef.current = false
    } catch (e: any) {
      console.error("[VIDEO] startCall error:", e)
      const name = e?.name || e?.constructor?.name || "Error"
      const msg = e?.message ? String(e.message) : String(e)
      setSpeechError(`Could not start: ${name}: ${msg}`)
      setIsCallActive(false)
      isCallActiveRef.current = false
      setIsMicMuted(true)
      isMicMutedRef.current = true
      setIsListening(false)
    } finally {
      setIsConnecting(false)
    }
  }

  function endCall() {
    setIsCallActive(false)
    isCallActiveRef.current = false

    setIsMicMuted(true)
    isMicMutedRef.current = true

    setIsAiSpeaking(false)
    setActivityStatus("listening")
    setInterimTranscript("")
    setMessages([])
    setSpeechError(null)

    // stop TTS
    stopCurrentSpeech()

    // stop mic recorder/tracks
    stopMicRecorderAndTracks()
    audioChunksRef.current = []
    lastTranscriptRef.current = ""
    isSttBusyRef.current = false

    // stop character videos
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

    // stop camera
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

    // включаем микрофон
    if (isMicMutedRef.current) {
      setSpeechError(null)

      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          setSpeechError(
            t(
              "Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari.",
            ),
          )
          return
        }

        // если стрима ещё нет — берём
        if (!micStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            } as any,
          })
          micStreamRef.current = stream
        }

        // если рекордера нет/умер — создаём
        const buildRecorder = () => {
          const stream = micStreamRef.current!
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

          rec.onstart = () => {
            setIsListening(true)
          }

          rec.ondataavailable = (event: BlobEvent) => {
            if (event.data && event.data.size > 0) {
              audioChunksRef.current.push(event.data)
              void maybeSendStt()
            }
          }

          rec.onstop = () => {
            setIsListening(false)
          }

          rec.onerror = (event: any) => {
            console.error("[Recorder] error:", event)
          }

          return rec
        }

        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
          mediaRecorderRef.current = buildRecorder()
          // с нуля начинаем контейнер
          audioChunksRef.current = []
          lastTranscriptRef.current = ""
          isSttBusyRef.current = false
          mediaRecorderRef.current.start(4000) // chunk every 4s (как в voice-call)
        } else if (mediaRecorderRef.current.state === "paused") {
          mediaRecorderRef.current.resume()
        } else if (mediaRecorderRef.current.state === "recording") {
          // уже пишем — ничего
        }

        setIsMicMuted(false)
        isMicMutedRef.current = false
        setActivityStatus("listening")
        return
      } catch (error: any) {
        console.error("[MIC] getUserMedia/recorder error:", error)
        const name = error?.name
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setSpeechError(
            t(
              "Microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page.",
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

        setIsMicMuted(true)
        isMicMutedRef.current = true
        setIsListening(false)
        return
      }
    }

    // выключаем микрофон (pause, как в voice-call)
    const rec = mediaRecorderRef.current
    if (rec && rec.state === "recording") {
      try {
        rec.pause()
      } catch {}
    }
    setIsMicMuted(true)
    isMicMutedRef.current = true
    setIsListening(false)
    setInterimTranscript("")
    setActivityStatus("listening")
  }

  function toggleCamera() {
    if (isCameraOff) {
      setIsCameraOff(false)
    } else {
      setIsCameraOff(true)
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
  }

  function toggleSound() {
    const next = !isSoundEnabled
    setIsSoundEnabled(next)
    if (!next) {
      stopCurrentSpeech()
      setIsAiSpeaking(false)
    }
  }

  if (!isOpen) return null

  const micOn = isCallActive && !isMicMuted

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
                <Phone className="h-4 w-4" />
              </span>
              {t("AI Psychologist Video Call")}
            </h3>
            <div className="text-xs text-indigo-100 mt-1 truncate">
              {t("Video session in {{language}}", {
                language: languageDisplayName,
              })}{" "}
              · {activeLanguage.flag}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              endCall()
              onClose()
            }}
            className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col touch-pan-y">
          {!isCallActive ? (
            // PRE-CALL SCREEN
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-center mb-6 sm:mb-8 px-2">
                <h3 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3">
                  {t("Choose Your AI Psychologist")}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto">
                  {t(
                    "Select the AI psychologist you'd like to speak with during your video call.",
                  )}
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
            // IN-CALL SCREEN
            <div className="flex-1 flex flex-col sm:flex-row gap-3 sm:gap-4">
              {/* LEFT: VIDEO */}
              <div className="w-full sm:w-2/3 flex flex-col">
                <div className="relative w-full aspect-video sm:flex-1 bg-white rounded-lg overflow-hidden">
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

              {/* RIGHT: CHAT */}
              <div className="w-full sm:w-1/3 flex flex-col bg-gray-50 rounded-lg border overflow-hidden">
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

                <div className="flex-1 px-3 py-3 sm:px-4 sm:py-4 space-y-3 sm:space-y-4 overflow-y-auto">
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
                <Phone className="h-6 w-6 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
