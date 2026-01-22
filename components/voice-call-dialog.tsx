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

function normalizeUtterance(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[.,!?;:«»"“”‚‘’…]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function collapseLeadingWordRepeats(text: string): string {
  let t = (text || "").trim()
  if (!t) return t
  for (let i = 0; i < 6; i++) {
    const parts = t.split(/\s+/)
    if (parts.length < 2) break
    const a = normalizeUtterance(parts[0])
    const b = normalizeUtterance(parts[1])
    if (a && b && a === b) {
      t = parts.slice(1).join(" ").trim()
      continue
    }
    break
  }
  return t
}

function splitSentencesKeepPunct(text: string): string[] {
  const t = (text || "").replace(/\s+/g, " ").trim()
  if (!t) return []
  const parts = t.match(/[^.!?]+[.!?]?/g)
  if (!parts) return [t]
  return parts.map((p) => p.trim()).filter(Boolean)
}

function dedupeConsecutive(parts: string[]): string[] {
  const out: string[] = []
  let prevNorm = ""
  for (const raw of parts) {
    const p = (raw || "").trim()
    if (!p) continue
    const n = normalizeUtterance(p)
    if (!n) continue
    if (n === prevNorm) continue
    out.push(p)
    prevNorm = n
  }
  return out
}

function sanitizeCommaRepeatsInSentence(sentence: string): string {
  let s = (sentence || "").trim()
  if (!s) return s

  const endPunct = /[.!?]$/.test(s) ? s.slice(-1) : ""
  const body = endPunct ? s.slice(0, -1) : s

  const commaCount = (body.match(/,/g) || []).length
  if (commaCount < 2) return s

  const parts = body.split(/\s*,\s*/g).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 3) return s

  const deduped = dedupeConsecutive(parts)
  const joined = deduped.join(", ").trim()
  return (joined + endPunct).trim()
}

function sanitizeTextRepetitions(text: string): string {
  let t = (text || "").trim()
  if (!t) return t

  // 1) Схлопываем повторы по предложениям (A. A. A.)
  const sentences = splitSentencesKeepPunct(t)
  if (sentences.length >= 2) {
    t = dedupeConsecutive(sentences).join(" ").trim()
  }

  // 2) Схлопываем повторы внутри предложения через запятые (A, A, A)
  const sentences2 = splitSentencesKeepPunct(t).map(sanitizeCommaRepeatsInSentence)
  t = sentences2.join(" ").replace(/\s+/g, " ").trim()

  // 3) Страховка от “зацикливания” текста: если почти всё одно и то же — режем до 2 предложений
  const toks = normalizeUtterance(t).split(" ").filter(Boolean)
  if (toks.length >= 40) {
    const uniq = new Set(toks).size
    const ratio = uniq / toks.length
    if (ratio < 0.35) {
      const first = splitSentencesKeepPunct(t).slice(0, 2)
      t = first.join(" ").trim()
    }
  }

  return t
}

function sanitizeUserText(text: string): string {
  let t = (text || "").trim()
  if (!t) return t
  t = collapseLeadingWordRepeats(t)
  t = sanitizeTextRepetitions(t)
  return t.trim()
}

function sanitizeAssistantText(text: string): string {
  let t = (text || "").trim()
  if (!t) return t
  t = collapseLeadingWordRepeats(t)
  t = sanitizeTextRepetitions(t)

  // Ограничим “разгон” если вдруг пришло слишком много
  const sents = splitSentencesKeepPunct(t)
  if (sents.length > 5) t = sents.slice(0, 5).join(" ").trim()

  return t.trim()
}

function stripLeadingEchoOfPrev(delta: string, prevSentNorm: string, prevSentTs: number): string {
  let t = (delta || "").trim()
  if (!t) return t
  const dt = Date.now() - (prevSentTs || 0)
  if (!prevSentNorm || dt > 15000) return t

  const prevWords = prevSentNorm.split(" ").filter(Boolean)
  if (prevWords.length === 0 || prevWords.length > 2) return t

  const firstWord = normalizeUtterance(t.split(/\s+/)[0] || "")
  const prevLast = prevWords[prevWords.length - 1] || ""

  if (firstWord && prevLast && firstWord === prevLast) {
    const parts = t.split(/\s+/)
    if (parts.length >= 2) return parts.slice(1).join(" ").trim()
  }
  return t
}

