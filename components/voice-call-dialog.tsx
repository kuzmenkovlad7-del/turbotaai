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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function stopStream(s: MediaStream | null) {
  if (!s) return
  s.getTracks().forEach((t) => {
    try {
      t.stop()
    } catch {}
  })
}

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return ""
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
  ]
  for (const c of candidates) {
    try {
      if ((MediaRecorder as any).isTypeSupported?.(c)) return c
    } catch {}
  }
  return ""
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

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const isCallActiveRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const isAiSpeakingRef = useRef(false)

  // media + vad refs
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const isSttBusyRef = useRef(false)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const vadRafRef = useRef<number | null>(null)
  const vadDataRef = useRef<Uint8Array | null>(null)
  const vadNoiseRef = useRef(0.0002)
  const vadMaxRmsRef = useRef(0)
  const lastVoiceAtRef = useRef(0)
  const voiceActiveRef = useRef(false)
  const voiceFramesRef = useRef(0)

  const debugRef = useRef(false)
  const lastDebugLogAtRef = useRef(0)

  // autoscroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (typeof window === "undefined") return
    const q = new URLSearchParams(window.location.search)
    debugRef.current = q.get("debug") === "1"
  }, [])

  function dlog(...args: any[]) {
    if (!debugRef.current) return
    const now = Date.now()
    // троттлим, иначе RAF-лог убивает вкладку/DevTools
    if (now - lastDebugLogAtRef.current < 500) return
    lastDebugLogAtRef.current = now
    // eslint-disable-next-line no-console
    console.log(...args)
  }

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

  async function speakText(text: string) {
    if (typeof window === "undefined") return
    const cleanText = text?.trim()
    if (!cleanText) return

    const langCode = computeLangCode()
    const gender = getCurrentGender()

    isAiSpeakingRef.current = true
    setIsAiSpeaking(true)

    // если что-то писалось — стопаем запись (чтобы не ловить речь ассистента)
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop()
      } catch {}
    }

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
        isAiSpeakingRef.current = false
        setIsAiSpeaking(false)
        return
      }

      const audioUrl = `data:audio/mp3;base64,${data.audioContent}`

      if (audioRef.current) {
        try {
          audioRef.current.pause()
        } catch {}
        audioRef.current = null
      }

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        isAiSpeakingRef.current = false
        setIsAiSpeaking(false)
        audioRef.current = null
      }
      audio.onerror = () => {
        isAiSpeakingRef.current = false
        setIsAiSpeaking(false)
        audioRef.current = null
      }

      try {
        await audio.play()
      } catch {
        isAiSpeakingRef.current = false
        setIsAiSpeaking(false)
        audioRef.current = null
      }
    } catch {
      isAiSpeakingRef.current = false
      setIsAiSpeaking(false)
    }
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

    dlog("[CHAT] ->", resolvedWebhook, { langCode, gender: voiceGenderRef.current })

    try {
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
      await speakText(answer)
    } catch (error: any) {
      setNetworkError(t("Connection error. Please try again."))
      if (onError && error instanceof Error) onError(error)
    }
  }

  async function sendToStt(blob: Blob) {
    if (!isCallActiveRef.current) return
    if (isSttBusyRef.current) return
    if (!blob || blob.size < 4000) return

    isSttBusyRef.current = true
    dlog("[STT] send", { size: blob.size, type: blob.type || "unknown" })

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
        dlog("[STT] error", res.status, raw)
        return
      }

      const text = (data.text || "").toString().trim()
      if (!text) return

      const userMsg: VoiceMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text,
      }
      setMessages((prev) => [...prev, userMsg])
      await handleUserText(text)
    } catch (e: any) {
      dlog("[STT] fatal", e?.message || e)
    } finally {
      isSttBusyRef.current = false
    }
  }

  function stopVadLoop() {
    if (vadRafRef.current) {
      cancelAnimationFrame(vadRafRef.current)
      vadRafRef.current = null
    }
    analyserRef.current = null
    vadDataRef.current = null
    vadNoiseRef.current = 0.0002
    vadMaxRmsRef.current = 0
    voiceActiveRef.current = false
    voiceFramesRef.current = 0
    lastVoiceAtRef.current = 0
  }

  function stopRecorderIfAny(send: boolean) {
    const rec = recorderRef.current
    if (!rec) return

    // если inactive — просто очистим
    if (rec.state === "inactive") {
      recorderRef.current = null
      chunksRef.current = []
      return
    }

    const localChunks = chunksRef.current
    const localType = rec.mimeType || (localChunks[0]?.type ?? "")

    rec.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) localChunks.push(e.data)
    }

    rec.onstop = () => {
      recorderRef.current = null
      chunksRef.current = []

      if (!send) return
      const blob = new Blob(localChunks, { type: localType || "audio/webm" })
      void sendToStt(blob)
    }

    try {
      rec.stop()
    } catch {
      recorderRef.current = null
      chunksRef.current = []
    }
  }

  function startRecorder(stream: MediaStream) {
    if (typeof MediaRecorder === "undefined") return

    // не стартуем запись, если микрофон выключен или ассистент говорит
    if (isMicMutedRef.current || isAiSpeakingRef.current) return

    // если уже пишем — ничего не делаем
    if (recorderRef.current && recorderRef.current.state !== "inactive") return

    const mime = pickRecorderMime()
    const options: MediaRecorderOptions = {}
    if (mime) options.mimeType = mime

    chunksRef.current = []

    try {
      const rec = new MediaRecorder(stream, options)
      recorderRef.current = rec

      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      // timeslice важен для safari/ios и в целом стабильности
      rec.start(1000)
    } catch (e) {
      recorderRef.current = null
      chunksRef.current = []
    }
  }

  function startVadLoop() {
    const analyser = analyserRef.current
    const data = vadDataRef.current
    if (!analyser || !data) return

    // настройки “не дослушивает”:
    const START_FRAMES = 3            // сколько подряд кадров > thr, чтобы считать “начал говорить”
    const SILENCE_MS = 1400           // сколько тишины, чтобы завершить фразу (длиннее = меньше “обрывает”)
    const MAX_UTTERANCE_MS = 30000    // максимум длины одной фразы

    let utteranceStartAt = 0

    const tick = () => {
      if (!isCallActiveRef.current) return

      // если микрофон выключен или ассистент говорит — считаем тишину и стопаем запись
      if (isMicMutedRef.current || isAiSpeakingRef.current) {
        voiceActiveRef.current = false
        voiceFramesRef.current = 0
        lastVoiceAtRef.current = 0
        stopRecorderIfAny(false)
        vadRafRef.current = requestAnimationFrame(tick)
        return
      }

      analyser.getByteTimeDomainData(data)

      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)

      // шумовой фон подстраиваем EMA
      // обновляем шум только когда “не в голосе”, чтобы голос не раздувал noise floor
      if (!voiceActiveRef.current) {
        const n = vadNoiseRef.current
        vadNoiseRef.current = n * 0.98 + rms * 0.02
      }

      vadMaxRmsRef.current = Math.max(vadMaxRmsRef.current, rms)

      const noise = vadNoiseRef.current
      const thr = Math.max(0.0012, noise * 4.5) // базовый порог + адаптивный
      const isVoice = rms > thr

      const now = Date.now()

      dlog("[VAD]", { rms: +rms.toFixed(5), noise: +noise.toFixed(5), thr: +thr.toFixed(5), rec: recorderRef.current?.state || "none" })

      if (isVoice) {
        voiceFramesRef.current += 1
        lastVoiceAtRef.current = now

        if (!voiceActiveRef.current && voiceFramesRef.current >= START_FRAMES) {
          voiceActiveRef.current = true
          utteranceStartAt = now
          startRecorder(mediaStreamRef.current!)
        }
      } else {
        voiceFramesRef.current = 0
      }

      // завершение по тишине
      if (voiceActiveRef.current) {
        const silentFor = now - (lastVoiceAtRef.current || now)
        const dur = now - (utteranceStartAt || now)

        if (dur > MAX_UTTERANCE_MS) {
          voiceActiveRef.current = false
          stopRecorderIfAny(true)
        } else if (silentFor > SILENCE_MS) {
          voiceActiveRef.current = false
          stopRecorderIfAny(true)
        }
      }

      vadRafRef.current = requestAnimationFrame(tick)
    }

    vadRafRef.current = requestAnimationFrame(tick)
  }

  async function buildAudioGraph(stream: MediaStream) {
    // закрываем прошлый контекст
    if (audioCtxRef.current) {
      try {
        await audioCtxRef.current.close()
      } catch {}
      audioCtxRef.current = null
    }

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    audioCtxRef.current = ctx

    // важно: resume в user gesture (мы в клике)
    try {
      if (ctx.state === "suspended") await ctx.resume()
    } catch {}

    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048

    // КЛЮЧЕВО ДЛЯ ПК: чтобы граф точно “рендерился”
    // подключаем в destination через gain=0 (ничего не слышно, но analyser получает живой сигнал)
    const silentGain = ctx.createGain()
    silentGain.gain.value = 0

    source.connect(analyser)
    analyser.connect(silentGain)
    silentGain.connect(ctx.destination)

    analyserRef.current = analyser
    vadDataRef.current = new Uint8Array(analyser.fftSize)

    vadNoiseRef.current = 0.0002
    vadMaxRmsRef.current = 0
    voiceActiveRef.current = false
    voiceFramesRef.current = 0
    lastVoiceAtRef.current = 0
  }

  async function getStreamWithDevice(deviceId?: string) {
    const base: any = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    }

    const audio: any = deviceId
      ? { ...base, deviceId: { exact: deviceId } }
      : base

    // на некоторых ПК “умные” constraints ломают вход — поэтому fallback на audio: true ниже
    try {
      return await navigator.mediaDevices.getUserMedia({ audio })
    } catch {
      return await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true })
    }
  }

  async function autoFixNoSignal() {
    // ждём чуть-чуть, чтобы analyser успел “раскачаться”
    await sleep(1200)
    if (!isCallActiveRef.current) return

    const maxRms = vadMaxRmsRef.current
    if (maxRms > 0.0006) {
      setNetworkError(null)
      return
    }

    // если rms практически нулевой — пробуем другие микрофоны
    setNetworkError(
      "На ПК не вижу сигнал микрофона. Проверь: разрешение микрофона в адресной строке, выбранный input в системе/браузере, и что микрофон не занят другим приложением. Для логов открой страницу с ?debug=1."
    )

    let devices: MediaDeviceInfo[] = []
    try {
      devices = await navigator.mediaDevices.enumerateDevices()
    } catch {
      return
    }

    const inputs = devices.filter((d) => d.kind === "audioinput" && d.deviceId)
    if (!inputs.length) return

    // пробуем по очереди
    for (const d of inputs) {
      if (!isCallActiveRef.current) return

      try {
        dlog("[AUTO-MIC] try", d.label || d.deviceId)

        // остановим старый стрим
        stopRecorderIfAny(false)
        stopVadLoop()
        stopStream(mediaStreamRef.current)

        const s = await getStreamWithDevice(d.deviceId)
        mediaStreamRef.current = s
        await buildAudioGraph(s)
        startVadLoop()

        // короткая проверка сигнала
        await sleep(900)
        if (!isCallActiveRef.current) return

        if (vadMaxRmsRef.current > 0.0006) {
          setNetworkError(null)
          dlog("[AUTO-MIC] success", d.label || d.deviceId)
          return
        }
      } catch (e: any) {
        dlog("[AUTO-MIC] fail", e?.message || e)
        continue
      }
    }
  }

  const startCall = async (gender: "female" | "male") => {
    voiceGenderRef.current = gender

    setIsConnecting(true)
    setNetworkError(null)

    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setNetworkError(
          t("Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari.")
        )
        setIsConnecting(false)
        return
      }

      // 1) получаем стрим (дефолтный микрофон)
      const stream = await getStreamWithDevice()
      mediaStreamRef.current = stream

      // 2) строим аудио-граф для VAD (с подключением в destination через gain=0)
      await buildAudioGraph(stream)

      // 3) запускаем VAD
      isCallActiveRef.current = true
      setIsCallActive(true)
      setIsListening(true)
      setIsConnecting(false)

      startVadLoop()

      // 4) если на ПК signal=0 — автопоиск другого input
      void autoFixNoSignal()
    } catch (error: any) {
      const name = error?.name

      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(
          t("Microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page.")
        )
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setNetworkError(t("No microphone was found on this device. Please check your hardware."))
      } else {
        setNetworkError(
          t("Could not start microphone. Check permissions in the browser and system settings, then try again.")
        )
      }

      setIsConnecting(false)
      isCallActiveRef.current = false
      setIsCallActive(false)
      setIsListening(false)
    }
  }

  const endCall = async () => {
    isCallActiveRef.current = false
    setIsCallActive(false)
    setIsListening(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setNetworkError(null)

    isMicMutedRef.current = false
    isAiSpeakingRef.current = false

    stopRecorderIfAny(false)
    stopVadLoop()

    stopStream(mediaStreamRef.current)
    mediaStreamRef.current = null

    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch {}
      audioRef.current = null
    }

    if (audioCtxRef.current) {
      try {
        await audioCtxRef.current.close()
      } catch {}
      audioCtxRef.current = null
    }

    analyserRef.current = null
    vadDataRef.current = null
  }

  const toggleMic = () => {
    const next = !isMicMutedRef.current
    isMicMutedRef.current = next
    setIsMicMuted(next)

    const stream = mediaStreamRef.current
    if (stream) {
      const track = stream.getAudioTracks?.()[0]
      if (track) {
        try {
          track.enabled = !next
        } catch {}
      }
    }

    if (next) {
      // выключили — стопаем запись, не шлём
      stopRecorderIfAny(false)
      voiceActiveRef.current = false
      voiceFramesRef.current = 0
      lastVoiceAtRef.current = 0
    }
  }

  useEffect(() => {
    if (!isOpen) {
      void endCall()
      setMessages([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    return () => {
      void endCall()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusText = !isCallActive
    ? t("In crisis situations, please contact local emergency services immediately.")
    : isAiSpeaking
      ? t("Assistant is speaking...")
      : isMicMuted
        ? t("Paused. Turn on microphone to continue.")
        : t("Listening… you can speak.")

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          void endCall()
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-xl border-none bg-transparent p-0">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="pr-10">
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
                      onClick={() => void endCall()}
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
