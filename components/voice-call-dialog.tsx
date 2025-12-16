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

type VoiceMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  gender?: "female" | "male"
}

const TURBOTA_AGENT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL || ""
const FALLBACK_CHAT_API = "/api/chat"

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

  while (common < maxCommon && prevWords[common] === fullWords[common]) {
    common++
  }

  if (common === 0) return full

  const rawTokens = full.split(/\s+/)
  if (common >= rawTokens.length) return ""

  return rawTokens.slice(common).join(" ").trim()
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

  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  const debugEnabled = useMemo(() => {
    if (typeof window === "undefined") return false
    try {
      return new URLSearchParams(window.location.search).get("debug") === "1"
    } catch {
      return false
    }
  }, [])

  const logLastRef = useRef(0)
  const log = (...args: any[]) => {
    if (!debugEnabled) return
    // throttle logs to avoid freezing devtools
    const now = Date.now()
    if (now - logLastRef.current < 400) return
    logLastRef.current = now
    // eslint-disable-next-line no-console
    console.log(...args)
  }

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [selectedGender, setSelectedGender] = useState<"female" | "male">(
    "female",
  )

  const isCallActiveRef = useRef(false)

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const isSttBusyRef = useRef(false)
  const lastTranscriptRef = useRef("")

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // VAD (optional)
  const vadEnabledRef = useRef(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const vadTimerRef = useRef<number | null>(null)

  const speakingRef = useRef(false)
  const lastVoiceTsRef = useRef(0)
  const speechStartTsRef = useRef(0)

  const periodicSttRef = useRef<number | null>(null)

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
    return selectedGender === "male" ? "MALE" : "FEMALE"
  }

  async function maybeSendStt(reason: "vad" | "timer" | "manual") {
    if (!isCallActiveRef.current) return
    if (isAiSpeaking) return
    if (isMicMuted) return

    if (isSttBusyRef.current) {
      log("[STT] skip busy", reason)
      return
    }

    if (!audioChunksRef.current.length) return

    const recMime = mediaRecorderRef.current?.mimeType || ""
    const firstChunkMime = audioChunksRef.current[0]?.type || ""
    const mimeType = (recMime || firstChunkMime || "audio/webm").toString()

    const blob = new Blob(audioChunksRef.current, { type: mimeType })
    if (blob.size < 12000) return

    try {
      isSttBusyRef.current = true
      log("[STT] send", { reason, size: blob.size, type: blob.type })

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
          "X-STT-Lang": computeLangCode(), // если backend умеет — будет точнее (укр не будет превращаться в ру)
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
        // eslint-disable-next-line no-console
        console.error("[STT] error", res.status, raw)
        return
      }

      const fullText = (data.text || "").toString().trim()
      log('[STT] full="' + fullText + '"')
      if (!fullText) return

      const prev = lastTranscriptRef.current
      const delta = diffTranscript(prev, fullText)
      lastTranscriptRef.current = fullText

      if (!delta) {
        log("[STT] no delta")
        return
      }

      const userMsg: VoiceMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text: delta,
      }

      setMessages((p) => [...p, userMsg])
      await handleUserText(delta)
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[STT] fatal", e)
    } finally {
      isSttBusyRef.current = false
    }
  }

  function speakText(text: string) {
    const cleanText = text?.trim()
    if (!cleanText) return

    const langCode = computeLangCode()
    const gender = getCurrentGender()

    const beginSpeaking = () => {
      setIsAiSpeaking(true)
      const rec = mediaRecorderRef.current
      if (rec && rec.state === "recording") {
        try {
          rec.pause()
          log("[REC] pause while TTS")
        } catch {}
      }
    }

    const finishSpeaking = () => {
      setIsAiSpeaking(false)
      const rec = mediaRecorderRef.current
      if (rec && rec.state === "paused" && isCallActiveRef.current && !isMicMuted) {
        try {
          rec.resume()
          log("[REC] resume after TTS")
        } catch {}
      }
    }

    ;(async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText, language: langCode, gender }),
        })

        const raw = await res.text()
        let data: any = null
        try {
          data = raw ? JSON.parse(raw) : null
        } catch {
          data = null
        }

        if (!res.ok || !data || data.success === false || !data.audioContent) {
          // eslint-disable-next-line no-console
          console.error("[TTS] error", data || raw)
          finishSpeaking()
          return
        }

        const audioUrl = `data:audio/mp3;base64,${data.audioContent}`

        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }

        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onplay = beginSpeaking
        audio.onended = () => {
          finishSpeaking()
          audioRef.current = null
        }
        audio.onerror = () => {
          finishSpeaking()
          audioRef.current = null
        }

        try {
          await audio.play()
        } catch {
          finishSpeaking()
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[TTS] fatal", e)
        setIsAiSpeaking(false)
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

    log("[CHAT] send ->", resolvedWebhook, {
      lang: langCode,
      gender: selectedGender,
    })

    try {
      const res = await fetch(resolvedWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          language: langCode,
          email: effectiveEmail,
          mode: "voice",
          gender: selectedGender,
          voiceLanguage: computeLangCode(),
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
        gender: selectedGender,
      }

      setMessages((p) => [...p, assistantMsg])
      speakText(answer)
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[CHAT] error", e)
      setNetworkError(t("Connection error. Please try again."))
      if (onError && e instanceof Error) onError(e)
    }
  }

  function stopAllTimers() {
    if (vadTimerRef.current) {
      window.clearInterval(vadTimerRef.current)
      vadTimerRef.current = null
    }
    if (periodicSttRef.current) {
      window.clearInterval(periodicSttRef.current)
      periodicSttRef.current = null
    }
  }

  function teardownVAD() {
    stopAllTimers()
    vadEnabledRef.current = false
    speakingRef.current = false
    lastVoiceTsRef.current = 0
    speechStartTsRef.current = 0

    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close()
      } catch {}
    }
    audioCtxRef.current = null
  }

  function endCall() {
    isCallActiveRef.current = false
    setIsCallActive(false)
    setIsListening(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setNetworkError(null)

    audioChunksRef.current = []
    lastTranscriptRef.current = ""
    isSttBusyRef.current = false

    teardownVAD()

    const rec = mediaRecorderRef.current
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop()
      } catch {}
    }
    mediaRecorderRef.current = null

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch {}
      })
      mediaStreamRef.current = null
    }

    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch {}
      audioRef.current = null
    }
  }

  const startCall = async (gender: "female" | "male") => {
    setSelectedGender(gender)
    setIsConnecting(true)
    setNetworkError(null)

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

      // ВАЖНО: рекордер стартуем ВСЕГДА, VAD не имеет права блокировать запись.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      mediaStreamRef.current = stream

      const track = stream.getAudioTracks?.()[0]
      if (debugEnabled && track) {
        // eslint-disable-next-line no-console
        console.log("[MIC] settings:", track.getSettings?.(), "label:", track.label)
      }

      // ----- MediaRecorder (кросс-платформа) -----
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

      const recorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      lastTranscriptRef.current = ""
      isSttBusyRef.current = false

      recorder.onstart = () => {
        setIsListening(true)
        log("[REC] onstart", { mime: recorder.mimeType })
      }

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (!ev.data || ev.data.size === 0) return
        audioChunksRef.current.push(ev.data)

        // fallback: если VAD выключен/упал, всё равно шлём по таймеру или вручную
        // (не дергаем каждый chunk — только timer или vad решит)
      }

      recorder.onerror = (ev: any) => {
        // eslint-disable-next-line no-console
        console.error("[REC] error", ev)
      }

      // мелкие куски чаще — меньше “не дослушал” + быстрее реакция
      recorder.start(1000)

      // ----- VAD (опционально). Если упадёт — запись всё равно идёт. -----
      try {
        const Ctx =
          (window as any).AudioContext || (window as any).webkitAudioContext
        if (!Ctx) throw new Error("No AudioContext in this browser")

        const ctx: AudioContext = new Ctx()
        audioCtxRef.current = ctx

        // иногда нужно принудительно resume после user gesture
        if (ctx.state === "suspended") {
          try {
            await ctx.resume()
          } catch {}
        }

        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        source.connect(analyser)

        // тип, который не валит TS в Vercel
        const data = new Uint8Array(new ArrayBuffer(analyser.fftSize))

        let noise = 0.008
        const baseMargin = 0.012

        const MIN_SPEECH_MS = 600
        const SILENCE_MS = 1400
        const MAX_UTTERANCE_MS = 25000

        vadEnabledRef.current = true
        speakingRef.current = false
        lastVoiceTsRef.current = 0
        speechStartTsRef.current = 0

        vadTimerRef.current = window.setInterval(() => {
          if (!isCallActiveRef.current) return
          if (!vadEnabledRef.current) return
          if (isAiSpeaking || isMicMuted) return

          try {
            analyser.getByteTimeDomainData(data)

            let sum = 0
            for (let i = 0; i < data.length; i++) {
              const v = (data[i] - 128) / 128
              sum += v * v
            }
            const rms = Math.sqrt(sum / data.length)

            // обновляем noise floor только когда не “говорим”
            if (!speakingRef.current) {
              noise = noise * 0.98 + rms * 0.02
            }

            const thr = Math.max(noise + baseMargin, 0.014)
            const now = Date.now()
            const isVoice = rms > thr

            if (isVoice) {
              lastVoiceTsRef.current = now
              if (!speakingRef.current) {
                speakingRef.current = true
                speechStartTsRef.current = now
              }
            }

            // лог раз в ~400мс выше throttle
            log("[VAD]", {
              rms: Number(rms.toFixed(4)),
              noise: Number(noise.toFixed(4)),
              thr: Number(thr.toFixed(4)),
              speaking: speakingRef.current,
              rec: mediaRecorderRef.current?.state || "none",
            })

            if (speakingRef.current) {
              const speechMs = now - speechStartTsRef.current
              const silenceMs =
                lastVoiceTsRef.current > 0 ? now - lastVoiceTsRef.current : 999999

              const silenceEnough = silenceMs >= SILENCE_MS
              const speechEnough = speechMs >= MIN_SPEECH_MS
              const tooLong = speechMs >= MAX_UTTERANCE_MS

              if ((silenceEnough && speechEnough) || tooLong) {
                speakingRef.current = false
                speechStartTsRef.current = 0
                // отправляем распознавание “на паузе”
                void maybeSendStt("vad")
              }
            }
          } catch (e) {
            // если WebAudio упал — просто вырубаем VAD, но запись продолжает работать
            // eslint-disable-next-line no-console
            console.error("[VAD] fatal, disabling VAD", e)
            vadEnabledRef.current = false
          }
        }, 120)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[VAD] init failed, fallback to timer", e)
        vadEnabledRef.current = false
      }

      // ----- Timer fallback (если VAD не работает/упал) -----
      periodicSttRef.current = window.setInterval(() => {
        if (!isCallActiveRef.current) return
        if (isAiSpeaking || isMicMuted) return
        if (vadEnabledRef.current) return // если VAD жив — таймер не нужен
        void maybeSendStt("timer")
      }, 4000)

      isCallActiveRef.current = true
      setIsCallActive(true)
      setIsConnecting(false)
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[CALL] start error", e)

      const name = e?.name
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
    }
  }

  const toggleMic = () => {
    const next = !isMicMuted
    setIsMicMuted(next)

    const rec = mediaRecorderRef.current
    if (!rec) return

    if (next) {
      if (rec.state === "recording") {
        try {
          rec.pause()
        } catch {}
      }
    } else {
      if (rec.state === "paused" && isCallActiveRef.current) {
        try {
          rec.resume()
        } catch {}
      }
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
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 pr-10">
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Phone className="h-4 w-4" />
                  </span>
                  {t("Voice session with AI-psychologist")}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {t("You can talk out loud, the assistant will listen, answer and voice the reply.")}
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
                        selectedGender === "female"
                          ? "bg-pink-600 text-white hover:bg-pink-700"
                          : "bg-pink-50 text-pink-700 hover:bg-pink-100"
                      }`}
                    >
                      {isConnecting && selectedGender === "female" ? (
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
                        selectedGender === "male"
                          ? "bg-sky-600 text-white hover:bg-sky-700"
                          : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                      }`}
                    >
                      {isConnecting && selectedGender === "male" ? (
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