function isMostlyGarbage(text: string): boolean {
  const t = (text || "").trim()
  if (!t) return true
  const norm = normalizeUtterance(t)
  if (!norm) return true

  if (norm.length < 3) return true

  const toks = norm.split(" ")
  if (toks.length === 1 && toks[0].length <= 2) return true

  const letters = (t.match(/[A-Za-zА-Яа-яЇїІіЄєҐґ]/g) || []).length
  const total = t.length
  if (total > 0 && letters / total < 0.45) return true

  const bannedSub = [
    "обратите внимание",
    "зверніть увагу",
    "звернить увагу",
    "дивіться на екран",
    "дивиться на екран",
    "перейти на екран",
    "подпиш",
    "подписывай",
    "лайк",
    "ставьте",
    "на канал",
    "в описании",
    "ссылка",
    "спонсор",
    "реклама",
    "промокод",
    "фотография",
    "скриншот",
    "нажмите",
    "кнопк",
  ]
  for (const b of bannedSub) {
    if (norm.includes(b)) return true
  }

  const bannedExact = new Set([
    "угу",
    "ага",
    "мм",
    "м",
    "а",
    "ну",
    "так",
    "ок",
    "okay",
    "yes",
    "no",
    "hello",
    "hi",
  ])
  if (toks.length === 1 && bannedExact.has(toks[0])) return true

  return false
}

