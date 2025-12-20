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

  const [isCallActive, setIsCallActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [networkError, setNetworkError] = useState<string | null>(null)

  const voiceGenderRef = useRef<"female" | "male">("female")
  const effectiveEmail = userEmail || user?.email || "guest@example.com"

  const rawStreamRef = useRef<MediaStream | null>(null)
  const bridgedStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)

  const keepAudioElRef = useRef<HTMLAudioElement | null>(null)

  const audioChunksRef = useRef<Blob[]>([])
  const dropAudioRef = useRef(false)
  const dropAudioUntilTsRef = useRef(0)
  const sentIdxRef = useRef(0)
  const isSttBusyRef = useRef(false)
  const lastTranscriptRef = useRef("")

  

  const lastSttHintRef = useRef<"uk" | "ru" | "en">("uk")
const isCallActiveRef = useRef(false)
  const isAiSpeakingRef = useRef(false)
  const isMicMutedRef = useRef(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)

  const vad = useRef({
    noiseFloor: 0,
    rms: 0,
    thr: 0.008,
    voice: false,
    voiceUntilTs: 0,
    utteranceStartTs: 0,
    endedCount: 0,
  })

  const debugParams = useMemo(() => {
    if (typeof window === "undefined") return { debug: false, stt: null as any, thr: null as any }
    const qs = new URLSearchParams(window.location.search)
    const debug = qs.get("debugAudio") === "1"
    const stt = qs.get("stt") // uk|ru|en
    const thr = qs.get("thr") // number
    return { debug, stt, thr }
  }, [])

  const isMobile = useMemo(() => {
    if (typeof navigator === "undefined") return false
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  }, [])

  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking
  }, [isAiSpeaking])

  useEffect(() => {
    isMicMutedRef.current = isMicMuted
  }, [isMicMuted])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  function log(...args: any[]) {
    // eslint-disable-next-line no-console
    console.log(...args)
  }

  function computeLangCode(): string {
    const forced = debugParams.stt
    if (forced === "uk") return "uk-UA"
    if (forced === "ru") return "ru-RU"
    if (forced === "en") return "en-US"

    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    if (lang.startsWith("uk")) return "uk-UA"
    if (lang.startsWith("ru")) return "ru-RU"
    return "en-US"
  }

  function computeHint3(): "uk" | "ru" | "en" {
    const forced = debugParams.stt
    if (forced === "uk") return "uk"
    if (forced === "ru") return "ru"
    if (forced === "en") return "en"

    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    if (lang.startsWith("ru")) return "ru"
    if (lang.startsWith("en")) return "en"
    return "uk"
  }

  function sttLangToLangCode(sttLang: any): string {
    const l = (sttLang || "").toString().toLowerCase()
    if (l.startsWith("ru")) return "ru-RU"
    if (l.startsWith("en")) return "en-US"
    return "uk-UA"
  }

  function getCurrentGender(): "MALE" | "FEMALE" {
    return (voiceGenderRef.current || "female") === "male" ? "MALE" : "FEMALE"
  }

  function stopRaf() {
    if (rafRef.current) {
      try {
        cancelAnimationFrame(rafRef.current)
      } catch {}
      rafRef.current = null
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
    if (rec) {
      try {
        if (rec.state !== "inactive") rec.stop()
      } catch {}
      mediaRecorderRef.current = null
    }
  }

  function stopStreams() {
    const raw = rawStreamRef.current
    if (raw) {
      raw.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch {}
      })
      rawStreamRef.current = null
    }

    const bridged = bridgedStreamRef.current
    if (bridged) {
      bridged.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch {}
      })
      bridgedStreamRef.current = null
    }
  }

  function stopTtsAudio() {
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.pause()
      } catch {}
      ttsAudioRef.current = null
    }
  }

    // server log (видно в терминале/логах сервера). Включается через ?serverLog=1
  const serverLogEnabledRef = useRef(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const sp = new URLSearchParams(window.location.search)
      serverLogEnabledRef.current = sp.get("serverLog") === "1"
    } catch {}
  }, [])

  function serverLog(tag: string, data?: any) {
    if (!serverLogEnabledRef.current) return
    try {
      const payload = {
        t: Date.now(),
        tag,
        data: data ?? null,
        ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
      }
      const body = JSON.stringify(payload)
      // sendBeacon предпочтительнее (не блочит)
      const ok = typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
        ? navigator.sendBeacon("/api/client-log", new Blob([body], { type: "application/json" }))
        : false
      if (!ok) {
        void fetch("/api/client-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }).catch(() => {})
      }
    } catch {}
  }

async function maybeSendStt(reason: string) {
    if (!isCallActiveRef.current) return
    if (isAiSpeakingRef.current) return
    if (isMicMutedRef.current) return

    const chunks = audioChunksRef.current
    if (!chunks.length) return

    // отправляем НОВЫЕ чанки начиная с sentIdx, но чтобы контейнер был валидным — добавляем самый первый чанк (header)
    // (это сильно уменьшает размер по сравнению с "весь звук с начала")
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
      log("[STT] send", { reason, size: blob.size, sentIdx, totalChunks: chunks.length, type: blob.type })

      serverLog("stt_send", { reason, size: blob.size, sentIdx, totalChunks: chunks.length, type: blob.type })
      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
          "X-STT-Lang": "auto",
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
        return
      }

      // важное: только после успешного ответа двигаем sentIdx
      sentIdxRef.current = chunks.length

      const fullText = (data.text || "").toString().trim()
      log('[STT] transcript full="' + fullText + '"')
      serverLog("stt_full", { fullText })
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

      setMessages((prevMsgs) => [...prevMsgs, userMsg])
      await handleUserText(delta, sttLangToLangCode((data as any)?.lang))
    } catch (e: any) {
      console.error("[STT] fatal", e)
    } finally {
      isSttBusyRef.current = false
    }
  }

  function speakText(text: string, langCodeOverride?: string) {
    const cleanText = text?.trim()
    if (!cleanText) return

    const langCode = (langCodeOverride || computeLangCode())
    const gender = getCurrentGender()

    const begin = () => {
      // prevent echo: ignore recorder chunks while assistant is speaking (mobile-safe)
      dropAudioRef.current = true
      dropAudioUntilTsRef.current = 0
      audioChunksRef.current = []
      sentIdxRef.current = 0
      setIsAiSpeaking(true)
    }

    const finish = () => {
      // short grace period after TTS to avoid tail echo
      dropAudioRef.current = false
      dropAudioUntilTsRef.current = Date.now() + 900
      audioChunksRef.current = []
      sentIdxRef.current = 0
      setIsAiSpeaking(false)
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
          finish()
          return
        }

        const url = `data:audio/mp3;base64,${data.audioContent}`

        stopTtsAudio()
        const a = new Audio(url)
        ttsAudioRef.current = a
        a.onplay = begin
        a.onended = () => {
          finish()
          ttsAudioRef.current = null
        }
        a.onerror = () => {
          finish()
          ttsAudioRef.current = null
        }

        try {
          await a.play()
        } catch {
          finish()
        }
      } catch {
        finish()
      }
    })()
  }

  async function handleUserText(text: string, langCodeOverride?: string) {
    const langCode =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    const resolvedWebhook =
      (webhookUrl && webhookUrl.trim()) ||
      TURBOTA_AGENT_WEBHOOK_URL.trim() ||
      FALLBACK_CHAT_API

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
      speakText(answer)
    } catch (e: any) {
      console.error(e)
      setNetworkError(t("Connection error. Please try again."))
      if (onError && e instanceof Error) onError(e)
    }
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

  function startVadLoop() {
    const analyser = analyserRef.current
    if (!analyser) return

    const data = new Uint8Array(analyser.fftSize)
    const baseThr = (() => {
      const fromQs = debugParams.thr ? Number(debugParams.thr) : NaN
      if (!Number.isNaN(fromQs) && fromQs > 0) return fromQs
      return isMobile ? 0.010 : 0.008
    })()

    const hangoverMs = isMobile ? 2080 : 1200
    const maxUtteranceMs = 8000

    const tick = () => {
      analyser.getByteTimeDomainData(data)

      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)

      const now = Date.now()
      const st = vad.current

      // noise floor апдейт только когда "не голос"
      if (!st.voice) {
        st.noiseFloor = st.noiseFloor * 0.995 + rms * 0.005
      }

      const thr = Math.max(baseThr, st.noiseFloor * 3.0)
      const voiceNow = rms > thr

      st.rms = rms
      st.thr = thr

      if (voiceNow) {
        st.voiceUntilTs = now + hangoverMs
        if (!st.voice) {
          st.voice = true
          st.utteranceStartTs = now
        }
      } else {
        if (st.voice && now > st.voiceUntilTs) {
          st.voice = false
          st.utteranceStartTs = 0
          void maybeSendStt("vad_end")
        }
      }

      // длинная фраза — режем каждые maxUtteranceMs
      if (st.voice && st.utteranceStartTs && now - st.utteranceStartTs > maxUtteranceMs) {
        st.utteranceStartTs = now
        void maybeSendStt("max_utt")
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  async function startCall(gender: "female" | "male") {
    voiceGenderRef.current = gender
    setIsConnecting(true)
    setNetworkError(null)

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setNetworkError(
          t("Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari."),
        )
        setIsConnecting(false)
        return
      }

      const raw = await navigator.mediaDevices.getUserMedia({ audio: true })
      rawStreamRef.current = raw

      // keepalive (некоторые окружения реально быстрее “умирают” без потребителя)
      try {
        const a = new Audio()
        a.muted = true
        ;(a as any).playsInline = true
        ;(a as any).srcObject = raw
        keepAudioElRef.current = a
        await a.play().catch(() => {})
      } catch {}

      // WebAudio bridge
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

      const bridged = dest.stream
      bridgedStreamRef.current = bridged

      // reset state
      audioChunksRef.current = []
      sentIdxRef.current = 1 // первый чанк (header) всегда оставляем как “0”
      isSttBusyRef.current = false
      lastTranscriptRef.current = ""
      vad.current = {
        noiseFloor: 0,
        rms: 0,
        thr: 0.008,
        voice: false,
        voiceUntilTs: 0,
        utteranceStartTs: 0,
        endedCount: 0,
      }

      const mime = pickMime()
      const opts: MediaRecorderOptions = {}
      if (mime) opts.mimeType = mime

      const rec = new MediaRecorder(bridged, opts)
      mediaRecorderRef.current = rec

      rec.onstart = () => {
        log("[REC] onstart", { state: rec.state, mime: (rec as any).mimeType || mime || "default" })
        setIsListening(true)
      }

      rec.ondataavailable = (ev: BlobEvent) => {
      const now = Date.now()
      if (dropAudioRef.current || now < dropAudioUntilTsRef.current) return

        const b = ev.data
        const size = b?.size || 0
        if (debugParams.debug) {
          log("[REC] chunk", { size, type: b?.type, totalChunks: audioChunksRef.current.length + (size > 0 ? 1 : 0) })
        }
        if (size > 0) {
          audioChunksRef.current.push(b)
        }
      }

      rec.onerror = (ev: any) => {
        console.error("[REC] error", ev)
      }

      rec.onstop = () => {
        setIsListening(false)
      }

      // ключевой момент: на некоторых окружениях start(timeslice) даёт пустые чанки
      // поэтому: start() + requestData() по таймеру
      rec.start()
      setIsListening(true)

      // requestData таймер
      const sliceMs = isMobile ? 1200 : 1000
      ;(rec as any)._reqTimer = window.setInterval(() => {
        try {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.requestData()
          }
        } catch {}
      }, sliceMs)

      // VAD loop
      startVadLoop()

      // стартовый “прогрев” — через 2 сек если вообще нет аудио, покажем ошибку
      window.setTimeout(() => {
        if (!isCallActiveRef.current) return
        if (audioChunksRef.current.length === 0) {
          console.warn("[REC] no chunks after 2s (speak now). If stays 0 -> environment/mic issue.")
        }
      }, 2000)

      isCallActiveRef.current = true
      setIsCallActive(true)
      setIsConnecting(false)
    } catch (e: any) {
      console.error("[CALL] start error", e)
      setIsConnecting(false)
      isCallActiveRef.current = false
      setIsCallActive(false)
      setIsListening(false)

      const name = e?.name
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setNetworkError(
          t("Microphone is blocked for this site in the browser. Please allow access in the address bar and reload the page."),
        )
      } else {
        setNetworkError(t("Could not start microphone. Check permissions and try again."))
      }
    }
  }

  function endCall() {
    log("[CALL] endCall")

    isCallActiveRef.current = false
    setIsCallActive(false)
    setIsListening(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setNetworkError(null)

    // stop recorder timer
    const rec: any = mediaRecorderRef.current
    if (rec && rec._reqTimer) {
      try {
        clearInterval(rec._reqTimer)
      } catch {}
      rec._reqTimer = null
    }

    stopRecorder()
    stopKeepAlive()
    stopAudioGraph()
    stopStreams()
    stopTtsAudio()

    audioChunksRef.current = []
    sentIdxRef.current = 0
    lastTranscriptRef.current = ""
    isSttBusyRef.current = false
  }

  function toggleMic() {
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
    return () => {
      endCall()
    }
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

  const dbg = debugParams.debug
    ? `stt=${debugParams.stt || "auto"} rms=${vad.current.rms.toFixed(5)} thr=${vad.current.thr.toFixed(5)} nf=${vad.current.noiseFloor.toFixed(5)} voice=${vad.current.voice ? 1 : 0} chunks=${audioChunksRef.current.length} sentIdx=${sentIdxRef.current}`
    : null

  // ANDROID_ONE_SHOT_V4: server logs + watchdog (только мобилки). Логи в терминал через /api/client-log при ?serverLog=1
  function __serverLog(event: string, data: any = {}) {
    try {
      if (typeof window === "undefined") return
      const sp = new URLSearchParams(window.location.search)
      if (!sp.has("serverLog")) return
      fetch("/api/client-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true as any,
        body: JSON.stringify({
          t: Date.now(),
          href: window.location.href,
          ua: navigator.userAgent,
          event,
          data,
        }),
      }).catch(() => {})
    } catch {}
  }

  useEffect(() => {
    if (!isCallActive) return

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua)
    if (!isMobile) return

    let tick = 0
    const id = window.setInterval(() => {
      try {
        if (!isCallActiveRef.current) return

        const rec: any = mediaRecorderRef.current
        const state = rec?.state || "null"

        const chunksLen = (audioChunksRef as any)?.current?.length
        const sentIdx = (sentIdxRef as any)?.current
        const sttBusy = (isSttBusyRef as any)?.current
        const micMuted = (isMicMutedRef as any)?.current

        tick++

        // периодически шлём состояние в терминал
        if (tick % 3 === 0) {
          __serverLog("mobile_state", { state, chunksLen, sentIdx, sttBusy, micMuted })
        }

        // если чанки обнулились, а sentIdx остался большим — сбрасываем
        if (typeof chunksLen === "number" && typeof sentIdx === "number" && sentIdx > chunksLen) {
          try { (sentIdxRef as any).current = 0 } catch {}
          try { (lastTranscriptRef as any).current = "" } catch {}
          __serverLog("sentIdx_reset", { sentIdx, chunksLen })
        }

        // если запись идёт — иногда Android не отдаёт чанки, принудительно просим data
        if (!micMuted && rec && state === "recording" && tick % 2 === 0) {
          try { rec.requestData?.() } catch {}
        }

        // если рекордер подвис — оживляем
        if (!micMuted && rec) {
          if (state === "paused") {
            try { rec.resume() } catch {}
            __serverLog("rec_resume_try", { state })
          } else if (state === "inactive") {
            try { rec.start(250) } catch {}
            try { (sentIdxRef as any).current = 0 } catch {}
            try { (lastTranscriptRef as any).current = "" } catch {}
            __serverLog("rec_restart_try", { state })
          }
        }
      } catch {}
    }, 900)

    return () => window.clearInterval(id)
  }, [isCallActive, isMicMuted])



  


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
                  {t("You can talk out loud, the assistant will listen, answer and voice the reply.")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex h-[500px] flex-col md:h-[540px]">
            <ScrollArea className="flex-1 px-5 pt-4 pb-2">
              <div ref={scrollRef} className="max-h-full space-y-3 pr-1 text-xs md:text-sm">
                {dbg && (
                  <div className="rounded-2xl bg-slate-900 px-3 py-2 text-[11px] text-white/90">
                    debugAudio=1 {dbg}
                  </div>
                )}

                {!isCallActive && messages.length === 0 && (
                  <div data-no-translate="true" translate="no" className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-slate-700">
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
                  <div className="rounded-2xl bg-rose-50 px-3 py-3 text-xs text-rose-700">{networkError}</div>
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
                      className="h-11 flex-1 rounded-full px-5 text-xs font-semibold shadow-sm sm:max-w-xs bg-pink-600 text-white hover:bg-pink-700"
                    >
                      {isConnecting ? (
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
                      className="h-11 flex-1 rounded-full px-5 text-xs font-semibold shadow-sm sm:max-w-xs bg-sky-600 text-white hover:bg-sky-700"
                    >
                      {isConnecting ? (
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
