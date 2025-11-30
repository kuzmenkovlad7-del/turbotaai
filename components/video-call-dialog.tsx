"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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
  User,
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
import { APP_NAME } from "@/lib/app-config"
import type { HTMLVideoElement } from "react"

// ⚠️ сюда верни свои реальные креды Google TTS, как было раньше
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
}

interface AICharacter {
  id: string
  name: string
  gender: "male" | "female"
  description: string
  avatar: string
  voice: string
  animated?: boolean
  speakingVideo?: string
  idleVideo?: string
  speakingVideoNew?: string
}

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
  webhookUrl: string
  openAiApiKey: string
  onError?: (error: Error) => void
}

type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
}

// персонажи
const aiCharacters: AICharacter[] = [
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
    speakingVideoNew:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9968-64neCIRuZ7CYXDT86QGYu4XSE7j0Ug.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/doc_2025-06-19_20-29-04-QF7QyAGKBJ4Abilc0beRV9jP7VDO7i.mp4",
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
    speakingVideoNew:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9950-XyDJMndgIHEWrKcLj25FUlV4c18GLp.MP4",
    speakingVideo:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG111211_6034-6fD2w1l0V94iXV7x4VeGW74NHbtZrk.MP4",
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
    speakingVideoNew:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_9949-mYErfm0ubE19kr4trLKJrggtvoh4zy.MP4",
    speakingVideo: "/videos/dr-maria-speaking.mp4",
  },
]