function base64ToObjectUrl(b64: string, mime = "audio/mpeg"): string {
  const bin = atob(b64)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  const blob = new Blob([bytes], { type: mime })
  return URL.createObjectURL(blob)
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

  // фиксируем язык на момент старта звонка (STT/TTS/агент)
  const sessionVoiceLangRef = useRef<string>("uk-UA")
  const sessionAgentLangRef = useRef<"uk" | "ru" | "en">("uk")

  const rawStreamRef = useRef<MediaStream | null>(null)
  const bridgedStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)

  const keepAudioElRef = useRef<HTMLAudioElement | null>(null)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)

  const audioChunksRef = useRef<Blob[]>([])
  const utterStartIdxRef = useRef<number>(1)

  const pendingSttReasonRef = useRef<string | null>(null)
  const pendingSttTimerRef = useRef<number | null>(null)
  const pendingSttStartIdxRef = useRef<number | null>(null)

  const MIN_UTTERANCE_MS = 520
  const isSttBusyRef = useRef(false)

  const lastUserSentNormRef = useRef("")
  const lastUserSentTsRef = useRef(0)

  const lastAssistantSentNormRef = useRef("")
  const lastAssistantSentTsRef = useRef(0)

  const isCallActiveRef = useRef(false)
  const isAiSpeakingRef = useRef(false)
  const isMicMutedRef = useRef(false)
  const ttsCooldownUntilRef = useRef(0)

  // важно: только последний TTS имеет право проигрываться (иначе может “двоить”)
  const ttsSeqRef = useRef(0)

  // защита от параллельных запросов к агенту
  const isAgentBusyRef = useRef(false)
  const pendingUserToAgentRef = useRef<{ text: string; voiceLang: string } | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)

  const debugParams = useMemo(() => {
    if (typeof window === "undefined") return { debug: false }
    const qs = new URLSearchParams(window.location.search)
    return { debug: qs.get("debugAudio") === "1" }
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

  function computeLangCode(): string {
    const lang =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    if (lang.startsWith("uk")) return "uk-UA"
    if (lang.startsWith("ru")) return "ru-RU"
    return "en-US"
  }

  function setSessionLangFromUi() {
    const voiceLang = computeLangCode()
    sessionVoiceLangRef.current = voiceLang
    const lc = voiceLang.toLowerCase()
    sessionAgentLangRef.current = lc.startsWith("ru") ? "ru" : lc.startsWith("en") ? "en" : "uk"
  }

  function getSessionVoiceLang(): string {
    return sessionVoiceLangRef.current || computeLangCode()
  }

  function getSessionAgentLang(): "uk" | "ru" | "en" {
    return sessionAgentLangRef.current || "uk"
  }

  function getCurrentGender(): "MALE" | "FEMALE" {
    return (voiceGenderRef.current || "female") === "male" ? "MALE" : "FEMALE"
  }

  // prime audio (iOS/safari)
  useEffect(() => {
    let done = false
    const prime = () => {
      if (done) return
      done = true
      try {
        const a = ttsAudioRef.current ?? new Audio()
        ;(a as any).playsInline = true
        ;(a as any).preload = "auto"
        a.muted = true
        a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA="
        ttsAudioRef.current = a
        const p = a.play()
        ;(p as any)?.catch?.(() => {})
        try {
          a.pause()
          a.currentTime = 0
          a.muted = false
          a.src = ""
        } catch {}
      } catch {}
    }

    window.addEventListener("touchstart", prime as any, { passive: true, once: true } as any)
    window.addEventListener("mousedown", prime as any, { once: true } as any)
    return () => {
      window.removeEventListener("touchstart", prime as any)
      window.removeEventListener("mousedown", prime as any)
    }
  }, [])

  const vad = useRef({
    noiseFloor: 0,
    voice: false,
    voiceUntilTs: 0,
    utteranceStartTs: 0,
    voiceOnCount: 0,
  })

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
    const rec: any = mediaRecorderRef.current
    if (rec && rec._reqTimer) {
      try {
        clearInterval(rec._reqTimer)
      } catch {}
      rec._reqTimer = null
    }
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
    const a = ttsAudioRef.current
    if (!a) return
    try {
      a.onplay = null
      a.onended = null
      a.onerror = null
      a.onloadedmetadata = null
    } catch {}
    try {
      a.pause()
    } catch {}
    try {
      a.currentTime = 0
    } catch {}
    try {
      a.src = ""
    } catch {}
  }

  function shouldDedupUser(text: string): boolean {
    const norm = normalizeUtterance(text)
    if (!norm) return true
    const last = lastUserSentNormRef.current || ""
    const dt = Date.now() - (lastUserSentTsRef.current || 0)
    if (last && norm === last && dt < 12000) return true
    if (last && dt < 3500) {
      const a = norm.slice(0, 25)
      const b = last.slice(0, 25)
      if (a && b && a === b) return true
    }
    return false
  }

  function shouldDedupAssistant(text: string): boolean {
    const norm = normalizeUtterance(text)
    if (!norm) return true
    const last = lastAssistantSentNormRef.current || ""
    const dt = Date.now() - (lastAssistantSentTsRef.current || 0)
    if (last && norm === last && dt < 12000) return true
    return false
  }

  async function maybeSendStt(reason: string, startIdxOverride?: number) {
    if (!isCallActiveRef.current) return
    if (isAiSpeakingRef.current) return
    if (Date.now() < ttsCooldownUntilRef.current) return
    if (isMicMutedRef.current) return
    if (isSttBusyRef.current) return

    const chunks = audioChunksRef.current
    if (!chunks || chunks.length < 2) return

    const header = chunks[0]
    if (!header) return

    const startIdx = Math.max(1, startIdxOverride ?? utterStartIdxRef.current ?? 1)
    const body = chunks.slice(startIdx)
    if (!body.length) return

    const roughSize = body.reduce((acc, b) => acc + (b?.size || 0), 0)
    const minBytes = isMobile ? 2600 : 2200
    if (roughSize < minBytes) return

    const blob = new Blob([header, ...body], { type: header.type || body[0]?.type || "audio/webm" })
    if (blob.size < minBytes) return

    try {
      isSttBusyRef.current = true

      const sttLang = getSessionVoiceLang()

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Content-Type": blob.type || "application/octet-stream",
          "X-STT-Hint": "auto",
          "X-STT-Lang": sttLang,
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

      const keepHeader = audioChunksRef.current?.[0]
      audioChunksRef.current = keepHeader ? [keepHeader] : []
      utterStartIdxRef.current = keepHeader ? 1 : 0

      const fullText = (data.text || "").toString().trim()
      if (!fullText) return

      let delta = fullText
      delta = stripLeadingEchoOfPrev(delta, lastUserSentNormRef.current, lastUserSentTsRef.current)
      delta = sanitizeUserText(delta)

      if (!delta) return
      if (isMostlyGarbage(delta)) return
      if (shouldDedupUser(delta)) return

      lastUserSentNormRef.current = normalizeUtterance(delta)
      lastUserSentTsRef.current = Date.now()

      if (debugParams.debug) {
        console.log("[STT]", { reason, startIdx, fullText, delta })
      }

      const userMsg: VoiceMessage = {
        id: `${Date.now()}-user`,
        role: "user",
        text: delta,
      }

      setMessages((prevMsgs) => [...prevMsgs, userMsg])
      await handleUserText(delta, sttLang)
    } catch (e: any) {
      console.error("[STT] fatal", e)
    } finally {
      isSttBusyRef.current = false
    }
  }

  function flushAndSendStt(reason: string, startIdx?: number) {
    const rec: any = mediaRecorderRef.current
    if (!rec || rec.state !== "recording" || typeof rec.requestData !== "function") {
      void maybeSendStt(reason, startIdx)
      return
    }

    if (pendingSttReasonRef.current) return
    pendingSttReasonRef.current = reason
    pendingSttStartIdxRef.current = typeof startIdx === "number" ? startIdx : utterStartIdxRef.current

    try {
      rec.requestData()
    } catch {}

    if (pendingSttTimerRef.current) window.clearTimeout(pendingSttTimerRef.current)
    pendingSttTimerRef.current = window.setTimeout(() => {
      if (!pendingSttReasonRef.current) return
      const r = pendingSttReasonRef.current
      const si = pendingSttStartIdxRef.current ?? utterStartIdxRef.current
      pendingSttReasonRef.current = null
      pendingSttStartIdxRef.current = null
      pendingSttTimerRef.current = null
      void maybeSendStt(r, si)
    }, 220)
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

    const baseThr = isMobile ? 0.014 : 0.01
    const hangoverMs = 2000
    const maxUtteranceMs = 25000
    const onFramesNeeded = isMobile ? 4 : 3
    const thrMult = isMobile ? 5.0 : 4.6

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

      // обновляем noiseFloor только когда “тишина”
      if (!st.voice && rms < baseThr) st.noiseFloor = st.noiseFloor * 0.995 + rms * 0.005

      const thr = Math.max(baseThr, st.noiseFloor * thrMult)
      const voiceNow = rms > thr

      if (!st.voice) {
        st.voiceOnCount = voiceNow ? Math.min(onFramesNeeded + 2, st.voiceOnCount + 1) : 0
        if (st.voiceOnCount >= onFramesNeeded) {
          st.voiceOnCount = 0
          st.voice = true
          st.voiceUntilTs = now + hangoverMs
          st.utteranceStartTs = now
          utterStartIdxRef.current = Math.max(1, audioChunksRef.current.length - 1)
        }
      } else {
        if (voiceNow) st.voiceUntilTs = now + hangoverMs

        if (!voiceNow && now > st.voiceUntilTs) {
          const voiceMs = st.utteranceStartTs ? now - st.utteranceStartTs : 0
          st.voice = false
          st.utteranceStartTs = 0
          if (voiceMs >= MIN_UTTERANCE_MS) void flushAndSendStt("vad_end", utterStartIdxRef.current)
        }

        if (st.voice && st.utteranceStartTs && now - st.utteranceStartTs > maxUtteranceMs) {
          st.utteranceStartTs = now
          void flushAndSendStt("max_utt", utterStartIdxRef.current)
          utterStartIdxRef.current = Math.max(1, audioChunksRef.current.length - 1)
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  function speakText(text: string, langCodeOverride?: string) {
    const cleanText = sanitizeAssistantText(text || "")
    if (!cleanText) return

    const langCode = langCodeOverride || getSessionVoiceLang()
    const gender = getCurrentGender()

    const seq = ++ttsSeqRef.current

    let done = false
    let watchdogId: number | null = null
    let objectUrl: string | null = null

    const clearWatchdog = () => {
      if (watchdogId) {
        try {
          window.clearTimeout(watchdogId)
        } catch {}
        watchdogId = null
      }
    }

    const revokeUrl = () => {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl)
        } catch {}
        objectUrl = null
      }
    }

    const finishOnce = () => {
      if (done) return
      done = true

      clearWatchdog()
      revokeUrl()

      // только актуальный запрос может сбрасывать состояние
      if (seq !== ttsSeqRef.current) return

      ttsCooldownUntilRef.current = Date.now() + 900

      setIsAiSpeaking(false)
      isAiSpeakingRef.current = false

      const rec = mediaRecorderRef.current
      if (rec && rec.state === "paused" && isCallActiveRef.current && !isMicMutedRef.current) {
        window.setTimeout(() => {
          try {
            rec.resume()
          } catch {}
        }, 260)
      }
    }

    const begin = () => {
      // стопаем прошлое аудио сразу, чтобы не было наложения/“двоения”
      stopTtsAudio()

      setIsAiSpeaking(true)
      isAiSpeakingRef.current = true

      ttsCooldownUntilRef.current = Date.now() + 900

      const hdr = audioChunksRef.current?.[0]
      audioChunksRef.current = hdr ? [hdr] : []
      utterStartIdxRef.current = hdr ? 1 : 0

      pendingSttReasonRef.current = null
      pendingSttStartIdxRef.current = null
      if (pendingSttTimerRef.current) {
        try {
          window.clearTimeout(pendingSttTimerRef.current)
        } catch {}
        pendingSttTimerRef.current = null
      }

      const rec = mediaRecorderRef.current
      if (rec && rec.state === "recording") {
        try {
          rec.pause()
        } catch {}
      }

      const hardTimeoutMs = Math.min(120000, Math.max(30000, cleanText.length * 140))
      clearWatchdog()
      watchdogId = window.setTimeout(() => {
        try {
          const a = ttsAudioRef.current
          if (a) a.pause()
        } catch {}
        finishOnce()
      }, hardTimeoutMs)
    }

    ;(async () => {
      begin()

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
          finishOnce()
          return
        }

        // если пока грузилось — уже пришёл новый TTS, этот игнорируем
        if (seq !== ttsSeqRef.current) return

        const a = ttsAudioRef.current ?? new Audio()
        ;(a as any).playsInline = true
        ;(a as any).preload = "auto"
        ttsAudioRef.current = a

        const ct = (data.contentType || "audio/mpeg") as string
        objectUrl = base64ToObjectUrl(data.audioContent, ct)
        a.src = objectUrl

        a.onended = () => finishOnce()
        a.onerror = () => finishOnce()

        a.onloadedmetadata = () => {
          try {
            const dur = Number(a.duration)
            if (Number.isFinite(dur) && dur > 0) {
              const ms = Math.min(150000, Math.max(25000, Math.floor(dur * 1000) + 8000))
              clearWatchdog()
              watchdogId = window.setTimeout(() => {
                try {
                  a.pause()
                } catch {}
                finishOnce()
              }, ms)
            }
          } catch {}
        }

        try {
          await a.play()
        } catch {
          finishOnce()
        }
      } catch (e) {
        console.error("[TTS] fatal", e)
        finishOnce()
      }
    })()
  }

  async function handleUserText(text: string, langCodeOverride?: string) {
    const voiceLangCode = langCodeOverride || getSessionVoiceLang()
    const agentLang = getSessionAgentLang()

    // если запрос уже идёт — держим только последнюю реплику
    if (isAgentBusyRef.current) {
      pendingUserToAgentRef.current = { text, voiceLang: voiceLangCode }
      return
    }

    isAgentBusyRef.current = true

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
          language: agentLang,
          email: effectiveEmail,
          mode: "voice",
          gender: voiceGenderRef.current,
          voiceLanguage: voiceLangCode,
        }),
      })
