/**
 * useVideoSession — native video call loop: mic → STT → agent (mode:"video") → TTS → playback.
 *
 * Identical pipeline to useVoiceSession but includes characterId + avatarSlug in
 * the agent payload and sets mode to "video". The avatar animation (idle vs speaking
 * video) is driven by the exposed `phase` field — the UI swaps videos when
 * phase === "speaking".
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { Audio } from "expo-av"
import * as FileSystem from "expo-file-system"
import { apiFetch } from "@/services/api"
import type { Locale } from "@/constants/i18n"

export type VideoPhase = "idle" | "listening" | "processing" | "speaking" | "error"

// ── Silence-detection tuning (same as voice) ─────────────────────────────────
const SPEECH_DB = -35
const SILENCE_DB = -45
const SILENCE_AFTER_MS = 1500
const MAX_REC_MS = 60_000
const POLL_MS = 150

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: ".m4a",
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: ".m4a",
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  web: {},
  isMeteringEnabled: true,
}

function sttLang(locale: Locale): string {
  if (locale === "uk") return "uk"
  if (locale === "ru") return "ru"
  return "en"
}

export type UseVideoSessionReturn = {
  phase: VideoPhase
  transcript: string
  reply: string
  error: string | null
  start: () => Promise<void>
  stop: () => Promise<void>
  sendNow: () => void
  retryFromError: () => Promise<void>
}

export function useVideoSession(
  characterId: string,   // "dr-maria" | "dr-sophia" | "dr-alexander"
  avatarSlug: string,    // "mia" | "alex" | "leo"
  gender: "female" | "male",
  locale: Locale,
): UseVideoSessionReturn {
  const [phase, setPhase] = useState<VideoPhase>("idle")
  const [transcript, setTranscript] = useState("")
  const [reply, setReply] = useState("")
  const [error, setError] = useState<string | null>(null)

  const S = useRef({
    mounted: true,
    active: false,
    processing: false,
    recording: null as Audio.Recording | null,
    sound: null as Audio.Sound | null,
    pollTimer: null as ReturnType<typeof setInterval> | null,
    maxTimer: null as ReturnType<typeof setTimeout> | null,
    speechDetected: false,
    silenceAt: 0,
    startListen: async (): Promise<void> => {},
    runTurn: async (): Promise<void> => {},
  })

  useEffect(() => {
    S.current.mounted = true
    return () => { S.current.mounted = false }
  }, [])

  useEffect(() => {
    const s = S.current

    function clearTimers() {
      if (s.pollTimer) { clearInterval(s.pollTimer); s.pollTimer = null }
      if (s.maxTimer) { clearTimeout(s.maxTimer); s.maxTimer = null }
    }

    async function stopSound() {
      if (s.sound) {
        try { await s.sound.stopAsync(); await s.sound.unloadAsync() } catch {}
        s.sound = null
      }
    }

    async function grabRecording(): Promise<string | null> {
      clearTimers()
      const rec = s.recording
      s.recording = null
      if (!rec) return null
      try { await rec.stopAndUnloadAsync(); return rec.getURI() } catch { return null }
    }

    // ── Turn processor ────────────────────────────────────────────────────────

    async function runTurn() {
      if (s.processing || !s.mounted || !s.active) return
      s.processing = true
      setPhase("processing")

      const uri = await grabRecording()
      if (!uri || !s.mounted || !s.active) {
        s.processing = false
        if (s.mounted && s.active) s.startListen()
        return
      }

      try {
        // 1. STT
        const formData = new FormData()
        formData.append("audio", { uri, name: "audio.m4a", type: "audio/m4a" } as any)
        const sttRes = await apiFetch("/api/stt", {
          method: "POST",
          headers: { "X-STT-Lang": sttLang(locale) },
          body: formData,
        })
        if (!sttRes.ok) throw new Error(`STT error (${sttRes.status})`)
        const sttData = await sttRes.json()
        const text: string = (sttData?.text || "").toString().trim()

        if (!text || !s.mounted || !s.active) {
          s.processing = false
          if (s.mounted && s.active) s.startListen()
          return
        }
        setTranscript(text)

        // 2. Agent (mode:"video" with character context)
        const agentRes = await apiFetch("/api/turbotaai-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            language: locale,
            mode: "video",
            gender: gender === "female" ? "FEMALE" : "MALE",
            characterId,
            avatarSlug,
          }),
        })
        if (!agentRes.ok) {
          if (agentRes.status === 402) throw new Error("payment_required")
          throw new Error(`Agent error (${agentRes.status})`)
        }
        const agentData = await agentRes.json()
        const replyText: string = (
          agentData?.output ||
          agentData?.text ||
          agentData?.response ||
          agentData?.message ||
          ""
        ).toString().trim()

        if (!replyText || !s.mounted || !s.active) {
          s.processing = false
          if (s.mounted && s.active) s.startListen()
          return
        }
        setReply(replyText)

        // 3. TTS
        const ttsRes = await apiFetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: replyText, language: locale, gender }),
        })
        if (!ttsRes.ok) throw new Error(`TTS error (${ttsRes.status})`)
        const ttsData = await ttsRes.json()
        const audioContent: string = ttsData?.audioContent || ""
        const contentType: string = ttsData?.contentType || "audio/wav"

        if (!audioContent || !s.mounted || !s.active) {
          s.processing = false
          if (s.mounted && s.active) s.startListen()
          return
        }

        // 4. Playback — phase "speaking" triggers the avatar speaking video in the UI
        setPhase("speaking")
        await stopSound()
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        })

        const ext = contentType.includes("wav") ? "wav" : "m4a"
        const tmpPath = `${FileSystem.cacheDirectory}vid_tts_${Date.now()}.${ext}`
        await FileSystem.writeAsStringAsync(tmpPath, audioContent, {
          encoding: FileSystem.EncodingType.Base64,
        })

        const { sound } = await Audio.Sound.createAsync(
          { uri: tmpPath },
          { shouldPlay: true },
        )
        s.sound = sound

        await new Promise<void>((resolve) => {
          let done = false
          const finish = () => { if (!done) { done = true; resolve() } }
          sound.setOnPlaybackStatusUpdate((st) => {
            if (!st.isLoaded || st.didJustFinish || !st.isPlaying) finish()
          })
          setTimeout(finish, 30_000)
        })

        await sound.unloadAsync().catch(() => {})
        s.sound = null
        await FileSystem.deleteAsync(tmpPath, { idempotent: true }).catch(() => {})
      } catch (err: any) {
        if (s.mounted) {
          setError(err?.message || "Video session error")
          setPhase("error")
        }
        s.processing = false
        return
      }

      s.processing = false
      if (s.mounted && s.active) s.startListen()
    }

    // ── Listener ──────────────────────────────────────────────────────────────

    async function startListen() {
      if (!s.mounted || !s.active) return
      s.speechDetected = false
      s.silenceAt = 0

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        })
        const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS)
        if (!s.mounted || !s.active) { await recording.stopAndUnloadAsync(); return }
        s.recording = recording
        setPhase("listening")

        s.pollTimer = setInterval(async () => {
          const rec = s.recording
          if (!rec || !s.mounted) { clearTimers(); return }
          try {
            const status = await rec.getStatusAsync()
            if (!status.isRecording) return
            const db: number = (status as any).metering ?? -100

            if (db > SPEECH_DB) {
              s.speechDetected = true
              s.silenceAt = 0
            } else if (s.speechDetected && db < SILENCE_DB) {
              if (s.silenceAt === 0) s.silenceAt = Date.now()
              if (Date.now() - s.silenceAt >= SILENCE_AFTER_MS) {
                clearTimers()
                s.runTurn()
              }
            }
          } catch {}
        }, POLL_MS)

        s.maxTimer = setTimeout(() => {
          if (s.speechDetected) {
            s.runTurn()
          } else {
            grabRecording().then(() => {
              if (s.mounted && s.active) s.startListen()
            })
          }
        }, MAX_REC_MS)
      } catch (err: any) {
        if (s.mounted) {
          setError(err?.message || "Microphone error")
          setPhase("error")
        }
      }
    }

    s.startListen = startListen
    s.runTurn = runTurn
  }, [characterId, avatarSlug, gender, locale])

  // ── Public API ──────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    const s = S.current
    if (s.active) return
    s.active = true
    s.processing = false
    setError(null)
    setTranscript("")
    setReply("")
    await s.startListen()
  }, [])

  const stop = useCallback(async () => {
    const s = S.current
    s.active = false
    if (s.pollTimer) { clearInterval(s.pollTimer); s.pollTimer = null }
    if (s.maxTimer) { clearTimeout(s.maxTimer); s.maxTimer = null }
    const rec = s.recording
    s.recording = null
    if (rec) try { await rec.stopAndUnloadAsync() } catch {}
    if (s.sound) {
      try { await s.sound.stopAsync(); await s.sound.unloadAsync() } catch {}
      s.sound = null
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
    }).catch(() => {})
    if (s.mounted) setPhase("idle")
  }, [])

  const sendNow = useCallback(() => {
    const s = S.current
    if (s.pollTimer) { clearInterval(s.pollTimer); s.pollTimer = null }
    if (s.maxTimer) { clearTimeout(s.maxTimer); s.maxTimer = null }
    s.runTurn()
  }, [])

  const retryFromError = useCallback(async () => {
    const s = S.current
    if (!s.active) return
    s.processing = false
    setError(null)
    await s.startListen()
  }, [])

  return { phase, transcript, reply, error, start, stop, sendNow, retryFromError }
}
