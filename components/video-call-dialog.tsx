"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/photo_2025-10-31_22-27-18-BmxDH7DCv7e3p0y8HobTyoPkQw1COM.jpg",
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
  onError?: (error: Error) => void
}

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
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

function diffTranscript(prev: string, full: string): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,!?;:«»"“”‚‘’…]/g, "")
      .replace(/\s+/g, " ")
      .trim()

  full = full.trim()
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

function sttLangToUi(lang: any): "uk" | "ru" | "en" | null {
  const x = (lang || "").toString().toLowerCase()
  if (x.startsWith("uk")) return "uk"
  if (x.startsWith("ru")) return "ru"
  if (x.startsWith("en")) return "en"
  return null
}

function uiToLocale(code: string): string {
  const x = (code || "").toLowerCase()
  if (x.startsWith("uk")) return "uk-UA"
  if (x.startsWith("ru")) return "ru-RU"
  return "en-US"
}

function localeToUi(locale: string): "uk" | "ru" | "en" {
  const x = (locale || "").toLowerCase()
  if (x.startsWith("uk")) return "uk"
  if (x.startsWith("ru")) return "ru"
  return "en"
}

function guessRuUkByChars(text: string): "ru" | "uk" | null {
  // быстрый хак против путаницы ru/uk
  if (/[іїєґ]/i.test(text)) return "uk"
  if (/[ёыэъ]/i.test(text)) return "ru"
  return null
}