export default function VideoCallDialog({
  isOpen,
  onClose,
  webhookUrl,
  openAiApiKey,
  onError,
}: VideoCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  // Character & call state
  const [selectedCharacter, setSelectedCharacter] =
    useState<AICharacter | null>(null)
  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  // Media controls — микрофон по дефолту ВКЛ при старте звонка
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)

  // Permissions
  const [permissionsError, setPermissionsError] = useState<string | null>(null)
  const [showPermissionsPrompt, setShowPermissionsPrompt] = useState(false)

  // Speech state
  const [transcript, setTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [aiResponse, setAiResponse] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [activityStatus, setActivityStatus] = useState<
    "listening" | "thinking" | "speaking"
  >("listening")
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)

  const [messages, setMessages] = useState<ChatMessage[]>([])

  const [lastProcessedText, setLastProcessedText] = useState("")
  const [isWaitingForUser, setIsWaitingForUser] = useState(false)
  const [speechStartTime, setSpeechStartTime] = useState(0)

  // Video state
  const [currentVideoState, setCurrentVideoState] =
    useState<"idle" | "speaking">("idle")

  // Refs
  const recognitionRef = useRef<any>(null)
  const isProcessingRef = useRef(false)
  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const idleVideoRef = useRef<HTMLVideoElement | null>(null)
  const speakingVideoRef = useRef<HTMLVideoElement | null>(null)
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const microphoneStreamRef = useRef<MediaStream | null>(null)
  const reconnectAttemptRef = useRef(0)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const isVoicingRef = useRef(false)
  const voiceCacheRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map())
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const processTranscriptionRef = useRef<
    ((text: string) => Promise<void>) | null
  >(null)

  const isMicMutedRef = useRef(isMicMuted)
  const isCallActiveRef = useRef(isCallActive)
  const suppressRecognitionRef = useRef(false) // блокируем SR, пока говорит ассистент

  const [audioInitialized, setAudioInitialized] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)

  const startSpeechRecognitionRef = useRef<() => void | null>(null)
  const reconnectMicrophoneRef = useRef<() => Promise<void> | null>(null)

  // i18n
  const currentLocale = getLocaleForLanguage(currentLanguage.code)
  const nativeVoicePreferences = getNativeVoicePreferences()

  const hasEnhancedVideo =
    !!selectedCharacter?.idleVideo && !!selectedCharacter?.speakingVideoNew

  // ==== PERMISSIONS =====================================================

  const checkMediaPermissions = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        return {
          hasPermissions: false,
          microphoneGranted: false,
          cameraGranted: false,
          error: t(
            "Your browser does not support audio/video features required for video calls.",
          ),
        }
      }

      let microphoneGranted = false
      let cameraGranted = false
      let microphoneError = ""
      let cameraError = ""

      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        microphoneGranted = true
        micStream.getTracks().forEach((track) => track.stop())
      } catch (micError: any) {
        if (
          micError.name === "NotAllowedError" ||
          micError.name === "PermissionDeniedError"
        ) {
          microphoneError = t(
            "Microphone access was denied. Please allow microphone access in your browser settings.",
          )
        } else if (micError.name === "NotFoundError") {
          microphoneError = t(
            "No microphone found. Please connect a microphone and try again.",
          )
        } else {
          microphoneError = t(
            "Unable to access microphone. Error: {{error}}",
            { error: micError.message },
          )
        }
      }

      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        })
        cameraGranted = true
        camStream.getTracks().forEach((track) => track.stop())
      } catch (camError: any) {
        if (
          camError.name === "NotAllowedError" ||
          camError.name === "PermissionDeniedError"
        ) {
          cameraError = t(
            "Camera access was denied. Please allow camera access in your browser settings.",
          )
        } else if (camError.name === "NotFoundError") {
          cameraError = t(
            "No camera found. Please connect a camera and try again.",
          )
        } else {
          cameraError = t(
            "Unable to access camera. Error: {{error}}",
            { error: camError.message },
          )
        }
      }

      if (microphoneGranted && cameraGranted) {
        return {
          hasPermissions: true,
          microphoneGranted: true,
          cameraGranted: true,
        }
      }

      const errors = []
      if (microphoneError) errors.push(microphoneError)
      if (cameraError) errors.push(cameraError)

      return {
        hasPermissions: false,
        microphoneGranted,
        cameraGranted,
        error: errors.join(" "),
      }
    } catch (error: any) {
      return {
        hasPermissions: false,
        microphoneGranted: false,
        cameraGranted: false,
        error: t(
          "Unable to check media permissions. Please ensure your browser supports audio/video features.",
        ),
      }
    }
  }, [t])

  // ==== HELPERS =========================================================

  const cleanResponseText = useCallback((text: string) => {
    if (!text) return ""

    if (text.startsWith('[{"output":')) {
      try {
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].output) {
          return parsed[0].output.trim()
        }
      } catch {
        // ignore
      }
    }

    return text
      .replace(/\n\n/g, " ")
      .replace(/\*\*/g, "")
      .replace(/[\n\r]/g, " ")
      .trim()
  }, [])

  const getRefinedVoiceForLanguage = useCallback(
    (langCode: string, preferredGender: "female" | "male" = "female") => {
      if (!window.speechSynthesis) return null

      const cacheKey = `${langCode}-${preferredGender}`
      if (voiceCacheRef.current.has(cacheKey)) {
        return voiceCacheRef.current.get(cacheKey)!
      }

      const voices = window.speechSynthesis.getVoices()
      if (!voices.length) return null

      const nativeVoices =
        nativeVoicePreferences?.[langCode]?.[preferredGender] || []

      for (const voiceName of nativeVoices) {
        const exact = voices.find((v) => v.name === voiceName)
        if (exact) {
          voiceCacheRef.current.set(cacheKey, exact)
          return exact
        }
      }

      for (const voiceName of nativeVoices) {
        const partial = voices.find(
          (v) =>
            v.name.includes(voiceName) ||
            voiceName.includes(v.name) ||
            v.name.toLowerCase().includes(voiceName.toLowerCase()) ||
            voiceName.toLowerCase().includes(v.name.toLowerCase()),
        )
        if (partial) {
          voiceCacheRef.current.set(cacheKey, partial)
          return partial
        }
      }

      const getLangVoices = (lang: string) => {
        const langLower = lang.toLowerCase()
        return voices.filter((v) => {
          const voiceLang = v.lang.toLowerCase()
          const voiceName = v.name.toLowerCase()

          if (voiceLang.startsWith(langLower)) return true
          if (voiceLang.includes(`${langLower}-`)) return true

          if (lang === "ru") {
            return (
              voiceLang.includes("ru-") ||
              voiceName.includes("русский") ||
              voiceName.includes("russian")
            )
          }
          if (lang === "en") {
            return voiceLang.includes("en-") || voiceName.includes("english")
          }

          return false
        })
      }

      const langVoices = getLangVoices(langCode)
      if (langVoices.length) {
        const best = langVoices[0]
        voiceCacheRef.current.set(cacheKey, best)
        return best
      }

      if (langCode !== "en") {
        const en = getRefinedVoiceForLanguage("en", preferredGender)
        if (en) {
          voiceCacheRef.current.set(cacheKey, en)
          return en
        }
      }

      if (voices.length) {
        const fallback = voices[0]
        voiceCacheRef.current.set(cacheKey, fallback)
        return fallback
      }

      return null
    },
    [nativeVoicePreferences],
  )

  // ==== MICROPHONE & SR ================================================

  const setupMicrophone = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100,
        channelCount: 1,
      },
    })
    microphoneStreamRef.current = stream

    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.onended = () => {
        if (isCallActive && !isMicMuted) {
          reconnectMicrophoneRef.current?.()
        }
      }
    }
    return stream
  }, [isCallActive, isMicMuted])

  const reconnectMicrophone = useCallback(async () => {
    if (reconnectAttemptRef.current >= 3) return

    reconnectAttemptRef.current++

    try {
      if (microphoneStreamRef.current) {
        microphoneStreamRef.current.getTracks().forEach((track) => track.stop())
      }

      await new Promise((r) => setTimeout(r, 1000))
      await setupMicrophone()

      if (isCallActive && !isMicMuted) {
        startSpeechRecognitionRef.current?.()
      }

      reconnectAttemptRef.current = 0
    } catch {
      setTimeout(
        () => reconnectMicrophoneRef.current?.(),
        2000 * reconnectAttemptRef.current,
      )
    }
  }, [isCallActive, isMicMuted, setupMicrophone])

  useEffect(() => {
    reconnectMicrophoneRef.current = reconnectMicrophone
  }, [reconnectMicrophone])

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognitionInstance = new SpeechRecognition()
    recognitionInstance.continuous = true
    recognitionInstance.interimResults = true
    recognitionInstance.maxAlternatives = 3
    recognitionInstance.lang = currentLocale

    let finalTranscriptBuffer = ""
    let silenceTimeout: NodeJS.Timeout | null = null

    recognitionInstance.onstart = () => {
      setIsListening(true)
      setActivityStatus("listening")
    }

    recognitionInstance.onresult = async (event: any) => {
      let currentInterimTranscript = ""
      let hasNewFinalResult = false

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcriptChunk = result[0].transcript.trim()
        const confidence = result[0].confidence || 0.5

        if (result.isFinal && transcriptChunk && confidence > 0.3) {
          finalTranscriptBuffer += transcriptChunk + " "
          hasNewFinalResult = true
        } else if (transcriptChunk) {
          currentInterimTranscript += transcriptChunk
        }
      }

      if (currentInterimTranscript) {
        setInterimTranscript(currentInterimTranscript)
      }

      if (silenceTimeout) clearTimeout(silenceTimeout)

      silenceTimeout = setTimeout(() => {
        if (finalTranscriptBuffer.trim().length > 2) {
          const textToProcess = finalTranscriptBuffer.trim()

          if (
            textToProcess !== lastProcessedText &&
            !isProcessingRef.current &&
            !isAiSpeaking &&
            !isVoicingRef.current
          ) {
            finalTranscriptBuffer = ""
            setInterimTranscript("")
            setIsWaitingForUser(false)

            setTranscript((prev) =>
              prev ? `${prev} ${textToProcess}` : textToProcess,
            )

            processTranscriptionRef.current?.(textToProcess)
          } else {
            finalTranscriptBuffer = ""
          }
        }
      }, 1500)

      if (hasNewFinalResult && finalTranscriptBuffer.trim().length > 2) {
        const textToProcess = finalTranscriptBuffer.trim()

        if (
          textToProcess !== lastProcessedText &&
          !isProcessingRef.current &&
          !isAiSpeaking &&
          !isVoicingRef.current
        ) {
          finalTranscriptBuffer = ""
          setInterimTranscript("")
          setIsWaitingForUser(false)

          setTranscript((prev) =>
            prev ? `${prev} ${textToProcess}` : textToProcess,
          )

          processTranscriptionRef.current?.(textToProcess)
        } else {
          finalTranscriptBuffer = ""
        }
      }
    }

    recognitionInstance.onerror = (event: any) => {
      if (
        event.error === "no-speech" ||
        event.error === "aborted" ||
        event.error === "audio-capture" ||
        event.error === "not-allowed"
      ) {
        return
      }

      if (event.error === "language-not-supported") {
        recognitionInstance.lang = "en-US"
        setTimeout(() => {
          try {
            recognitionInstance.start()
          } catch {
            // ignore
          }
        }, 1000)
        return
      }

      if (event.error === "network" && isCallActive && !isMicMuted) {
        setTimeout(() => {
          try {
            recognitionInstance.start()
          } catch {
            // ignore
          }
        }, 2000)
      }
    }

    recognitionInstance.onend = () => {
      if (silenceTimeout) clearTimeout(silenceTimeout)

      if (
        isCallActiveRef.current &&
        !isMicMutedRef.current &&
        !suppressRecognitionRef.current
      ) {
        try {
          recognitionInstance.start()
          setIsListening(true)
        } catch {
          setTimeout(() => {
            if (
              isCallActiveRef.current &&
              !isMicMutedRef.current &&
              !suppressRecognitionRef.current
            ) {
              try {
                recognitionInstance.start()
                setIsListening(true)
              } catch {
                // ignore
              }
            }
          }, 100)
        }
      } else {
        setIsListening(false)
      }
    }

    try {
      recognitionInstance.start()

      recognitionRef.current = {
        stop: () => {
          try {
            if (silenceTimeout) clearTimeout(silenceTimeout)
            recognitionInstance.stop()
          } catch {
            // ignore
          }
        },
        start: () => {
          try {
            recognitionInstance.start()
          } catch {
            // ignore
          }
        },
      }
      startSpeechRecognitionRef.current = recognitionRef.current.start
    } catch (error) {
      console.log("Error starting recognition:", error)
    }
  }, [
    currentLocale,
    isCallActive,
    isMicMuted,
    lastProcessedText,
    isAiSpeaking,
  ])

  useEffect(() => {
    startSpeechRecognitionRef.current = startSpeechRecognition
  }, [startSpeechRecognition])

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
  }, [isMicMuted])

  useEffect(() => {
    isCallActiveRef.current = isCallActive
  }, [isCallActive])

  // ==== BROWSER TTS =====================================================

  const fallbackToBrowserTTS = useCallback(
    (cleanText: string, gender: "male" | "female", cleanup: () => void) => {
      if (!window.speechSynthesis) {
        cleanup()
        return
      }

      window.speechSynthesis.cancel()

      setTimeout(() => {
        try {
          setCurrentVideoState("speaking")

          if (hasEnhancedVideo) {
            if (idleVideoRef.current) idleVideoRef.current.pause()
            if (speakingVideoRef.current && selectedCharacter?.speakingVideoNew) {
              speakingVideoRef.current.currentTime = 0
              speakingVideoRef.current.play().catch(() => {})
            }
          }

          const utterance = new SpeechSynthesisUtterance()
          utterance.text = cleanText
          utterance.lang = currentLocale

          const selectedVoice = getRefinedVoiceForLanguage(
            currentLanguage.code,
            gender,
          )
          if (selectedVoice) utterance.voice = selectedVoice

          const speechParameters = getNativeSpeechParameters(
            currentLanguage.code,
            gender,
          )
          utterance.rate = speechParameters.rate
          utterance.pitch = speechParameters.pitch
          utterance.volume = speechParameters.volume

          currentUtteranceRef.current = utterance

          utterance.onend = () => cleanup()
          utterance.onerror = () => cleanup()

          window.speechSynthesis!.speak(utterance)
        } catch {
          cleanup()
        }
      }, 200)
    },
    [
      currentLocale,
      currentLanguage,
      hasEnhancedVideo,
      selectedCharacter,
      getRefinedVoiceForLanguage,
    ],
  )

  const speakText = useCallback(
    async (text: string) => {
      if (!isCallActive) return
      if (!isSoundEnabled) return
      if (!text || !text.trim()) return

      suppressRecognitionRef.current = true
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          console.log("Error stopping recognition before TTS:", e)
        }
      }
      setIsListening(false)

      if (isVoicingRef.current || isAiSpeaking) {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause()
          currentAudioRef.current.currentTime = 0
          currentAudioRef.current.src = ""
          currentAudioRef.current = null
        }
        if (window.speechSynthesis?.speaking) {
          window.speechSynthesis.cancel()
        }
        currentUtteranceRef.current = null
        setIsAiSpeaking(false)
        isVoicingRef.current = false
      }

      const cleanedText = cleanResponseText(text)
      if (!cleanedText) {
        suppressRecognitionRef.current = false
        if (!isMicMuted && isCallActiveRef.current) {
          startSpeechRecognitionRef.current?.()
        }
        return
      }

      setIsAiSpeaking(true)
      isVoicingRef.current = true
      setActivityStatus("speaking")
      setIsWaitingForUser(true)
      setSpeechStartTime(Date.now())

      const characterGender = selectedCharacter?.gender || "female"
      const isDrAlexander = selectedCharacter?.id === "dr-alexander"

      const cleanup = () => {
        try {
          suppressRecognitionRef.current = false

          if (currentAudioRef.current) {
            currentAudioRef.current.pause()
            currentAudioRef.current.currentTime = 0
            currentAudioRef.current.src = ""
            currentAudioRef.current = null
          }
          currentUtteranceRef.current = null
          if (window.speechSynthesis) {
            window.speechSynthesis.cancel()
          }

          setIsAiSpeaking(false)
          isVoicingRef.current = false
          setCurrentVideoState("idle")

          if (hasEnhancedVideo) {
            if (speakingVideoRef.current) {
              speakingVideoRef.current.pause()
              speakingVideoRef.current.currentTime = 0
            }
            if (
              idleVideoRef.current &&
              selectedCharacter?.idleVideo &&
              isCallActiveRef.current
            ) {
              idleVideoRef.current.currentTime = 0
              idleVideoRef.current.play().catch(() => {})
            }
          }

          if (!isMicMuted && isCallActiveRef.current) {
            setActivityStatus("listening")
            startSpeechRecognitionRef.current?.()
          }
          setIsWaitingForUser(false)

          if (cleanupTimeoutRef.current) {
            clearTimeout(cleanupTimeoutRef.current)
          }
        } catch (e) {
          console.error("Cleanup error:", e)
        }
      }

      try {
        if (shouldUseGoogleTTS(currentLanguage.code)) {
          try {
            const audioDataUrl = await generateGoogleTTS(
              cleanedText,
              currentLanguage.code,
              characterGender,
              VIDEO_CALL_GOOGLE_TTS_CREDENTIALS,
              VIDEO_CALL_VOICE_CONFIGS,
            )

            if (!audioDataUrl) throw new Error("No audio from Google TTS")

            setCurrentVideoState("speaking")

            if (hasEnhancedVideo) {
              if (idleVideoRef.current) idleVideoRef.current.pause()
              if (
                speakingVideoRef.current &&
                selectedCharacter?.speakingVideoNew
              ) {
                speakingVideoRef.current.currentTime = 0
                await speakingVideoRef.current.play().catch(() => {})
              }
            }

            const audio = new Audio()
            currentAudioRef.current = audio
            audio.preload = "auto"
            audio.volume = 1
            audio.playsInline = true
            audio.crossOrigin = "anonymous"
            audio.setAttribute("playsinline", "true")
            audio.setAttribute("webkit-playsinline", "true")

            let audioEnded = false
            let audioError = false

            audio.onended = () => {
              if (!audioEnded && !audioError) {
                audioEnded = true
                cleanup()
              }
            }
            audio.onerror = () => {
              if (!audioError && !audioEnded) {
                audioError = true
                cleanup()
              }
            }

            audio.src = audioDataUrl
            audio.load()

            await new Promise((resolve, reject) => {
              const timeout = setTimeout(
                () => reject(new Error("Audio load timeout")),
                10000,
              )
              audio.oncanplaythrough = () => {
                clearTimeout(timeout)
                resolve(true)
              }
              audio.onerror = () => {
                clearTimeout(timeout)
                reject(new Error("Audio load error"))
              }
            })

            const delay = isDrAlexander ? 0 : 100
            if (delay) await new Promise((r) => setTimeout(r, delay))
            await audio.play()
          } catch (e) {
            console.error("Google TTS error:", e)
            fallbackToBrowserTTS(cleanedText, characterGender, cleanup)
          }
        } else {
          fallbackToBrowserTTS(cleanedText, characterGender, cleanup)
        }
      } catch (e) {
        console.error("Speech error:", e)
        cleanup()
      }
    },
    [
      isCallActive,
      isSoundEnabled,
      cleanResponseText,
      currentLanguage,
      selectedCharacter,
      isAiSpeaking,
      hasEnhancedVideo,
      isMicMuted,
      fallbackToBrowserTTS,
    ],
  )

  // preload voices
  useEffect(() => {
    if (window.speechSynthesis) {
      const loadVoices = () => {
        const voices = window.speechSynthesis!.getVoices()
        if (voices.length) {
          getRefinedVoiceForLanguage(currentLanguage.code, "female")
          getRefinedVoiceForLanguage(currentLanguage.code, "male")
        }
      }
      loadVoices()
      window.speechSynthesis.addEventListener("voiceschanged", loadVoices)
      return () => {
        window.speechSynthesis?.removeEventListener(
          "voiceschanged",
          loadVoices,
        )
      }
    }
  }, [currentLanguage.code, getRefinedVoiceForLanguage])

  // ==== PROCESS TRANSCRIPTION ==========================================

  const processTranscription = useCallback(
    async (text: string) => {
      if (!isCallActive) return
      if (isProcessingRef.current || !text.trim()) return
      if (text === lastProcessedText) return

      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, role: "user", text },
      ])

      // прерываем озвучку, если шёл ответ
      if (isAiSpeaking || isVoicingRef.current) {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause()
          currentAudioRef.current.currentTime = 0
          currentAudioRef.current.src = ""
          currentAudioRef.current = null
        }
        if (window.speechSynthesis?.speaking) {
          window.speechSynthesis.cancel()
        }
        currentUtteranceRef.current = null
        setIsAiSpeaking(false)
        isVoicingRef.current = false
        setCurrentVideoState("idle")

        if (hasEnhancedVideo) {
          if (speakingVideoRef.current) {
            speakingVideoRef.current.pause()
            speakingVideoRef.current.currentTime = 0
          }
          if (idleVideoRef.current && selectedCharacter?.idleVideo) {
            idleVideoRef.current.currentTime = 0
            idleVideoRef.current.play().catch(() => {})
          }
        }
      }

      isProcessingRef.current = true
      setActivityStatus("thinking")

      try {
        if (!webhookUrl) {
          throw new Error("WEBHOOK_URL_MISSING")
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        const params = new URLSearchParams({
          text,
          language: currentLanguage.code,
          languageName: currentLanguage.name,
          locale: currentLocale,
          user: user?.email || "guest@example.com",
          requestType: "video_call",
          voiceGender: selectedCharacter?.gender || "female",
          characterName: selectedCharacter?.name || "AI Psychologist",
        })

        const webhookResponse = await fetch(
          `${webhookUrl}?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              "Accept-Language": currentLanguage.code,
              "Content-Language": currentLanguage.code,
            },
            signal: controller.signal,
          },
        )

        clearTimeout(timeoutId)

        if (!webhookResponse.ok) {
          throw new Error(`Webhook error: ${webhookResponse.status}`)
        }

        let responseData: any
        const contentType = webhookResponse.headers.get("content-type")

        if (contentType?.includes("application/json")) {
          responseData = await webhookResponse.json()
        } else {
          const textResponse = await webhookResponse.text()
          try {
            responseData = JSON.parse(textResponse)
          } catch {
            responseData = { response: textResponse }
          }
        }

        let aiResponseText = ""

        if (typeof responseData === "string") {
          aiResponseText = responseData
        } else if (Array.isArray(responseData) && responseData.length > 0) {
          const firstItem = responseData[0]
          aiResponseText =
            firstItem.output ||
            firstItem.response ||
            firstItem.text ||
            firstItem.message ||
            JSON.stringify(firstItem)
        } else if (responseData && typeof responseData === "object") {
          aiResponseText =
            responseData.response ||
            responseData.text ||
            responseData.message ||
            responseData.output ||
            responseData.content ||
            responseData.result ||
            JSON.stringify(responseData)
        }

        const cleanedResponse = cleanResponseText(aiResponseText)
        if (!cleanedResponse) throw new Error("Empty response received")

        if (isCallActive) {
          setLastProcessedText(text)

          setMessages((prev) => [
            ...prev,
            {
              id: prev.length + 1,
              role: "assistant",
              text: cleanedResponse,
            },
          ])

          setAiResponse(cleanedResponse)
          setActivityStatus("listening")

          setTimeout(() => {
            if (isCallActive) {
              speakText(cleanedResponse)
            }
          }, 100)
        }
      } catch (error: any) {
        console.error("Processing error:", error)
        if (onError && error instanceof Error) {
          // можно логировать, но НЕ алертим пользователя здесь
          try {
            onError(error)
          } catch {
            // игнор
          }
        }

        if (!isCallActive) return

        let errorMessage: string

        if (error?.message === "WEBHOOK_URL_MISSING") {
          errorMessage = t(
            "Video call backend is not configured yet. Please try again a bit later.",
          )
        } else if (error?.name === "AbortError") {
          errorMessage = t("Connection timeout. Please try again.")
        } else if (error?.message === "Empty response received") {
          errorMessage = t(
            "I received your message but couldn't generate a response. Could you try rephrasing?",
          )
        } else {
          errorMessage = t(
            "I couldn't process your message. Could you try again.",
          )
        }

        setAiResponse(errorMessage)
        setMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            role: "assistant",
            text: errorMessage,
          },
        ])
        setSpeechError(errorMessage)

        // при ошибке тоже пробуем озвучить, но она уже внутри try/catch
        speakText(errorMessage).catch(() => {})
      } finally {
        isProcessingRef.current = false
        if (isCallActive) {
          setActivityStatus("listening")
        }
      }
    },
    [
      currentLanguage.code,
      currentLanguage.name,
      currentLocale,
      t,
      user?.email,
      selectedCharacter,
      speakText,
      cleanResponseText,
      lastProcessedText,
      isCallActive,
      isAiSpeaking,
      hasEnhancedVideo,
      webhookUrl,
      onError,
    ],
  )

  useEffect(() => {
    processTranscriptionRef.current = processTranscription
  }, [processTranscription])

  // ==== CAMERA ==========================================================

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
      if (userVideoRef.current?.srcObject) {
        const stream = userVideoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        userVideoRef.current.srcObject = null
      }
    }
  }, [isCallActive, isCameraOff])

  const toggleCamera = useCallback(() => {
    if (isCameraOff) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          if (userVideoRef.current) {
            userVideoRef.current.srcObject = stream
          }
          setIsCameraOff(false)
        })
        .catch(() => {
          alert(
            t(
              "Could not access your camera. Please check your permissions.",
            ),
          )
        })
    } else {
      if (userVideoRef.current?.srcObject) {
        const stream = userVideoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        userVideoRef.current.srcObject = null
      }
      setIsCameraOff(true)
    }
  }, [isCameraOff, t])

  // ==== SOUND & MIC TOGGLES ============================================

  const toggleSound = useCallback(() => {
    setIsSoundEnabled((prev) => {
      const next = !prev
      if (!next && isAiSpeaking) {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause()
          currentAudioRef.current = null
        }
        currentUtteranceRef.current = null
        if (window.speechSynthesis) window.speechSynthesis.cancel()
      }
      return next
    })
  }, [isAiSpeaking])

  const toggleMicrophone = useCallback(() => {
    if (isMicMuted) {
      setIsMicMuted(false)
      setIsListening(true)
      setActivityStatus("listening")
      startSpeechRecognitionRef.current?.()
    } else {
      if (recognitionRef.current?.stop) {
        recognitionRef.current.stop()
      }
      setIsListening(false)
      setInterimTranscript("")
      setIsMicMuted(true)
    }
  }, [isMicMuted])

  // ==== AUDIO INIT (MOBILE) ============================================

  const initializeMobileAudio = useCallback(async () => {
    if (audioInitialized) return

    try {
      if (typeof window !== "undefined" && "AudioContext" in window) {
        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextClass()
        }

        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume()
        }
      }

      const silentAudio = new Audio(
        "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T/jQwAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZDwP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
      )
      silentAudio.playsInline = true
      silentAudio.volume = 0.01

      try {
        await silentAudio.play()
        silentAudio.pause()
        silentAudio.currentTime = 0
      } catch {
        // ignore
      }

      setAudioInitialized(true)
    } catch (error) {
      console.error("Audio initialization error:", error)
    }
  }, [audioInitialized])

  // ==== START / END CALL ===============================================

  const startCall = useCallback(async () => {
    if (!selectedCharacter) return

    setIsConnecting(true)
    setPermissionsError(null)
    setShowPermissionsPrompt(false)

    try {
      await initializeMobileAudio()

      const permissionsCheck = await checkMediaPermissions()
      if (!permissionsCheck.hasPermissions) {
        setPermissionsError(
          permissionsCheck.error || t("Microphone and camera access required"),
        )
        setShowPermissionsPrompt(true)
        setIsConnecting(false)
        return
      }

      setIsCallActive(true)
      setCurrentVideoState("idle")
      setIsMicMuted(false)
      setIsListening(true)
      setActivityStatus("listening")
      reconnectAttemptRef.current = 0
      setMessages([])
      setSpeechError(null)

      await setupMicrophone()

      // сразу запускаем распознавание
      startSpeechRecognitionRef.current?.()

      if (hasEnhancedVideo && selectedCharacter.idleVideo) {
        setTimeout(() => {
          if (idleVideoRef.current && isCallActiveRef.current) {
            idleVideoRef.current.currentTime = 0
            idleVideoRef.current.play().catch(() => {})
          }
        }, 500)
      }
    } catch (error: any) {
      console.error("Failed to start call:", error)
      setPermissionsError(
        error.message ||
          t(
            "Failed to start the call. Please check your microphone and camera permissions.",
          ),
      )
      setShowPermissionsPrompt(true)
    } finally {
      setIsConnecting(false)
    }
  }, [
    selectedCharacter,
    t,
    hasEnhancedVideo,
    setupMicrophone,
    checkMediaPermissions,
    initializeMobileAudio,
  ])

  const retryPermissions = useCallback(() => {
    setPermissionsError(null)
    setShowPermissionsPrompt(false)
    startCall()
  }, [startCall])

  const endCall = useCallback(() => {
    setIsCallActive(false)
    setIsListening(false)
    setIsWaitingForUser(false)
    setCurrentVideoState("idle")
    setActivityStatus("listening")
    setIsMicMuted(true)
    isProcessingRef.current = false
    reconnectAttemptRef.current = 0
    suppressRecognitionRef.current = false

    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current)
      cleanupTimeoutRef.current = null
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }

    currentUtteranceRef.current = null
    if (window.speechSynthesis) window.speechSynthesis.cancel()

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }

    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          // ignore
        }
      })
      microphoneStreamRef.current = null
    }

    if (idleVideoRef.current) {
      idleVideoRef.current.pause()
      idleVideoRef.current.currentTime = 0
    }
    if (speakingVideoRef.current) {
      speakingVideoRef.current.pause()
      speakingVideoRef.current.currentTime = 0
    }

    if (userVideoRef.current?.srcObject) {
      const stream = userVideoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          // ignore
        }
      })
      userVideoRef.current.srcObject = null
    }

    setTranscript("")
    setInterimTranscript("")
    setAiResponse("")
    setLastProcessedText("")
    setSpeechStartTime(0)
    setSpeechError(null)
    setMessages([])
  }, [])

  useEffect(() => {
    if (!isOpen && isCallActive) {
      endCall()
    }

    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current)
      }
      if (recognitionRef.current) recognitionRef.current.stop()
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
      currentUtteranceRef.current = null
      if (window.speechSynthesis) window.speechSynthesis.cancel()

      if (microphoneStreamRef.current) {
        microphoneStreamRef.current
          .getTracks()
          .forEach((track) => track.stop())
      }

      if (idleVideoRef.current) {
        idleVideoRef.current.pause()
        idleVideoRef.current.currentTime = 0
      }
      if (speakingVideoRef.current) {
        speakingVideoRef.current.pause()
        speakingVideoRef.current.currentTime = 0
      }

      if (userVideoRef.current?.srcObject) {
        const stream = userVideoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        userVideoRef.current.srcObject = null
      }
    }
  }, [isOpen, isCallActive, endCall])

  if (!isOpen) return null

  const micOn = isCallActive && !isMicMuted && isListening

  const statusText = (() => {
    if (!isCallActive)
      return t(
        "Choose an AI psychologist and press “Start video call” to begin.",
      )
    if (isAiSpeaking)
      return t("Assistant is speaking. Please wait a moment.")
    if (micOn) return t("Listening… you can speak.")
    return t("Paused. Turn on microphone to continue.")
  })()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl flex flex-col h-[100dvh] sm:h-[90vh] max-h-none sm:max-h-[800px] overflow-hidden">
        {/* HEADER */}
        <div className="p-3 sm:p-4 border-b flex justify-between items-center rounded-t-xl relative bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white">
          <div className="flex flex-col flex-1 min-w-0 pr-2">
            <h3 className="font-semibold text-base sm:text-lg truncate flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                <Phone className="h-4 w-4 rotate-[135deg]" />
              </span>
              {t("AI Psychologist Video Call")}
            </h3>
            <div className="text-xs text-indigo-100 mt-1 truncate">
              {t("Video session in {{language}}", {
                language: currentLanguage.name,
              })}{" "}
              · {currentLanguage.flag}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 mr-2">
            <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-indigo-50">
              {APP_NAME} · {t("Video assistant online")}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-indigo-500/60 min-w-[44px] min-h-[44px] flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col touch-pan-y">
          {!isCallActive ? (
            // выбор персонажа
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-center mb-6 sm:mb-8 px-2">
                <h3 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3">
                  {t("Choose Your AI Psychologist")}
                </h3>
                <p className="text-sm sm:text-base text-gray-1000 max-w-md mx-auto">
                  {t(
                    "Select the AI psychologist you'd like to speak with during your video call.",
                  )}
                </p>
              </div>

              {showPermissionsPrompt && permissionsError && (
                <div className="mb-4 sm:mb-6 bg-red-50 border-2 border-red-300 rounded-lg p-4 sm:p-6 w-full max-w-md mx-2">
                  <div className="flex items-start mb-4">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-6 w-6 text-red-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </div>
                    <div className="ml-3 flex-1">
                      <h3 className="text-sm font-medium text-red-800">
                        {t("Permissions Required")}
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{permissionsError}</p>
                      </div>
                      <div className="mt-4">
                        <Button
                          onClick={retryPermissions}
                          className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 min-h-[44px]"
                        >
                          {t("Grant Permissions & Retry")}
                        </Button>
                      </div>
                      <div className="mt-3 text-xs text-red-600">
                        <p className="font-medium mb-1">
                          {t("How to enable permissions")}:
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>
                            {t(
                              "Click the camera/microphone icon in your browser's address bar",
                            )}
                          </li>
                          <li>
                            {t(
                              "Select 'Allow' for both camera and microphone",
                            )}
                          </li>
                          <li>
                            {t(
                              "Click 'Grant Permissions & Retry' button above",
                            )}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-6 bg-blue-50 p-4 rounded-lg w-full max-w-xs text-center mx-2">
                <p className="text-sm font-medium text-blue-700 mb-1">
                  {t("Video call language")}:
                </p>
                <div className="text-lg font-semibold text-blue-800 flex items-center justify-center">
                  <span className="mr-2">{currentLanguage.flag}</span>
                  {currentLanguage.name}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  {shouldUseGoogleTTS(currentLanguage.code)
                    ? t(
                        "All characters use Google TTS for authentic native Ukrainian accent",
                      )
                    : t(
                        "AI will understand and respond in this language with native accent",
                      )}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full max-w-5xl px-2">
                {aiCharacters.map((character) => (
                  <div
                    key={character.id}
                    className={`relative bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer p-4 sm:p-6 border-2 ${
                      selectedCharacter?.id === character.id
                        ? "border-primary-600"
                        : "border-transparent"
                    }`}
                    onClick={() => setSelectedCharacter(character)}
                  >
                    <div className="relative w-full aspect-square mb-3 sm:mb-4 overflow-hidden rounded-lg">
                      <Image
                        src={character.avatar || "/placeholder.svg"}
                        alt={character.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        priority
                      />
                    </div>
                    <h4 className="font-semibold text-base sm:text-lg text-center mb-1 sm:mb-2">
                      {character.name}
                    </h4>
                    <p className="text-xs sm:text-sm text-gray-600 text-center mb-3 sm:mb-4">
                      {character.description}
                    </p>
                    <Button
                      className={`w-full min-h-[44px] ${
                        selectedCharacter?.id === character.id
                          ? "bg-primary-600 hover:bg-primary-700 text-white"
                          : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedCharacter(character)
                      }}
                    >
                      {selectedCharacter?.id === character.id
                        ? t("Selected")
                        : t("Select")}
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-6 sm:mt-8 w-full max-w-md px-2">
                <Button
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white text-base sm:text-lg py-4 sm:py-6 min-h-[56px]"
                  onClick={startCall}
                  disabled={!selectedCharacter || isConnecting}
                >
                  {isConnecting
                    ? t("Connecting...")
                    : t("Start Video Call")}
                </Button>
              </div>
            </div>
          ) : (
            // активный звонок
            <div className="flex-1 flex flex-col">
              {/* ВИДЕО */}
              <div className="relative w-full aspect-[16/9] bg-black rounded-lg overflow-hidden mb-3 sm:mb-4">
                <div className="absolute inset-0">
                  {hasEnhancedVideo ? (
                    <>
                      {selectedCharacter?.idleVideo && (
                        <video
                          ref={idleVideoRef}
                          className={`absolute inset-0 w-full h-full object-cover scale-[1.12] ${
                            currentVideoState === "idle"
                              ? "opacity-100"
                              : "opacity-0"
                          } transition-opacity duration-300`}
                          muted
                          loop
                          playsInline
                          preload="auto"
                        >
                          <source
                            src={selectedCharacter.idleVideo}
                            type="video/mp4"
                          />
                        </video>
                      )}

                      {selectedCharacter?.speakingVideoNew && (
                        <video
                          ref={speakingVideoRef}
                          className={`absolute inset-0 w-full h-full object-cover scale-[1.12] ${
                            currentVideoState === "speaking"
                              ? "opacity-100"
                              : "opacity-0"
                          } transition-opacity duration-300`}
                          muted
                          loop
                          playsInline
                          preload="auto"
                        >
                          <source
                            src={selectedCharacter.speakingVideoNew}
                            type="video/mp4"
                          />
                        </video>
                      )}
                    </>
                  ) : (
                    <>
                      {selectedCharacter && !isAiSpeaking && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-64 h-64 relative">
                            <Image
                              src={selectedCharacter.avatar || "/placeholder.svg"}
                              alt={selectedCharacter.name}
                              fill
                              className="object-cover rounded-full scale-[1.12]"
                              sizes="256px"
                            />
                          </div>
                        </div>
                      )}

                      {selectedCharacter?.speakingVideo && (
                        <video
                          ref={speakingVideoRef}
                          className={`absolute inset-0 w-full h-full object-cover scale-[1.12] ${
                            isAiSpeaking ? "opacity-100" : "opacity-0"
                          } transition-opacity duration-300`}
                          muted
                          loop
                          playsInline
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

                {/* единственный статус — справа сверху */}
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
                    : shouldUseGoogleTTS(currentLanguage.code)
                    ? t("Speaking with Google TTS...")
                    : t("Speaking...")}
                </div>

                {!isCameraOff && (
                  <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 w-20 sm:w-1/4 aspect-video bg-gray-800 rounded overflow-hidden shadow-lg">
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

              {/* ЧАТ */}
              <div className="flex-1 flex flex-col space-y-3 sm:space-y-4 overflow-y-auto touch-pan-y">
                <div className="space-y-3 sm:space-y-4">
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
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-blue-800">
                          <User className="h-3.5 w-3.5" />
                          {t("You said")}
                        </p>
                        <p>{msg.text}</p>
                      </div>
                    ) : (
                      <div
                        key={msg.id}
                        className="max-w-[85%] rounded-2xl bg-emerald-50 px-3 py-3 text-xs sm:text-sm text-slate-900"
                      >
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-emerald-800">
                          <Brain className="h-3.5 w-3.5" />
                          {selectedCharacter?.name || t("AI Psychologist")}
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
                    <div className="bg-red-50 rounded-lg p-3 text-xs sm:text-sm text-red-700">
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
                    : isListening
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
                  isCameraOff
                    ? "bg-red-100 text-red-600"
                    : "bg-gray-100"
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
                  isSoundEnabled
                    ? "bg-gray-100"
                    : "bg-red-100 text-red-600"
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
                <Phone className="h-6 w-6 sm:h-5 sm:w-5 transform rotate-180" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