if (res.status === 402) {
  window.location.href = "/pricing"
  return
}


      if (!res.ok) throw new Error(`Chat API error: ${res.status}`)

      const raw = await res.text()
      let data: any = raw
      try {
        data = JSON.parse(raw)
      } catch {}

      let answer = extractAnswer(data)
      if (!answer) answer = t("I'm sorry, I couldn't process your message. Please try again.")

      answer = sanitizeAssistantText(answer)

      if (!answer) return
      if (shouldDedupAssistant(answer)) return

      lastAssistantSentNormRef.current = normalizeUtterance(answer)
      lastAssistantSentTsRef.current = Date.now()

      const assistantMsg: VoiceMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: answer,
        gender: voiceGenderRef.current,
      }

      setMessages((prev) => [...prev, assistantMsg])
      speakText(answer, voiceLangCode)
    } catch (e: any) {
      console.error(e)
      setNetworkError(t("Connection error. Please try again."))
      if (onError && e instanceof Error) onError(e)
    } finally {
      isAgentBusyRef.current = false

      const pending = pendingUserToAgentRef.current
      pendingUserToAgentRef.current = null

      if (pending && isCallActiveRef.current) {
        window.setTimeout(() => {
          void handleUserText(pending.text, pending.voiceLang)
        }, 0)
      }
    }
  }

  async function startCall(gender: "female" | "male") {
    voiceGenderRef.current = gender
    setIsConnecting(true)
    setNetworkError(null)

    // фиксируем язык/агент на момент старта сессии
    setSessionLangFromUi()

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setNetworkError(
          t("Microphone access is not supported in this browser. Please use the latest version of Chrome, Edge or Safari."),
        )
        setIsConnecting(false)
        return
      }

      const raw = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } as any,
      })
      rawStreamRef.current = raw

      try {
        const a = new Audio()
        a.muted = true
        ;(a as any).playsInline = true
        ;(a as any).srcObject = raw
        keepAudioElRef.current = a
        await a.play().catch(() => {})
      } catch {}

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

      audioChunksRef.current = []
      utterStartIdxRef.current = 1
      isSttBusyRef.current = false

      lastUserSentNormRef.current = ""
      lastUserSentTsRef.current = 0
      lastAssistantSentNormRef.current = ""
      lastAssistantSentTsRef.current = 0

      pendingUserToAgentRef.current = null
      isAgentBusyRef.current = false

      vad.current = {
        noiseFloor: 0,
        voice: false,
        voiceUntilTs: 0,
        utteranceStartTs: 0,
        voiceOnCount: 0,
      }

      pendingSttReasonRef.current = null
      pendingSttStartIdxRef.current = null
      if (pendingSttTimerRef.current) {
        try {
          window.clearTimeout(pendingSttTimerRef.current)
        } catch {}
        pendingSttTimerRef.current = null
      }

      const mime = pickMime()
      const opts: MediaRecorderOptions = {}
      if (mime) opts.mimeType = mime

      const rec = new MediaRecorder(bridged, opts)
      mediaRecorderRef.current = rec

      rec.onstart = () => setIsListening(true)

      rec.ondataavailable = (ev: BlobEvent) => {
        const b = ev.data
        const size = b?.size || 0

        if (size > 0) {
          if (!isAiSpeakingRef.current && !isMicMutedRef.current) {
            audioChunksRef.current.push(b)
          }
        }

        const pending = pendingSttReasonRef.current
        if (pending) {
          const si = pendingSttStartIdxRef.current ?? utterStartIdxRef.current
          pendingSttReasonRef.current = null
          pendingSttStartIdxRef.current = null
          if (pendingSttTimerRef.current) {
            window.clearTimeout(pendingSttTimerRef.current)
            pendingSttTimerRef.current = null
          }
          void maybeSendStt(pending, si)
        }
      }

      rec.onstop = () => setIsListening(false)
      rec.onerror = (ev: any) => console.error("[REC] error", ev)

      rec.start()
      setIsListening(true)

      const sliceMs = isMobile ? 1200 : 1000
      ;(rec as any)._reqTimer = window.setInterval(() => {
        try {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.requestData()
          }
        } catch {}
      }, sliceMs)

      startVadLoop()

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
    isCallActiveRef.current = false
    setIsCallActive(false)
    setIsListening(false)
    setIsMicMuted(false)
    setIsAiSpeaking(false)
    setNetworkError(null)

    pendingSttReasonRef.current = null
    pendingSttStartIdxRef.current = null
    if (pendingSttTimerRef.current) {
      try {
        window.clearTimeout(pendingSttTimerRef.current)
      } catch {}
      pendingSttTimerRef.current = null
    }

    pendingUserToAgentRef.current = null
    isAgentBusyRef.current = false

    stopRecorder()
    stopKeepAlive()
    stopAudioGraph()
    stopStreams()
    stopTtsAudio()

    audioChunksRef.current = []
    utterStartIdxRef.current = 1

    lastUserSentNormRef.current = ""
    lastUserSentTsRef.current = 0
    lastAssistantSentNormRef.current = ""
    lastAssistantSentTsRef.current = 0
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

  const __props: any = (typeof arguments !== "undefined" ? (arguments as any)[0] : undefined)
  const controlledOpen: boolean | undefined = typeof __props?.open === "boolean" ? __props.open : undefined
  const extOnOpenChange: ((v: boolean) => void) | undefined = typeof __props?.onOpenChange === "function" ? __props.onOpenChange : undefined


  return (
    <Dialog
      open={controlledOpen ?? isOpen}
      onOpenChange={(v) => { extOnOpenChange?.(v); if (!v) { if (typeof onClose === "function") onClose(); } }}
    >
      <DialogContent className="turbota-assistant-dialog left-0 right-0 top-auto bottom-0 translate-x-0 translate-y-0 max-w-xl border-none bg-transparent p-0 sm:left-[50%] sm:top-[50%] sm:right-auto sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 text-white">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                <Phone className="h-4 w-4" />
              </span>
              {t("Voice session with AI companion")}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-indigo-100">
              {t("You can talk out loud, the assistant will listen, answer and voice the reply.")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex h-[500px] flex-col md:h-[540px]">
            <ScrollArea className="flex-1 px-5 pt-4 pb-2">
              <div ref={scrollRef} className="max-h-full space-y-3 pr-1 text-xs md:text-sm">
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
                      <Phone className="h-8 w-8 rotate-[135deg]" />
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
