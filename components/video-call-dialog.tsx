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

// URL вебхука для видео-ассистента
const VIDEO_ASSISTANT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AI_VIDEO_ASSISTANT_WEBHOOK_URL ||
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL ||
  "/api/turbotaai-agent"

// Заглушка для кредов Google TTS (внутри generateGoogleTTS используется свой бэкенд)
const VIDEO_CALL_GOOGLE_TTS_CREDENTIALS: any = {}

// Конфиги голосов под разные языки (можно расширять)
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
  openAiApiKey: string
  onError?: (error: Error) => void
}

type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
}

// Базовый персонаж
const defaultCharacter: AICharacter = {
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
}

// Универсальный парсер ответа от n8n
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

export default function VideoCallDialog({
  isOpen,
  onClose,
  openAiApiKey, // пока не используем, но оставляем
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

  const [selectedCharacter] = useState<AICharacter>(defaultCharacter)

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

  const [currentVideoState, setCurrentVideoState] =
    useState<"idle" | "speaking">("idle")

  // --- refs ---

  const recognitionRef = useRef<any>(null)
  const isRecognitionActiveRef = useRef(false)

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const isAiSpeakingRef = useRef(false)

  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const idleVideoRef = useRef<HTMLVideoElement | null>(null)
  const speakingVideoRef = useRef<HTMLVideoElement | null>(null)

  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const isProcessingRef = useRef(false)
  const lastProcessedTextRef = useRef("")

  const suppressRecognitionRef = useRef(false)

  const voiceCacheRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map())
  const startSpeechRecognitionRef = useRef<() => void | null>(null)

  const [audioInitialized, setAudioInitialized] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)

  const hasEnhancedVideo =
    !!selectedCharacter?.idleVideo && !!selectedCharacter?.speakingVideo

  useEffect(() => {
    isCallActiveRef.current = isCallActive
  }, [isCallActive])

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
  }, [isMicMuted])

  // --- utils ---

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
        nativeVoicePreferences[langCode]?.[preferredGender] || []

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

      const langVoices = voices.filter((v) =>
        v.lang.toLowerCase().startsWith(langCode.toLowerCase()),
      )
      if (langVoices.length) {
        const best = langVoices[0]
        voiceCacheRef.current.set(cacheKey, best)
        return best
      }

      if (langCode !== "en") {
        const en = getRefinedVoiceForLanguage("en-US", preferredGender)
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

  const fallbackToBrowserTTS = useCallback(
    (
      cleanText: string,
      gender: "male" | "female",
      cleanup: () => void,
    ): void => {
      if (!window.speechSynthesis) {
        cleanup()
        return
      }

      try {
        window.speechSynthesis.cancel()
      } catch {}

      setTimeout(() => {
        try {
          setCurrentVideoState("speaking")

          if (hasEnhancedVideo) {
            if (idleVideoRef.current) idleVideoRef.current.pause()
            if (speakingVideoRef.current && selectedCharacter?.speakingVideo) {
              speakingVideoRef.current.currentTime = 0
              speakingVideoRef.current.play().catch(() => {})
            }
          }

          const utterance = new SpeechSynthesisUtterance()
          utterance.text = cleanText
          utterance.lang = currentLocale

          const selectedVoice = getRefinedVoiceForLanguage(
            currentLocale,
            gender,
          )
          if (selectedVoice) utterance.voice = selectedVoice

          const speechParameters = getNativeSpeechParameters(
            activeLanguage.code,
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
      activeLanguage.code,
      currentLocale,
      getRefinedVoiceForLanguage,
      hasEnhancedVideo,
      selectedCharacter,
    ],
  )

  // --- speech recognition ---

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null

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
      // ключевой фикс: если ассистент говорит – просто игнорируем
      if (isAiSpeakingRef.current) return

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

      // отсечка по тишине – через 1.5 сек отправляем
      silenceTimeout = setTimeout(() => {
        const buf = finalTranscriptBuffer.trim()
        if (
          buf.length > 2 &&
          !isProcessingRef.current &&
          !isAiSpeakingRef.current
        ) {
          finalTranscriptBuffer = ""
          setInterimTranscript("")

          const textToProcess = buf
          if (textToProcess === lastProcessedTextRef.current) return

          lastProcessedTextRef.current = textToProcess

          setMessages((prev) => [
            ...prev,
            { id: prev.length + 1, role: "user", text: textToProcess },
          ])

          void processTranscriptionRef.current?.(textToProcess)
        }
      }, 1500)

      if (hasNewFinalResult) {
        const buf = finalTranscriptBuffer.trim()
        if (
          buf.length > 2 &&
          !isProcessingRef.current &&
          !isAiSpeakingRef.current
        ) {
          finalTranscriptBuffer = ""
          setInterimTranscript("")

          const textToProcess = buf
          if (textToProcess === lastProcessedTextRef.current) return

          lastProcessedTextRef.current = textToProcess

          setMessages((prev) => [
            ...prev,
            { id: prev.length + 1, role: "user", text: textToProcess },
          ])

          void processTranscriptionRef.current?.(textToProcess)
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
          } catch {}
        }, 1000)
        return
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
              } catch {}
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
          } catch {}
        },
        start: () => {
          try {
            recognitionInstance.start()
          } catch {}
        },
      }
      startSpeechRecognitionRef.current = recognitionRef.current.start
    } catch (error) {
      console.log("Error starting recognition:", error)
    }
  }, [currentLocale])

  useEffect(() => {
    startSpeechRecognitionRef.current = startSpeechRecognition
  }, [startSpeechRecognition])

  // --- TTS ---

  const speakText = useCallback(
    async (text: string) => {
      if (!isCallActiveRef.current) return
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

      if (currentAudioRef.current) {
        try {
          currentAudioRef.current.pause()
          currentAudioRef.current.currentTime = 0
        } catch {}
        currentAudioRef.current = null
      }
      if (window.speechSynthesis?.speaking) {
        try {
          window.speechSynthesis.cancel()
        } catch {}
      }
      currentUtteranceRef.current = null

      const cleanedText = cleanResponseText(text)
      if (!cleanedText) {
        suppressRecognitionRef.current = false
        if (!isMicMutedRef.current && isCallActiveRef.current) {
          startSpeechRecognitionRef.current?.()
        }
        return
      }

      isAiSpeakingRef.current = true
      setIsAiSpeaking(true)
      setActivityStatus("speaking")

      const characterGender = selectedCharacter?.gender || "female"

      const cleanup = () => {
        try {
          suppressRecognitionRef.current = false

          if (currentAudioRef.current) {
            currentAudioRef.current.pause()
            currentAudioRef.current.currentTime = 0
            currentAudioRef.current = null
          }
          currentUtteranceRef.current = null
          if (window.speechSynthesis) window.speechSynthesis.cancel()

          isAiSpeakingRef.current = false
          setIsAiSpeaking(false)

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

          if (!isMicMutedRef.current && isCallActiveRef.current) {
            setActivityStatus("listening")
            startSpeechRecognitionRef.current?.()
          }
        } catch (e) {
          console.error("Cleanup error:", e)
        }
      }

      try {
        if (shouldUseGoogleTTS(activeLanguage.code)) {
          try {
            const audioDataUrl = await generateGoogleTTS(
              cleanedText,
              currentLocale, // ВАЖНО: передаём локаль (uk-UA/ru-RU), а не просто "uk"/"ru"
              characterGender,
              VIDEO_CALL_GOOGLE_TTS_CREDENTIALS,
              VIDEO_CALL_VOICE_CONFIGS,
            )

            if (!audioDataUrl) throw new Error("No audio from Google TTS")

            setCurrentVideoState("speaking")

            if (hasEnhancedVideo) {
              if (idleVideoRef.current) idleVideoRef.current.pause()
              if (speakingVideoRef.current && selectedCharacter?.speakingVideo) {
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

            audio.onended = cleanup
            audio.onerror = cleanup

            audio.src = audioDataUrl
            audio.load()
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
      isSoundEnabled,
      cleanResponseText,
      activeLanguage.code,
      currentLocale,
      selectedCharacter,
      hasEnhancedVideo,
      fallbackToBrowserTTS,
    ],
  )

  // заранее поднимаем голоса
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return

    const loadVoices = () => {
      const voices = window.speechSynthesis!.getVoices()
      if (voices.length) {
        getRefinedVoiceForLanguage(currentLocale, "female")
        getRefinedVoiceForLanguage(currentLocale, "male")
      }
    }

    loadVoices()
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices)
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices)
    }
  }, [currentLocale, getRefinedVoiceForLanguage])

  // --- запрос к n8n / API ---

  const processTranscription = useCallback(
    async (text: string) => {
      if (!isCallActiveRef.current) return
      if (!text.trim()) return
      if (isProcessingRef.current) return

      if (!VIDEO_ASSISTANT_WEBHOOK_URL) {
        const errorMessage = t(
          "The video assistant is temporarily unavailable. Please contact support.",
        )
        setMessages((prev) => [
          ...prev,
          { id: prev.length + 1, role: "assistant", text: errorMessage },
        ])
        return
      }

      if (isAiSpeakingRef.current) return

      isProcessingRef.current = true
      setActivityStatus("thinking")

      try {
        const langForBackend =
          activeLanguage.code?.startsWith("uk") ||
          activeLanguage.code?.startsWith("ru") ||
          activeLanguage.code?.startsWith("en")
            ? activeLanguage.code
            : activeLanguage.code || "uk"

        const res = await fetch(VIDEO_ASSISTANT_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            language: langForBackend,
            email: user?.email || "guest@example.com",
            mode: "video",
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
          // строка
        }

        let aiResponseText = extractAnswer(data)
        const cleanedResponse = cleanResponseText(aiResponseText)

        if (!cleanedResponse) {
          throw new Error("Empty response received")
        }

        lastProcessedTextRef.current = text

        setMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            role: "assistant",
            text: cleanedResponse,
          },
        ])

        setActivityStatus("listening")
        void speakText(cleanedResponse)
      } catch (error: any) {
        console.error("Processing error:", error)

        if (!isCallActiveRef.current) return

        let errorMessage = ""
        if (error.name === "AbortError") {
          errorMessage = t("Connection timeout. Please try again.")
        } else if (error.message === "Empty response received") {
          errorMessage = t(
            "I received your message but couldn't generate a response. Could you try rephrasing?",
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

        if (onError && error instanceof Error) onError(error)
      } finally {
        isProcessingRef.current = false
        if (isCallActiveRef.current) {
          setActivityStatus("listening")
        }
      }
    },
    [activeLanguage.code, cleanResponseText, speakText, t, user?.email, onError],
  )

  const processTranscriptionRef = useRef<
    ((text: string) => Promise<void>) | null
  >(null)

  useEffect(() => {
    processTranscriptionRef.current = processTranscription
  }, [processTranscription])

  // --- камера ---

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

  const toggleSound = useCallback(() => {
    setIsSoundEnabled((prev) => {
      const next = !prev
      if (!next && isAiSpeakingRef.current) {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause()
          currentAudioRef.current = null
        }
        if (window.speechSynthesis) window.speechSynthesis.cancel()
      }
      return next
    })
  }, [])

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

  // --- инициализация аудио для мобилок ---

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
      } catch {}

      setAudioInitialized(true)
    } catch (error) {
      console.error("Audio initialization error:", error)
    }
  }, [audioInitialized])

  // --- управление звонком ---

  const startCall = useCallback(async () => {
    setIsConnecting(true)
    setSpeechError(null)

    try {
      await initializeMobileAudio()

      setIsCallActive(true)
      isCallActiveRef.current = true

      setCurrentVideoState("idle")
      setIsMicMuted(false)
      setIsListening(true)
      setActivityStatus("listening")
      setMessages([])
      setInterimTranscript("")
      lastProcessedTextRef.current = ""
      isAiSpeakingRef.current = false
      setIsAiSpeaking(false)

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
  }, [initializeMobileAudio, hasEnhancedVideo, selectedCharacter, t])

  const endCall = useCallback(() => {
    setIsCallActive(false)
    isCallActiveRef.current = false

    setIsListening(false)
    setCurrentVideoState("idle")
    setActivityStatus("listening")
    setIsMicMuted(true)
    isProcessingRef.current = false
    suppressRecognitionRef.current = false
    isAiSpeakingRef.current = false
    setIsAiSpeaking(false)

    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause()
      } catch {}
      currentAudioRef.current = null
    }

    currentUtteranceRef.current = null
    if (window.speechSynthesis) window.speechSynthesis.cancel()

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
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
        } catch {}
      })
      userVideoRef.current.srcObject = null
    }

    setInterimTranscript("")
    setMessages([])
    setSpeechError(null)
  }, [])

  useEffect(() => {
    if (!isOpen && isCallActive) {
      endCall()
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {}
      }
      if (currentAudioRef.current) {
        try {
          currentAudioRef.current.pause()
        } catch {}
        currentAudioRef.current = null
      }
      currentUtteranceRef.current = null
      if (window.speechSynthesis) window.speechSynthesis.cancel()

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
    if (isAiSpeaking) return t("Assistant is speaking. Please wait a moment.")
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

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col touch-pan-y">
          {!isCallActive ? (
            // Экран до начала звонка
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

              <div className="w-full max-w-md px-2">
                <div className="relative bg-white rounded-lg shadow-md p-4 sm:p-6 border-2 border-primary-600">
                  <div className="relative w-full aspect-square mb-3 sm:mb-4 overflow-hidden rounded-lg">
                    <Image
                      src={selectedCharacter.avatar || "/placeholder.svg"}
                      alt={selectedCharacter.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      priority
                    />
                  </div>
                  <h4 className="font-semibold text-base sm:text-lg text-center mb-1 sm:mb-2">
                    {selectedCharacter.name}
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-600 text-center mb-3 sm:mb-4">
                    {selectedCharacter.description}
                  </p>
                  <div className="text-center text-xs text-primary-700 font-medium">
                    {t("Selected")}
                  </div>
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
            // Экран во время звонка
            <div className="flex-1 flex flex-col">
              {/* Видео-плеер */}
              <div className="relative w-full aspect-video sm:aspect-[16/10] bg-black rounded-lg overflow-hidden mb-3 sm:mb-4">
                <div className="absolute inset-0">
                  {hasEnhancedVideo ? (
                    <>
                      {selectedCharacter?.idleVideo && (
                        <video
                          ref={idleVideoRef}
                          className={`absolute inset-0 w-full h-full object-cover scale-[1.06] ${
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

                      {selectedCharacter?.speakingVideo && (
                        <video
                          ref={speakingVideoRef}
                          className={`absolute inset-0 w-full h-full object-cover scale-[1.06] ${
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
                            src={selectedCharacter.speakingVideo}
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
                              src={
                                selectedCharacter.avatar || "/placeholder.svg"
                              }
                              alt={selectedCharacter.name}
                              fill
                              className="object-cover rounded-full scale-[1.02]"
                              sizes="256px"
                            />
                          </div>
                        </div>
                      )}

                      {selectedCharacter?.speakingVideo && (
                        <video
                          ref={speakingVideoRef}
                          className={`absolute inset-0 w-full h-full object-cover scale-[1.02] ${
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
                    : shouldUseGoogleTTS(activeLanguage.code)
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

              {/* Чат */}
              <div className="flex-1 flex flex-col space-y-3 sm:space-y-4 overflow-y-auto touch-pan-y">
                <div className="space-y-3 sm:space-y-4">
                  {messages.length === 0 && (
                    <div className="bg-primary-50 rounded-2xl p-3 sm:4 text-xs sm:text-sm text-slate-800">
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
                    <div className="bg-rose-50 rounded-lg p-3 text-xs sm:text-sm text-rose-700 break-words">
                      {speechError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* БОТТОМ-ПАНЕЛЬ */}
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
