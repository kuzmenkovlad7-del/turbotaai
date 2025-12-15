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

const VIDEO_CALL_GOOGLE_TTS_CREDENTIALS: any = {}

const VIDEO_CALL_VOICE_CONFIGS = {
  uk: {
    female: {
      languageCode: "uk-UA",
      name: "uk-UA-Standard-A",
      ssmlGender: "FEMALE",
    },
    male: {
      languageCode: "uk-UA",
      name: "uk-UA-Chirp3-HD-Schedar",
      ssmlGender: "MALE",
    },
  },
  ru: {
    female: {
      languageCode: "ru-RU",
      name: "ru-RU-Standard-A",
      ssmlGender: "FEMALE",
    },
    male: {
      languageCode: "ru-RU",
      name: "ru-RU-Standard-B",
      ssmlGender: "MALE",
    },
  },
  en: {
    female: {
      languageCode: "en-US",
      name: "en-US-Neural2-F",
      ssmlGender: "FEMALE",
    },
    male: {
      languageCode: "en-US",
      name: "en-US-Neural2-D",
      ssmlGender: "MALE",
    },
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
    SpeechRecognition?: any
    webkitSpeechRecognition?: any
    AudioContext?: any
    webkitAudioContext?: any
    speechSynthesis?: SpeechSynthesis
  }
}

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

  const recognitionRef = useRef<any>(null)
  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const idleVideoRef = useRef<HTMLVideoElement | null>(null)
  const speakingVideoRef = useRef<HTMLVideoElement | null>(null)

  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const voiceCacheRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map())

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const lastSpeechActivityRef = useRef<number | null>(null)
  const recognitionStopReasonRef = useRef<"none" | "manual" | "finalResult">(
    "none",
  )

  const AUTO_MUTE_AFTER_MS = 15 * 60 * 1000 // 15 минут тишины до авто-отключения

  const hasEnhancedVideo =
    !!selectedCharacter?.idleVideo && !!selectedCharacter?.speakingVideo

  useEffect(() => {
    isCallActiveRef.current = isCallActive
  }, [isCallActive])

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
  }, [isMicMuted])

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
  })

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

  // ----- явный запрос доступа к микрофону (особенно важен на мобилках) -----
  async function requestMicrophoneAccess(): Promise<boolean> {
    if (typeof navigator === "undefined") {
      setSpeechError(
        t(
          "Microphone access is not available in this environment. Please open the assistant in a regular browser window.",
        ),
      )
      return false
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
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })

      // мы только просим разрешение — треки можно сразу остановить
      stream.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {}
      })

      setSpeechError(null)
      return true
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

      return false
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
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!
    }

    const voices = window.speechSynthesis.getVoices()
    if (!voices.length) return null

    const nativeList =
      nativeVoicePreferences[langCode]?.[preferredGender] || []

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
    if (voice) {
      utterance.voice = voice
    }

    const speechParams = getNativeSpeechParameters(
      activeLanguage.code,
      gender,
    )
    utterance.rate = speechParams.rate
    utterance.pitch = speechParams.pitch
    utterance.volume = speechParams.volume

    currentUtteranceRef.current = utterance

    utterance.onend = () => {
      onDone()
    }
    utterance.onerror = () => {
      onDone()
    }

    try {
      window.speechSynthesis.speak(utterance)
    } catch {
      onDone()
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

    if (
      hasEnhancedVideo &&
      speakingVideoRef.current &&
      selectedCharacter.speakingVideo
    ) {
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

          if (!audioDataUrl) {
            throw new Error("No audio from Google TTS")
          }

          await new Promise<void>((resolve) => {
            const audio = new Audio()
            currentAudioRef.current = audio
            audio.preload = "auto"
            audio.volume = 1
            audio.playsInline = true
            audio.crossOrigin = "anonymous"
            audio.src = audioDataUrl
            audio.onended = () => {
              resolve()
            }
            audio.onerror = () => {
              resolve()
            }
            audio
              .play()
              .then(() => {})
              .catch(() => resolve())
          })
        } catch (e) {
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

  async function handleUserText(text: string) {
    const trimmed = text.trim()
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
      } else if (error?.message === "VIDEO_ASSISTANT_WEBHOOK_URL is not configured") {
        errorMessage = t(
          "The video assistant is temporarily unavailable. Please contact support.",
        )
      } else {
        errorMessage = t(
          "I couldn't process your message. Could you try again?",
        )
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
        startSpeechRecognition()
      } else {
        setActivityStatus("listening")
      }
    }
  }

  function startSpeechRecognition() {
    if (typeof window === "undefined") return
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechError(
        t(
          "Your browser does not support voice recognition. Please use Chrome or another modern browser.",
        ),
      )
      return
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = currentLocale
    recognitionStopReasonRef.current = "none"

    recognition.onstart = () => {
      setIsListening(true)
      setSpeechError(null)
      setActivityStatus("listening")
      if (!lastSpeechActivityRef.current) {
        lastSpeechActivityRef.current = Date.now()
      }
    }

    recognition.onresult = (event: any) => {
      let finalTranscript = ""
      let interim = ""
      let hadAnySpeech = false

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript || ""
        if (!text) continue

        hadAnySpeech = true

        if (result.isFinal) {
          finalTranscript += text + " "
        } else {
          interim += text
        }
      }

      if (hadAnySpeech) {
        lastSpeechActivityRef.current = Date.now()
      }

      if (interim) {
        setInterimTranscript(interim)
      }

      if (finalTranscript.trim()) {
        const text = finalTranscript.trim()
        setInterimTranscript("")
        recognitionStopReasonRef.current = "finalResult"
        recognition.stop()
        setIsListening(false)
        handleUserText(text)
      }
    }

    recognition.onerror = (event: any) => {
      console.log("Speech recognition error:", event)

      if (event.error === "not-allowed") {
        setSpeechError(
          t(
            "Microphone access was blocked. Please allow it in your browser settings and restart the call.",
          ),
        )
        setIsMicMuted(true)
        isMicMutedRef.current = true
        setActivityStatus("listening")
        return
      }

      if (event.error === "service-not-allowed") {
        setSpeechError(
          t(
            "Your browser does not support voice recognition. Please use Chrome or another modern browser.",
          ),
        )
        setIsMicMuted(true)
        isMicMutedRef.current = true
        setActivityStatus("listening")
        return
      }

      if (event.error === "audio-capture") {
        setSpeechError(t("Error while listening. Please try again."))
        setActivityStatus("listening")
        return
      }

      if (event.error === "no-speech") {
        return
      }

      setSpeechError(t("Error while listening. Please try again."))
      setActivityStatus("listening")
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setIsListening(false)

      if (
        recognitionStopReasonRef.current === "none" &&
        isCallActiveRef.current &&
        !isMicMutedRef.current
      ) {
        const now = Date.now()
        const lastActivity = lastSpeechActivityRef.current ?? now
        if (!lastSpeechActivityRef.current) {
          lastSpeechActivityRef.current = now
        }
        const inactiveFor = now - lastActivity

        if (inactiveFor < AUTO_MUTE_AFTER_MS) {
          try {
            recognitionStopReasonRef.current = "none"
            recognition.start()
            recognitionRef.current = recognition
            setIsListening(true)
          } catch (err) {
            console.log("Error auto-restarting recognition:", err)
          }
        } else {
          setIsMicMuted(true)
          isMicMutedRef.current = true
        }
      }
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
    } catch (error) {
      console.log("Error starting recognition:", error)
    }
  }

  function stopSpeechRecognition() {
    if (recognitionRef.current) {
      recognitionStopReasonRef.current = "manual"
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }
    setIsListening(false)
  }

  async function startCall() {
    setIsConnecting(true)
    setSpeechError(null)

    try {
      // IMPORTANT: Start recognition immediately inside the click handler (Android needs user gesture)
startSpeechRecognition()

const micOk = await requestMicrophoneAccess()
      if (!micOk) {
        setIsConnecting(false)
        return
      }

      setIsCallActive(true)
      isCallActiveRef.current = true

      setMessages([])
      setInterimTranscript("")
      setIsMicMuted(false)
      isMicMutedRef.current = false
      lastSpeechActivityRef.current = Date.now()
      recognitionStopReasonRef.current = "none"

      if (
        hasEnhancedVideo &&
        idleVideoRef.current &&
        selectedCharacter.idleVideo
      ) {
        try {
          idleVideoRef.current.play().catch(() => {})
        } catch {}
      }

          } catch (error: any) {
      console.error("Failed to start call:", error)
      setSpeechError(
        error?.message ||
          t(
            "Failed to start the call. Please check your microphone and camera permissions.",
          ),
      )
      setIsCallActive(false)
      isCallActiveRef.current = false
    } finally {
      setIsConnecting(false)
    }
  }

  function endCall() {
    setIsCallActive(false)
    isCallActiveRef.current = false

    stopSpeechRecognition()
    stopCurrentSpeech()

    setIsAiSpeaking(false)
    setActivityStatus("listening")
    setInterimTranscript("")
    setMessages([])
    setSpeechError(null)
    lastSpeechActivityRef.current = null
    recognitionStopReasonRef.current = "manual"

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

  function toggleMicrophone() {
    if (!isCallActiveRef.current) return

    if (isMicMuted) {
      setIsMicMuted(false)
      isMicMutedRef.current = false
      lastSpeechActivityRef.current = Date.now()
      recognitionStopReasonRef.current = "none"
      setSpeechError(null)
      startSpeechRecognition()
    } else {
      setIsMicMuted(true)
      isMicMutedRef.current = true
      stopSpeechRecognition()
      setInterimTranscript("")
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
    }
  }

  if (!isOpen) return null

  const micOn = isCallActive && !isMicMuted && isListening

  const statusText = (() => {
    if (!isCallActive)
      return t(
        "Choose an AI psychologist and press “Start video call” to begin.",
      )
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
            className="text-white hover:bg-indigo-500/60 min-w-[44px] min-h-[44px] flex-shrink-0"
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
                    ? t(
                        "All characters use Google TTS for authentic native accent.",
                      )
                    : t(
                        "AI will understand and respond in this language with native accent",
                      )}
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
                              <source
                                src={character.idleVideo}
                                type="video/mp4"
                              />
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
                            {selectedCharacter.id === character.id
                              ? t("Selected")
                              : t("Select")}
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
                  <p className="mt-3 text-xs text-center text-rose-600">
                    {speechError}
                  </p>
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
                            <source
                              src={selectedCharacter.idleVideo}
                              type="video/mp4"
                            />
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
                            <source
                              src={selectedCharacter.speakingVideo}
                              type="video/mp4"
                            />
                          </video>
                        )}
                      </>
                    ) : (
                      <>
                        {selectedCharacter && !isAiSpeaking && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white">
                            <div className="w-40 h-40 sm:w-56 sm:h-56 relative">
                              <Image
                                src={
                                  selectedCharacter.avatar ||
                                  "/placeholder.svg"
                                }
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
                            <source
                              src={selectedCharacter.speakingVideo}
                              type="video/mp4"
                            />
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
                    <div className="text-[11px] text-slate-500 truncate">
                      {statusText}
                    </div>
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
