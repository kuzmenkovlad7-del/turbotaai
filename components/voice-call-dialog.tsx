"use client"

import { useState, useRef, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Phone,
  Wifi,
  WifiOff,
  Brain,
  Mic,
  MicOff,
  Loader2,
  Sparkles,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { APP_NAME } from "@/lib/app-config"

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
}

type InputMode = "sr" | "recorder"

const TURBOTA_AGENT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL || ""

const FALLBACK_CHAT_API = "/api/chat"

function extractAnswer(data: any): string {
  if (!data) return ""

  if (typeof data === "string") {
    return data.trim()
  }

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] ?? {}
    return (
      first.response ||
      first.text ||
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
      data.response ||
      data.text ||
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

function isProbablyMobile(): boolean {
  if (typeof navigator === "undefined") return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "")
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
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected"
  >("disconnected")
  const [debugInfo, setDebugInfo] = useState<string>(
    "ready; no events yet (debug log enabled временно)",
  )

  const voiceGenderRef = useRef<"female" | "male">("female")

  const recognitionRef = useRef<any | null>(null)
  const isRecognitionActiveRef = useRef(false)

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const isAiSpeakingRef = useRef(false)

  const inputModeRef = useRef<InputMode>("sr")

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recorderChunksRef = useRef<BlobPart[]>([])
  const recorderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSttBusyRef = useRef(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)

  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  const appendDebug = (line: string) => {
    setDebugInfo((prev) =>
      prev ? `${prev}\n${new Date().toISOString()} ${line}` : `${new Date().toISOString()} ${line}`,
    )
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  function computeLangCode(): string {
    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    if (lang.startsWith("uk")) return "uk-UA"
    if (lang.startsWith("ru")) return "ru-RU"
    return "en-US"
  }

  function getCurrentGender(): "MALE" | "FEMALE" {
    const g = voiceGenderRef.current || "female"
    return g === "male" ? "MALE" : "FEMALE"
  }

  async function requestMicrophoneAccess(): Promise<boolean> {
    if (typeof navigator === "undefined") {
      setNetworkError(
        t(
          "Voice input is not supported in your browser. Please try using Chrome.",
        ),
      )
      appendDebug("[getUserMedia] navigator is undefined")
      return false
    }

    const hasMediaDevices =
      typeof navigator.mediaDevices !== "undefined" &&
      typeof navigator.mediaDevices.getUserMedia === "function"

    if (!hasMediaDevices) {
      setNetworkError(
        t(
          "Voice input is not supported in your browser. Please try using Chrome.",
        ),
      )
      appendDebug("[getUserMedia] mediaDevices/getUserMedia not supported")
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })

      micStreamRef.current = stream
      setNetworkError(null)
      appendDebug("[getUserMedia] access granted")
      return true
    } catch (error: any) {
      console.error("[Voice] getUserMedia error:", error)
      appendDebug(`[getUserMedia] error name=${error?.name} message=${error?.message}`)

      const name = error?.name

      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(
          t(
            "Microphone access denied. Please allow microphone access and try again.",
          ),
        )
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setNetworkError(
          t("Could not access your microphone. Please check your permissions."),
        )
      } else {
        setNetworkError(
          t("Failed to start speech recognition. Trying alternative method..."),
        )
      }

      return false
    }
  }

  function ensureRecognitionRunning() {
    if (typeof window === "undefined") return
    if (inputModeRef.current !== "sr") return

    const shouldListen =
      isCallActiveRef.current &&
      !isMicMutedRef.current &&
      !isAiSpeakingRef.current

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!shouldListen) {
      if (recognitionRef.current && isRecognitionActiveRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          console.error(e)
        }
      }
      isRecognitionActiveRef.current = false
      setIsListening(false)
      return
    }

    if (!SR) {
      appendDebug("[SR] SpeechRecognition not supported; switching to recorder mode")
      inputModeRef.current = "recorder"
      startRecorderMode()
      return
    }

    let recognition = recognitionRef.current

    if (!recognition) {
      recognition = new SR()
      recognition.continuous = true
      recognition.interimResults = false
      recognitionRef.current = recognition

      recognition.onstart = () => {
        isRecognitionActiveRef.current = true
        setIsListening(true)
        setConnectionStatus("connected")
        setNetworkError(null)
        appendDebug(
          `[SR.onstart] lang=${recognition.lang} ua=${
            typeof navigator !== "undefined" ? navigator.userAgent : ""
          } href=${typeof window !== "undefined" ? window.location.href : ""}`,
        )
      }

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event)
        appendDebug(
          `[SR.onerror] error=${event?.error} message=${event?.message || ""}`,
        )

        if (event?.error === "not-allowed") {
          setNetworkError(
            t(
              "Microphone access denied. Please allow microphone access and try again.",
            ),
          )
          setConnectionStatus("disconnected")
          inputModeRef.current = "recorder"
          hardStopRecognition()
          startRecorderMode()
          return
        }

        if (event?.error === "service-not-allowed") {
          setNetworkError(
            t(
              "Network error occurred. Attempting to reconnect...",
            ),
          )
          setConnectionStatus("disconnected")
          inputModeRef.current = "recorder"
          hardStopRecognition()
          startRecorderMode()
          return
        }

        if (event?.error !== "no-speech") {
          setNetworkError(
            t("Network error occurred. Attempting to reconnect..."),
          )
        }
      }

      recognition.onend = () => {
        isRecognitionActiveRef.current = false
        setIsListening(false)

        if (inputModeRef.current !== "sr") return

        setTimeout(() => {
          const stillShouldListen =
            isCallActiveRef.current &&
            !isMicMutedRef.current &&
            !isAiSpeakingRef.current

          if (stillShouldListen) {
            appendDebug("[SR.onend] restarting SR")
            ensureRecognitionRunning()
          }
        }, 300)
      }

      recognition.onresult = (event: any) => {
        if (isAiSpeakingRef.current) return

        const last = event.results[event.results.length - 1]
        if (!last || !last.isFinal) return

        const text = last[0]?.transcript?.trim()
        if (!text) return

        const userMsg: VoiceMessage = {
          id: `${Date.now()}-user`,
          role: "user",
          text,
        }

        setMessages((prev) => [...prev, userMsg])
        void handleUserText(text)
      }
    }

    recognition.lang = computeLangCode()

    if (!isRecognitionActiveRef.current) {
      try {
        recognition.start()
      } catch (e: any) {
        appendDebug(`[SR.start] error name=${e?.name} message=${e?.message}`)
        if (e?.name === "NotAllowedError") {
          setNetworkError(
            t(
              "Microphone access denied. Please allow microphone access and try again.",
            ),
          )
          setConnectionStatus("disconnected")
          inputModeRef.current = "recorder"
          hardStopRecognition()
          startRecorderMode()
        } else if (e?.name !== "InvalidStateError") {
          setNetworkError(
            t("Failed to start speech recognition. Trying alternative method..."),
          )
        }
      }
    }
  }

  function hardStopRecognition() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null
        recognitionRef.current.stop()
      } catch (e) {
        console.error(e)
      }
    }
    isRecognitionActiveRef.current = false
    setIsListening(false)
  }

  function cleanupRecorder() {
    if (recorderTimeoutRef.current) {
      clearTimeout(recorderTimeoutRef.current)
      recorderTimeoutRef.current = null
    }
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop()
        }
      } catch (e) {
        console.error("[Recorder] stop error", e)
      }
      mediaRecorderRef.current = null
    }
    recorderChunksRef.current = []
    isSttBusyRef.current = false
  }

  function setupMediaRecorder() {
    if (mediaRecorderRef.current) return
    const stream = micStreamRef.current
    if (!stream) {
      appendDebug("[Recorder] no mic stream")
      return
    }

    try {
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" })
      mr.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recorderChunksRef.current.push(event.data)
        }
      }
      mr.onstop = async () => {
        const parts = recorderChunksRef.current
        recorderChunksRef.current = []
        if (!parts.length) {
          scheduleRecorderChunk()
          return
        }
        const blob = new Blob(parts, { type: "audio/webm" })
        await sendChunkToStt(blob)
        scheduleRecorderChunk()
      }
      mediaRecorderRef.current = mr
      appendDebug("[Recorder] MediaRecorder created")
    } catch (e) {
      console.error("[Recorder] cannot create MediaRecorder", e)
      appendDebug(`[Recorder] create error: ${String(e)}`)
      setNetworkError(
        t(
          "Voice input is not supported in your browser. Please try using Chrome.",
        ),
      )
    }
  }

  function scheduleRecorderChunk() {
    if (!isCallActiveRef.current || isMicMutedRef.current) return
    if (isSttBusyRef.current) {
      recorderTimeoutRef.current = setTimeout(scheduleRecorderChunk, 250)
      return
    }
    const mr = mediaRecorderRef.current
    if (!mr) return

    try {
      mr.start()
      setIsListening(true)
      recorderTimeoutRef.current = setTimeout(() => {
        try {
          if (mr.state === "recording") {
            mr.stop()
            setIsListening(false)
          }
        } catch (e) {
          console.error("[Recorder] stop error", e)
          appendDebug(`[Recorder] stop error: ${String(e)}`)
        }
      }, 3000)
    } catch (e) {
      console.error("[Recorder] start error", e)
      appendDebug(`[Recorder] start error: ${String(e)}`)
    }
  }

  async function sendChunkToStt(blob: Blob) {
    if (!blob || blob.size === 0) return
    if (!isCallActiveRef.current || isMicMutedRef.current) return

    isSttBusyRef.current = true

    try {
      const fd = new FormData()
      fd.append("file", blob, "audio.webm")
      fd.append("language", computeLangCode())

      appendDebug("[STT] sending chunk to /api/stt")

      const res = await fetch("/api/stt", {
        method: "POST",
        body: fd,
      })

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {
        // not JSON
      }

      appendDebug(
        `[STT] response status=${res.status} ok=${res.ok} raw=${raw.slice(
          0,
          400,
        )}`,
      )

      if (!res.ok || !data || data.success === false) {
        console.error("[STT] error:", data?.error || raw)
        setNetworkError(
          t("Network error occurred. Attempting to reconnect..."),
        )
        return
      }

      const text: string =
        (data.text ||
          data.transcript ||
          data.result ||
          data.output ||
          data.message ||
          "")?.toString()?.trim() || ""

      if (!text) {
        appendDebug("[STT] empty transcript")
        return
      }

      appendDebug(`[STT] transcript: ${text}`)

      const userMsg: VoiceMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text,
      }
      setMessages((prev) => [...prev, userMsg])
      await handleUserText(text)
    } catch (e: any) {
      console.error("[STT] fetch error:", e)
      appendDebug(
        `[STT] fetch error name=${e?.name} message=${e?.message || String(
          e,
        )}`,
      )
      setNetworkError(
        t("Network error occurred. Attempting to reconnect..."),
      )
    } finally {
      isSttBusyRef.current = false
    }
  }

  function startRecorderMode() {
    inputModeRef.current = "recorder"
    setupMediaRecorder()
    scheduleRecorderChunk()
    appendDebug(
      `Recorder mode enabled; ua=${
        typeof navigator !== "undefined" ? navigator.userAgent : ""
      } href=${typeof window !== "undefined" ? window.location.href : ""}`,
    )
  }

  function stopEverything() {
    isCallActiveRef.current = false
    isMicMutedRef.current = false
    isAiSpeakingRef.current = false

    setIsCallActive(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setIsListening(false)
    setConnectionStatus("disconnected")
    setNetworkError(null)
    setMessages([])

    hardStopRecognition()
    cleanupRecorder()

    if (typeof window !== "undefined" && (window as any).speechSynthesis) {
      ;(window as any).speechSynthesis.cancel()
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch (e) {
          console.error("Error stopping mic track", e)
        }
      })
      micStreamRef.current = null
    }
  }

  useEffect(() => {
    if (!isOpen) {
      stopEverything()
    }
  }, [isOpen])

  useEffect(() => {
    return () => {
      stopEverything()
    }
  }, [])

  function speakText(text: string) {
    if (typeof window === "undefined") return

    const cleanText = text?.trim()
    if (!cleanText) return

    const langCode = computeLangCode()
    const gender = getCurrentGender()

    appendDebug(
      `[TTS] speakText lang=${langCode} gender=${gender} sample=${cleanText.slice(
        0,
        80,
      )}`,
    )

    const startSpeaking = () => {
      setIsAiSpeaking(true)
      isAiSpeakingRef.current = true
      ensureRecognitionRunning()
    }

    const stopSpeaking = () => {
      setIsAiSpeaking(false)
      isAiSpeakingRef.current = false
      ensureRecognitionRunning()
    }

    ;(async () => {
      try {
        const payload = {
          text: cleanText,
          language: langCode,
          gender,
        }

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        const raw = await res.text()
        let data: any = null

        try {
          data = raw ? JSON.parse(raw) : null
        } catch (e) {
          console.error("[TTS] non-JSON response:", raw)
        }

        appendDebug(
          `[TTS] response status=${res.status} ok=${res.ok} body=${raw.slice(
            0,
            400,
          )}`,
        )

        if (!res.ok || !data || data.success === false) {
          console.error(
            "[TTS] API error",
            data?.error || res.statusText,
            data?.details || "",
          )
          stopSpeaking()
          return
        }

        let audioUrl: string | undefined = data.audioUrl

        if (!audioUrl && data.audioContent) {
          audioUrl = `data:audio/mp3;base64,${data.audioContent}`
        }

        if (!audioUrl) {
          console.error("[TTS] No audioUrl/audioContent in response")
          stopSpeaking()
          return
        }

        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }

        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onplay = () => {
          startSpeaking()
        }

        audio.onended = () => {
          stopSpeaking()
          audioRef.current = null
        }

        audio.onerror = (e) => {
          console.error("[TTS] audio playback error:", e)
          appendDebug(`[TTS] audio error: ${String(e)}`)
          stopSpeaking()
          audioRef.current = null
        }

        try {
          await audio.play()
        } catch (e) {
          console.error("[TTS] play() rejected", e)
          appendDebug(`[TTS] play rejected: ${String(e)}`)
          stopSpeaking()
        }
      } catch (error) {
        console.error("[TTS] fetch error:", error)
        appendDebug(`[TTS] fetch error: ${String(error)}`)
        stopSpeaking()
      }
    })()
  }

  async function handleUserText(text: string) {
    const langCode =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    const resolvedWebhook =
      (webhookUrl && webhookUrl.trim()) ||
      TURBOTA_AGENT_WEBHOOK_URL.trim() ||
      FALLBACK_CHAT_API

    try {
      appendDebug(
        `[CHAT] sending to ${resolvedWebhook} lang=${langCode} gender=${voiceGenderRef.current}`,
      )

      const res = await fetch(resolvedWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          language: langCode,
          email: effectiveEmail,
          mode: "voice",
          gender: voiceGenderRef.current,
          voiceLanguage: computeLangCode(),
        }),
      })

      const raw = await res.text()
      let data: any = raw

      try {
        data = JSON.parse(raw)
      } catch {
        // not JSON
      }

      appendDebug(
        `[CHAT] response status=${res.status} ok=${res.ok} body=${raw.slice(
          0,
          400,
        )}`,
      )

      if (!res.ok) {
        throw new Error(`Chat API error: ${res.status} ${raw}`)
      }

      let answer = extractAnswer(data)

      if (!answer) {
        answer = t(
          "I received your message but couldn't generate a proper response.",
        )
      }

      const assistantMsg: VoiceMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: answer,
      }

      setMessages((prev) => [...prev, assistantMsg])
      speakText(answer)
    } catch (error: any) {
      console.error("Voice call error:", error)
      appendDebug(`[CHAT] error: ${error?.message || String(error)}`)
      setNetworkError(t("Processing error occurred"))
      if (onError && error instanceof Error) onError(error)
    }
  }

  const startCall = async (gender: "female" | "male") => {
    voiceGenderRef.current = gender

    setIsConnecting(true)
    setNetworkError(null)

    isMicMutedRef.current = false
    setIsMicMuted(false)

    appendDebug(`[CALL] startCall gender=${gender}`)

    const micOk = await requestMicrophoneAccess()
    if (!micOk) {
      setIsConnecting(false)
      setIsCallActive(false)
      isCallActiveRef.current = false
      setConnectionStatus("disconnected")
      appendDebug("[CALL] aborted because mic not ok")
      return
    }

    isCallActiveRef.current = true
    setIsCallActive(true)
    setIsConnecting(false)
    setConnectionStatus("connected")

    let useSr = false
    if (typeof window !== "undefined") {
      const SR =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition
      const mobile = isProbablyMobile()
      useSr = !!SR && !mobile
      appendDebug(`[CALL] ua=${navigator.userAgent} mobile=${mobile} SR=${!!SR}`)
    }

    if (useSr) {
      inputModeRef.current = "sr"
      ensureRecognitionRunning()
      appendDebug("[CALL] SR mode enabled")
    } else {
      startRecorderMode()
    }
  }

  const endCall = () => {
    appendDebug("[CALL] endCall")
    stopEverything()
  }

  const toggleMic = () => {
    const next = !isMicMuted
    setIsMicMuted(next)
    isMicMutedRef.current = next
    appendDebug(`[CALL] toggleMic -> ${next ? "muted" : "unmuted"}`)

    if (inputModeRef.current === "sr") {
      ensureRecognitionRunning()
    } else {
      if (!next) {
        scheduleRecorderChunk()
      } else {
        setIsListening(false)
      }
    }
  }

  const statusText = !isCallActive
    ? t(
        "In crisis situations, please contact local emergency services immediately.",
      )
    : isAiSpeaking
      ? t("AI is speaking ({{gender}}) in {{language}}...", {
          gender:
            voiceGenderRef.current === "female" ? t("Female") : t("Male"),
          language:
            (currentLanguage as any)?.name ||
            (typeof currentLanguage === "string"
              ? currentLanguage
              : "Ukrainian"),
        })
      : isMicMuted
        ? t("Microphone muted")
        : isListening
          ? t("Listening in {{language}}...", {
              language:
                (currentLanguage as any)?.name ||
                (typeof currentLanguage === "string"
                  ? currentLanguage
                  : "Ukrainian"),
            })
          : t("Ready to listen in {{language}}", {
              language:
                (currentLanguage as any)?.name ||
                (typeof currentLanguage === "string"
                  ? currentLanguage
                  : "Ukrainian"),
            })

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

              <div className="flex flex-col items-end gap-1">
                <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-indigo-50">
                  {APP_NAME} · {t("Assistant online")}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-indigo-100">
                  {connectionStatus === "connected" ? (
                    <>
                      <Wifi className="h-3 w-3 text-emerald-200" />{" "}
                      {t("Connected")}
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 text-rose-200" />{" "}
                      {t("Disconnected")}
                    </>
                  )}
                </div>
              </div>
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
                          <span className="ml-1 rounded-full bg-emerald-100 px-2 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                            {voiceGenderRef.current === "female"
                              ? t("Female voice")
                              : t("Male voice")}
                          </span>
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

                {/* DEBUG теперь ВСЕГДА виден (временное решение) */}
                <div className="rounded-2xl bg-slate-900 px-3 py-3 text-[11px] text-slate-100">
                  <div className="font-semibold mb-1">Debug:</div>
                  <div className="break-words whitespace-pre-wrap">
                    {debugInfo}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="border-t border-slate-100 px-5 py-3 flex flex-col gap-2">
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
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      type="button"
                      onClick={() => {
                        void startCall("female")
                      }}
                      disabled={isConnecting}
                      className={`h-10 rounded-full px-5 text-xs font-semibold shadow-sm flex items-center gap-2 ${
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
                      onClick={() => {
                        void startCall("male")
                      }}
                      disabled={isConnecting}
                      className={`h-10 rounded-full px-5 text-xs font-semibold shadow-sm flex items-center gap-2 ${
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
