/**
 * useVideoSession — native video call loop: mic → STT → agent (mode:"video") → TTS → playback.
 *
 * Identical pipeline to useVoiceSession but includes characterId + avatarSlug in
 * the agent payload and sets mode to "video". The avatar animation (idle vs speaking
 * video) is driven by the exposed `phase` field — the UI swaps videos when
 * phase === "speaking".
 *
 * The agent call uses the same buildMessagePayload + sendMessage path as Chat,
 * so userId / sessionId / deviceId / clientMessageId are always included.
 *
 * Diagnostics: diagLog string returned by the hook; shown in the UI debug box.
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { Audio } from "expo-av"
import * as FileSystem from "expo-file-system"
import { sendMessage, extractReplyText, apiFetch } from "@/services/api"
import { buildMessagePayload } from "@/services/messagePayload"
import { generateUUID } from "@/services/storage"
import { useAuth } from "@/hooks/useAuth"
import { API_BASE_URL } from "@/constants/config"
import type { Locale } from "@/constants/i18n"

export type VideoPhase = "idle" | "listening" | "processing" | "speaking" | "error"

// ── Silence-detection tuning (same as voice) ─────────────────────────────────
const SPEECH_DB = -35
const SILENCE_DB = -45
const SILENCE_AFTER_MS = 1500
// Hard fallback: force-submit the recording after this many ms regardless of
// whether silence-detection (metering) fired. Android metering can silently
// return -100 dBFS on some devices, making speechDetected always false and
// leaving the session stuck in "listening" forever.
const MAX_REC_MS = 9_000
const POLL_MS = 150
// Max wait for Audio.Recording.createAsync before releasing lock and retrying.
// Android can hang here after an audio-session mode transition (record→play→record).
const PREPARE_TIMEOUT_MS = 8_000

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
  /** Running diagnostic log — shown in the UI debug box. */
  diagLog: string
  start: () => Promise<void>
  stop: () => Promise<void>
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
  const [diagLog, setDiagLog] = useState("")

  const { user, refreshAccess, decrementTrialLeft } = useAuth()

  /**
   * appendDiag closes over the stable setDiagLog setter (React guarantees
   * setter identity is stable across renders).
   */
  const S = useRef({
    mounted: true,
    active: false,
    processing: false,
    preparing: false,    // lock: prevent parallel Audio.Recording.createAsync calls
    sessionId: "",       // UUID for this call session — set on start()
    recording: null as Audio.Recording | null,
    sound: null as Audio.Sound | null,
    pollTimer: null as ReturnType<typeof setInterval> | null,
    maxTimer: null as ReturnType<typeof setTimeout> | null,
    preparingTimer: null as ReturnType<typeof setTimeout> | null, // timeout-safe lock release
    speechDetected: false,
    silenceAt: 0,
    startListen: async (): Promise<void> => {},
    runTurn: async (): Promise<void> => {},
    // Diagnostic logger — appends a timestamped line to diagLog state
    appendDiag(line: string) {
      if (!S.current.mounted) return
      const ts = new Date().toISOString().slice(11, 23) // HH:mm:ss.mmm
      setDiagLog(prev => {
        const lines = prev.split("\n").filter(Boolean)
        lines.push(`${ts} ${line}`)
        return lines.slice(-12).join("\n")
      })
    },
  })

  useEffect(() => {
    S.current.mounted = true
    return () => {
      // Full teardown on unmount — prevents "Only one Recording can be prepared" on
      // the next screen if the user navigates away while a recording is active.
      const s = S.current
      s.mounted = false
      s.active = false
      s.preparing = false
      if (s.pollTimer)    { clearInterval(s.pollTimer); s.pollTimer = null }
      if (s.maxTimer)     { clearTimeout(s.maxTimer);   s.maxTimer = null  }
      if (s.preparingTimer) { clearTimeout(s.preparingTimer); s.preparingTimer = null }
      const rec = s.recording
      s.recording = null
      if (rec) rec.stopAndUnloadAsync().catch(() => {})
      if (s.sound) {
        s.sound.stopAsync().catch(() => {})
        s.sound.unloadAsync().catch(() => {})
        s.sound = null
      }
    }
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
      s.appendDiag("REC stop — grabbing URI")

      const uri = await grabRecording()
      if (!uri || !s.mounted || !s.active) {
        s.appendDiag("REC: no URI — loop")
        s.processing = false
        if (s.mounted && s.active) s.startListen()
        return
      }
      s.appendDiag("REC done — got URI")

      try {
        // 1. STT
        s.appendDiag("STT → /api/stt")
        const formData = new FormData()
        formData.append("audio", { uri, name: "audio.m4a", type: "audio/m4a" } as any)
        const sttRes = await apiFetch("/api/stt", {
          method: "POST",
          headers: { "X-STT-Lang": sttLang(locale) },
          body: formData,
        })
        s.appendDiag(`STT ← ${sttRes.status}`)
        if (!sttRes.ok) {
          const body = await sttRes.text().catch(() => "")
          throw new Error(`STT ${sttRes.status}: ${body || sttRes.statusText}`)
        }
        const sttData = await sttRes.json()
        const text: string = (sttData?.text || "").toString().trim()

        if (!text || !s.mounted || !s.active) {
          s.appendDiag("STT: empty transcript — loop")
          s.processing = false
          if (s.mounted && s.active) s.startListen()
          return
        }
        s.appendDiag(`STT: "${text.slice(0, 30)}"`)
        setTranscript(text)

        // 2. Agent — mode:"video" with character context, full Chat-compatible payload
        s.appendDiag("AGT → /api/turbotaai-agent")
        const payload = await buildMessagePayload({
          query: text,
          language: locale,
          mode: "video",
          userId: user?.id || null,
          sessionId: s.sessionId,
          email: user?.email,
          gender,
          characterId,
          avatarSlug,
        })
        const agentData = await sendMessage(payload)
        s.appendDiag(`AGT ← ok=${agentData.ok ?? "?"} pay=${!!agentData.paymentRequired}`)

        if (agentData.paymentRequired) {
          s.appendDiag("AGT: ⚠ PAYMENT_REQUIRED → go Account")
          refreshAccess().catch(() => {})
          throw new Error("payment_required")
        }

        // FIX #1: surface agent-side HTTP errors immediately.
        // Without this check, sendMessage's { ok: false, error: "Request failed (502)" }
        // reaches extractReplyText which returns the error string as "reply text",
        // TTS is called with it, and the debug box never shows the real cause.
        if (agentData.ok === false) {
          throw new Error(agentData.error || "Agent request failed")
        }

        const replyText = extractReplyText(agentData)
        // Guard against the extractReplyText fallback "..." so we don't TTS a literal
        // "dot dot dot" when the backend returns an empty/malformed success body.
        if (!replyText || replyText === "..." || !s.mounted || !s.active) {
          s.appendDiag("AGT: empty reply — loop")
          s.processing = false
          if (s.mounted && s.active) s.startListen()
          return
        }
        s.appendDiag(`AGT: "${replyText.slice(0, 30)}"`)
        setReply(replyText)
        // Decrement trial counter — consistent with Chat flow
        decrementTrialLeft()
        // Sync server access state after every turn. Fire-and-forget.
        refreshAccess().catch(() => {})

        // 3. TTS
        s.appendDiag("TTS → /api/tts")
        const ttsRes = await apiFetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: replyText, language: locale, gender }),
        })
        s.appendDiag(`TTS ← ${ttsRes.status}`)
        if (!ttsRes.ok) {
          const body = await ttsRes.text().catch(() => "")
          throw new Error(`TTS ${ttsRes.status}: ${body || ttsRes.statusText}`)
        }
        const ttsData = await ttsRes.json()
        const audioContent: string = ttsData?.audioContent || ""
        const contentType: string = ttsData?.contentType || "audio/wav"

        if (!audioContent || !s.mounted || !s.active) {
          s.appendDiag("TTS: empty audio — loop")
          s.processing = false
          if (s.mounted && s.active) s.startListen()
          return
        }
        s.appendDiag(`TTS: audioLen=${audioContent.length}`)

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
        s.appendDiag("PLAY start")

        // Wait for playback to finish.
        // IMPORTANT: only resolve on didJustFinish (or unload/error).
        // Do NOT resolve on !isPlaying — the first status callback fires before
        // playback actually starts with isPlaying:false, which would resolve
        // the promise immediately and unload the sound before audio plays.
        await new Promise<void>((resolve) => {
          let done = false
          const finish = () => { if (!done) { done = true; resolve() } }
          sound.setOnPlaybackStatusUpdate((st) => {
            if (!st.isLoaded) finish()         // unloaded or error
            else if (st.didJustFinish) finish() // normal completion
          })
          setTimeout(finish, 30_000) // safety timeout
        })

        await sound.unloadAsync().catch(() => {})
        s.sound = null
        await FileSystem.deleteAsync(tmpPath, { idempotent: true }).catch(() => {})
        s.appendDiag("PLAY done")
      } catch (err: any) {
        const msg: string = err?.message || "Video session error"
        s.appendDiag(`ERR: ${msg.slice(0, 60)}`)
        if (s.mounted) {
          setError(msg)
          setPhase("error")
        }
        s.processing = false
        return
      }

      s.processing = false
      s.appendDiag("LOOP")
      if (s.mounted && s.active) s.startListen()
    }

    // ── Listener ──────────────────────────────────────────────────────────────

    async function startListen() {
      if (!s.mounted || !s.active) return
      if (s.preparing) return   // lock: createAsync already in flight

      // Stop any stale recording before creating a new one.
      const staleRec = s.recording
      if (staleRec) {
        s.recording = null
        try { await staleRec.stopAndUnloadAsync() } catch {}
      }
      // Stop any active playback so the audio session can switch to record mode.
      await stopSound()

      s.preparing = true        // acquire lock
      s.speechDetected = false
      s.silenceAt = 0
      s.appendDiag("REC start — createAsync")

      // FIX #2: timeout-safe lock release.
      // On Android, Audio.Recording.createAsync() can hang indefinitely after
      // an audio-session mode transition (playback → recording), keeping
      // s.preparing = true and blocking all future startListen() calls.
      // After PREPARE_TIMEOUT_MS we release the lock and retry.
      s.preparingTimer = setTimeout(() => {
        s.preparingTimer = null
        if (s.preparing) {
          s.preparing = false
          s.appendDiag("WARN: createAsync timed out — retry listen")
          if (s.mounted && s.active) s.startListen()
        }
      }, PREPARE_TIMEOUT_MS)

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        })
        const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS)

        // Clear the timeout — createAsync resolved before the deadline
        if (s.preparingTimer) { clearTimeout(s.preparingTimer); s.preparingTimer = null }
        s.preparing = false     // release lock after successful prepare

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

        // Always submit the recording to STT when the hard timeout fires —
        // even if metering never detected speech. STT will return an empty
        // transcript in that case and the loop restarts. This prevents the
        // session from freezing when Android metering is broken.
        s.maxTimer = setTimeout(() => {
          s.appendDiag("WARN: max record timeout — force stop")
          s.runTurn()
        }, MAX_REC_MS)
      } catch (err: any) {
        if (s.preparingTimer) { clearTimeout(s.preparingTimer); s.preparingTimer = null }
        s.preparing = false   // release lock on error
        const msg: string = err?.message || "Microphone error"
        s.appendDiag(`ERR: ${msg.slice(0, 60)}`)
        if (s.mounted) {
          setError(msg)
          setPhase("error")
        }
      }
    }

    s.startListen = startListen
    s.runTurn = runTurn

    return () => {
      if (s.pollTimer) { clearInterval(s.pollTimer); s.pollTimer = null }
      if (s.maxTimer) { clearTimeout(s.maxTimer); s.maxTimer = null }
    }
  }, [characterId, avatarSlug, gender, locale, user, refreshAccess, decrementTrialLeft])

  // ── Public API ──────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    const s = S.current
    if (s.active) return
    s.active = true
    s.processing = false
    s.preparing = false          // reset lock for fresh session
    s.sessionId = generateUUID() // fresh session ID per call
    setError(null)
    setTranscript("")
    setReply("")
    setDiagLog("")               // clear diagnostics for fresh session
    s.appendDiag(`BASE ${API_BASE_URL || "(not set)"}`)
    await s.startListen()
  }, [])

  const stop = useCallback(async () => {
    const s = S.current
    s.active = false
    s.preparing = false          // reset lock so next session can record
    if (s.pollTimer)    { clearInterval(s.pollTimer); s.pollTimer = null }
    if (s.maxTimer)     { clearTimeout(s.maxTimer);   s.maxTimer = null  }
    if (s.preparingTimer) { clearTimeout(s.preparingTimer); s.preparingTimer = null }
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

  const retryFromError = useCallback(async () => {
    const s = S.current
    if (!s.active) return
    s.processing = false
    s.preparing = false           // reset lock in case it was stuck
    if (s.pollTimer)    { clearInterval(s.pollTimer); s.pollTimer = null }
    if (s.maxTimer)     { clearTimeout(s.maxTimer);   s.maxTimer = null  }
    if (s.preparingTimer) { clearTimeout(s.preparingTimer); s.preparingTimer = null }
    // Stop any stale recording left over from the failed turn.
    const rec = s.recording
    s.recording = null
    if (rec) try { await rec.stopAndUnloadAsync() } catch {}
    setError(null)
    await s.startListen()
  }, [])

  return { phase, transcript, reply, error, diagLog, start, stop, retryFromError }
}