export default function VideoCallDialog({ isOpen, onClose, onError }: VideoCallDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const activeLanguage =
    (currentLanguage as any) || ({ code: "en", name: "English", flag: "🇺🇸" } as any)

  const languageDisplayName =
    (activeLanguage as any)?.name ||
    ((activeLanguage as any)?.code === "uk"
      ? "Ukrainian"
      : (activeLanguage as any)?.code === "ru"
      ? "Russian"
      : "English")

  const uiLang = useMemo<"uk" | "ru" | "en">(() => {
    const code = ((activeLanguage as any)?.code || "en").toString().toLowerCase()
    if (code.startsWith("uk")) return "uk"
    if (code.startsWith("ru")) return "ru"
    return "en"
  }, [activeLanguage])

  const uiLocale = useMemo(() => uiToLocale(uiLang), [uiLang])

  const [selectedCharacter, setSelectedCharacter] = useState<AICharacter>(
    AI_CHARACTERS[1] || AI_CHARACTERS[0],
  )

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)

  const [activityStatus, setActivityStatus] = useState<"listening" | "thinking" | "speaking">(
    "listening",
  )
  const [speechError, setSpeechError] = useState<string | null>(null)

  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [interimTranscript, setInterimTranscript] = useState("")

  const userVideoRef = useRef<HTMLVideoElement | null>(null)
  const idleVideoRef = useRef<HTMLVideoElement | null>(null)
  const speakingVideoRef = useRef<HTMLVideoElement | null>(null)

  // --- STT pipeline (как в voice-call) ---
  const rawAudioStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const sentIdxRef = useRef(0)
  const isSttBusyRef = useRef(false)
  const lastTranscriptRef = useRef("")

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)

  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const isAiSpeakingRef = useRef(false)

  const sessionLangRef = useRef<"uk" | "ru" | "en">(uiLang)

  const hasEnhancedVideo = !!selectedCharacter?.idleVideo && !!selectedCharacter?.speakingVideo

  const vad = useRef({
    noiseFloor: 0,
    rms: 0,
    thr: 0.008,
    voice: false,
    voiceUntilTs: 0,
    utteranceStartTs: 0,
    endedCount: 0,
  })

  useEffect(() => {
    isCallActiveRef.current = isCallActive
  }, [isCallActive])

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
  }, [isMicMuted])

  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking
  }, [isAiSpeaking])

  // camera PIP
  useEffect(() => {
    if (!isCallActive || isCameraOff || !userVideoRef.current) return

    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        if (userVideoRef.current) userVideoRef.current.srcObject = stream
      })
      .catch(() => setIsCameraOff(true))

    return () => {
      cancelled = true
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
    if (!isOpen && isCallActive) endCall()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  function stopRaf() {
    if (rafRef.current) {
      try {
        cancelAnimationFrame(rafRef.current)
      } catch {}
      rafRef.current = null
    }
  }

  function stopAudioGraph() {
    stopRaf()
    analyserRef.current = null
    const ctx = audioCtxRef.current
    if (ctx) {
      try {
        ctx.close()
      } catch {}
      audioCtxRef.current = null
    }
  }

  function stopRecorder() {
    const rec = mediaRecorderRef.current
    mediaRecorderRef.current = null
    if (rec) {
      try {
        if (rec.state !== "inactive") rec.stop()
      } catch {}
    }
  }

  function stopTtsAudio() {
    const a = ttsAudioRef.current
    if (a) {
      try {
        a.pause()
        a.currentTime = 0
      } catch {}
      ttsAudioRef.current = null
    }
  }

  function pickMimeType(): string | undefined {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/aac",
    ]
    for (const c of candidates) {
      try {
        if ((window as any).MediaRecorder?.isTypeSupported?.(c)) return c
      } catch {}
    }
    return undefined
  }

  async function requestMicrophoneAccess(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch {}
      })
      setSpeechError(null)
      return true
    } catch (e: any) {
      const name = e?.name
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setSpeechError(
          t("Microphone is blocked in the browser. Please allow access in the site permissions and reload the page."),
        )
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setSpeechError(t("No microphone was found on this device. Please check your hardware."))
      } else {
        setSpeechError(t("Could not start microphone. Check permissions and try again."))
      }
      return false
    }
  }

  function getCurrentGender(): "MALE" | "FEMALE" {
    return (selectedCharacter?.gender || "female") === "male" ? "MALE" : "FEMALE"
  }

  async function startAudioCapture() {
    // сброс
    audioChunksRef.current = []
    sentIdxRef.current = 0
    lastTranscriptRef.current = ""
    isSttBusyRef.current = false

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } as any,
    })
    rawAudioStreamRef.current = stream

    // audio graph for VAD
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as any
    const ctx: AudioContext = new Ctx()
    audioCtxRef.current = ctx
    try {
      await ctx.resume()
    } catch {}

    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.2
    src.connect(analyser)
    analyserRef.current = analyser

    // recorder
    const mimeType = pickMimeType()
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    mediaRecorderRef.current = rec

    rec.ondataavailable = (e: BlobEvent) => {
      if (!e.data || e.data.size === 0) return
      audioChunksRef.current.push(e.data)
    }

    // маленький timeslice чтобы чанки были мелкие
    rec.start(250)

    // VAD loop
    vad.current.noiseFloor = 0
    vad.current.rms = 0
    vad.current.thr = 0.008
    vad.current.voice = false
    vad.current.voiceUntilTs = 0
    vad.current.utteranceStartTs = 0
    vad.current.endedCount = 0

    const data = new Float32Array(analyser.fftSize)

    const tick = () => {
      const a = analyserRef.current
      if (!a) return
      const now = Date.now()

      a.getFloatTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
      const rms = Math.sqrt(sum / data.length)

      const v = vad.current
      v.rms = rms

      // обновляем noise floor только когда "тишина"
      if (!v.voice) {
        v.noiseFloor = v.noiseFloor === 0 ? rms : v.noiseFloor * 0.995 + rms * 0.005
        const base = Math.max(0.006, v.noiseFloor * 3.5)
        v.thr = Math.min(0.03, Math.max(0.008, base))
      }

      if (!isCallActiveRef.current || isMicMutedRef.current || isAiSpeakingRef.current) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      if (rms > v.thr) {
        if (!v.voice) {
          v.voice = true
          v.utteranceStartTs = now
        }
        v.voiceUntilTs = now + 450
      } else {
        if (v.voice && now > v.voiceUntilTs) {
          v.voice = false
          v.endedCount++
          void maybeSendStt("vad_end")
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  function stopAudioCapture() {
    stopRecorder()
    stopAudioGraph()

    const s = rawAudioStreamRef.current
    rawAudioStreamRef.current = null
    if (s) {
      s.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch {}
      })
    }

    audioChunksRef.current = []
    sentIdxRef.current = 0
    lastTranscriptRef.current = ""
    isSttBusyRef.current = false
  }

  async function maybeSendStt(reason: string) {
    if (!isCallActiveRef.current) return
    if (isAiSpeakingRef.current) return
    if (isMicMutedRef.current) return

    const chunks = audioChunksRef.current
    if (!chunks.length) return

    const sentIdx = sentIdxRef.current
    const take: Blob[] = []

    if (chunks.length >= 1) {
      take.push(chunks[0])
      for (let i = Math.max(1, sentIdx); i < chunks.length; i++) take.push(chunks[i])
    }

    const blob = new Blob(take, { type: take[0]?.type || "audio/webm" })
    if (blob.size < 6000) return
    if (isSttBusyRef.current) return

    try {
      isSttBusyRef.current = true
      setInterimTranscript("")

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
          // ВАЖНО: не фиксируем язык UI-шным, даём серверу авто-детект
          "X-STT-Lang": "auto",
          "X-STT-UI": uiLocale,
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
        console.error("[Video STT] bad response", res.status, raw)
        return
      }

      // двигаем sentIdx только при success
      sentIdxRef.current = chunks.length

      const fullText = (data.text || "").toString().trim()
      if (!fullText) return

      const prev = lastTranscriptRef.current
      const delta = diffTranscript(prev, fullText)
      lastTranscriptRef.current = fullText
      if (!delta) return

      // язык: серверный + быстрый фикс по буквам
      const serverLang = sttLangToUi((data as any)?.lang)
      const charGuess = guessRuUkByChars(delta)
      const finalLang = charGuess || serverLang || sessionLangRef.current

      sessionLangRef.current = finalLang

      const userMsg: ChatMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text: delta,
      }
      setMessages((p) => [...p, userMsg])
      setActivityStatus("thinking")

      await sendToAssistant(delta, finalLang)
    } catch (e: any) {
      console.error("[Video STT] fatal", e)
    } finally {
      isSttBusyRef.current = false
    }
  }

  async function speakText(text: string, lang: "uk" | "ru" | "en") {
    if (!isCallActiveRef.current) return
    if (!isSoundEnabled) return

    const cleaned = cleanResponseText(text)
    if (!cleaned) return

    stopTtsAudio()

    const rec = mediaRecorderRef.current
    const begin = () => {
      setIsAiSpeaking(true)
      setActivityStatus("speaking")
      if (rec && rec.state === "recording") {
        try {
          rec.pause()
        } catch {}
      }
    }

    const finish = () => {
      setIsAiSpeaking(false)
      if (rec && rec.state === "paused" && isCallActiveRef.current && !isMicMutedRef.current) {
        try {
          rec.resume()
        } catch {}
      }
      if (isCallActiveRef.current && !isMicMutedRef.current) setActivityStatus("listening")
    }

    begin()

    // speaking video
    if (hasEnhancedVideo && speakingVideoRef.current && selectedCharacter.speakingVideo) {
      try {
        speakingVideoRef.current.currentTime = 0
        await speakingVideoRef.current.play()
      } catch {}
    }

    const locale = uiToLocale(lang)
    const gender = getCurrentGender()

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleaned, language: locale, gender }),
      })

      if (!res.ok) {
        const raw = await res.text().catch(() => "")
        console.error("[Video TTS] bad response", res.status, raw)
        return
      }

      const ct = (res.headers.get("content-type") || "").toLowerCase()

      let audioUrl = ""
      if (ct.startsWith("audio/")) {
        const b = await res.blob()
        audioUrl = URL.createObjectURL(b)
      } else {
        const raw = await res.text()
        let j: any = null
        try {
          j = raw ? JSON.parse(raw) : null
        } catch {
          j = null
        }
        audioUrl =
          (j?.audioUrl || j?.url || j?.audio || j?.dataUrl || j?.audio_data_url || "")?.toString() ||
          ""
        if (audioUrl && !audioUrl.startsWith("data:") && !audioUrl.startsWith("http")) {
          // если вернули base64 без префикса
          audioUrl = `data:audio/mpeg;base64,${audioUrl}`
        }
      }

      if (!audioUrl) return

      await new Promise<void>((resolve) => {
        const a = new Audio()
        ttsAudioRef.current = a
        a.preload = "auto"
        a.setAttribute("playsinline","true")
        a.setAttribute("webkit-playsinline","true")
        a.crossOrigin = "anonymous"
        a.src = audioUrl
        a.onended = () => resolve()
        a.onerror = () => resolve()
        a.play().catch(() => resolve())
      })
    } finally {
      // stop speaking video -> back idle
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
      finish()
    }
  }

  async function sendToAssistant(text: string, lang: "uk" | "ru" | "en") {
    const trimmed = text.trim()
    if (!trimmed) return
    if (!isCallActiveRef.current) return

    setActivityStatus("thinking")
    setSpeechError(null)

    try {
      if (!VIDEO_ASSISTANT_WEBHOOK_URL) throw new Error("VIDEO_ASSISTANT_WEBHOOK_URL is not configured")

      const res = await fetch(VIDEO_ASSISTANT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          language: lang, // ВАЖНО: именно ru/uk/en, не язык сайта
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

      const aiMsg: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: cleaned,
      }
      setMessages((p) => [...p, aiMsg])

      await speakText(cleaned, lang)
    } catch (e: any) {
      console.error("[Video] assistant error", e)

      const msg =
        e?.name === "AbortError"
          ? t("Connection timeout. Please try again.")
          : e?.message === "Empty response received"
          ? t("I received your message but couldn't generate a response. Could you try rephrasing?")
          : e?.message === "VIDEO_ASSISTANT_WEBHOOK_URL is not configured"
          ? t("The video assistant is temporarily unavailable. Please contact support.")
          : t("I couldn't process your message. Could you try again?")

      setMessages((p) => [...p, { id: `${Date.now()}-err`, role: "assistant", text: msg }])
      if (onError && e instanceof Error) onError(e)
    } finally {
      if (isCallActiveRef.current && !isMicMutedRef.current) setActivityStatus("listening")
      else setActivityStatus("listening")
    }
  }

  async function startCall() {
    setIsConnecting(true)
    setSpeechError(null)

    try {
      const micOk = await requestMicrophoneAccess()
      if (!micOk) return

      setIsCallActive(true)
      isCallActiveRef.current = true

      setMessages([])
      setInterimTranscript("")
      setIsMicMuted(false)
      isMicMutedRef.current = false
      setActivityStatus("listening")

      sessionLangRef.current = uiLang

      // start idle video
      if (hasEnhancedVideo && idleVideoRef.current && selectedCharacter.idleVideo) {
        try {
          idleVideoRef.current.play().catch(() => {})
        } catch {}
      }

      await startAudioCapture()
    } catch (e: any) {
      console.error("[Video] startCall failed:", e)
      setSpeechError(e?.message || t("Failed to start the call. Please check your microphone and camera permissions."))
      setIsCallActive(false)
      isCallActiveRef.current = false
    } finally {
      setIsConnecting(false)
    }
  }

  function endCall() {
    setIsCallActive(false)
    isCallActiveRef.current = false

    stopTtsAudio()
    stopAudioCapture()

    setIsAiSpeaking(false)
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
  }

  function toggleMicrophone() {
    if (!isCallActiveRef.current) return

    const rec = mediaRecorderRef.current

    if (isMicMuted) {
      setIsMicMuted(false)
      isMicMutedRef.current = false
      setActivityStatus("listening")
      try {
        if (rec && rec.state === "paused") rec.resume()
      } catch {}
    } else {
      setIsMicMuted(true)
      isMicMutedRef.current = true
      setInterimTranscript("")
      setActivityStatus("listening")
      try {
        if (rec && rec.state === "recording") rec.pause()
      } catch {}
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
      stopTtsAudio()
      setIsAiSpeaking(false)
      setActivityStatus("listening")
    }
  }

  if (!isOpen) return null

  const micOn = isCallActive && !isMicMuted

  const statusText = (() => {
    if (!isCallActive) return t("Choose an AI psychologist and press “Start video call” to begin.")
    if (isAiSpeaking) return t("Assistant is speaking. Please wait a moment.")
    if (micOn) return t("Listening… you can speak.")
    return t("Paused. Turn on microphone to continue.")
  })()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl flex flex-col h-[100dvh] sm:h-[90vh] max-h-none sm:max-h-[860px] overflow-hidden">
        {/* HEADER (как в голосовом) */}
        <div className="p-3 sm:p-4 border-b flex items-center justify-between rounded-t-xl relative bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white">
          <div className="flex flex-col flex-1 min-w-0 pr-2">
            <h3 className="font-semibold text-base sm:text-lg truncate flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                <Phone className="h-4 w-4" />
              </span>
              {t("AI Psychologist Video Call")}
            </h3>
            <div className="text-xs text-indigo-100 mt-1 truncate">
              {t("Video session in {{language}}", { language: languageDisplayName })} ·{" "}
              {(activeLanguage as any)?.flag || "🌐"}
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
                  {t("Select the AI psychologist you'd like to speak with during your video call.")}
                </p>
              </div>

              <div className="mb-6 bg-blue-50 p-4 rounded-lg w-full max-w-xs text-center mx-2">
                <p className="text-sm font-medium text-blue-700 mb-1">{t("Video call language")}:</p>
                <div className="text-lg font-semibold text-blue-800 flex items-center justify-center">
                  <span className="mr-2">{(activeLanguage as any)?.flag || "🌐"}</span>
                  {languageDisplayName}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  {t("Assistant will auto-detect your speech (ru/uk/en) and respond in the same language.")}
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
                        selectedCharacter.id === character.id ? "border-primary-600" : "border-transparent"
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
                {speechError && <p className="mt-3 text-xs text-center text-rose-600">{speechError}</p>}
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
                    <div className="text-xs font-semibold text-slate-800 truncate">{selectedCharacter.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{statusText}</div>
                  </div>
                </div>

                <div className="flex-1 px-3 py-3 sm:px-4 sm:py-4 space-y-3 sm:space-y-4 overflow-y-auto">
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
                  isMicMuted ? "bg-red-100 text-red-600" : micOn ? "bg-green-100 text-green-600 animate-pulse" : "bg-gray-100"
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
                <Phone className="h-6 w-6 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
