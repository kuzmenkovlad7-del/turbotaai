/**
 * useVoiceSession — native voice loop: mic → STT → agent → TTS → playback → repeat.
 *
 * Replaces the WebView-based approach. No third-party RTC SDK: uses expo-av for
 * audio capture/playback and the existing /api/stt, /api/turbotaai-agent, /api/tts
 * backend endpoints.
 *
 * Silence detection works by polling expo-av metering every 150 ms.
 * After speech is detected, 1.5 s of continuous silence triggers auto-submit.
 *
 * The agent call uses the same buildMessagePayload + sendMessage path as Chat,
 * so userId / sessionId / deviceId / clientMessageId are always included.
 *
 * Diagnostics: diagLog string returned by the hook; shown in the UI debug box.
 */

import { useEffect, useRef, useState, useCallback } from "react"
import { Audio } from "expo-av"
import * as FileSystem from "expo-file-system"
import { sendMessage, extractReplyText, apiFetch, saveConversation } from "@/services/api"
import { buildMessagePayload } from "@/services/messagePayload"
import { generateUUID } from "@/services/storage"
import { useAuth } from "@/hooks/useAuth"
import { lockForUnload, waitForUnlock } from "@/utils/recordingLock"
import { API_BASE_URL } from "@/constants/config"
import type { Locale } from "@/constants/i18n"

export type VoicePhase = "idle" | "listening" | "processing" | "speaking" | "error"
export type VoiceGender = "female" | "male"

// ── Silence-detection tuning ──────────────────────────────────────────────────
const SPEECH_DB = -35         // dBFS — above this counts as speech
const SILENCE_DB = -45        // dBFS — below this counts as silence
const SILENCE_AFTER_MS = 1500 // ms of silence after speech → auto-submit
const MAX_REC_MS = 60_000     // max single recording (safety cutoff)
const POLL_MS = 150           // metering poll interval
// Max wait for Audio.Recording.createAsync before releasing lock and retrying.
// Android can hang here after an audio-session mode transition (record→play→record).
const PREPARE_TIMEOUT_MS = 8_000

// ── Recording options (metering enabled, 16 kHz mono) ────────────────────────
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

export type UseVoiceSessionReturn = {
  phase: VoicePhase
  transcript: string  // last user speech
  reply: string       // last AI reply text
  error: string | null
  /** Running diagnostic log — shown in the red debug box in the UI. */
  diagLog: string
  start: () => Promise<void>
  stop: () => Promise<void>
  retryFromError: () => Promise<void>
}

export function useVoiceSession(
  gender: VoiceGender,
  locale: Locale,
): UseVoiceSessionReturn {
  const [phase, setPhase] = useState<VoicePhase>("idle")
  const [transcript, setTranscript] = useState("")
  const [reply, setReply] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [diagLog, setDiagLog] = useState("")

  const { user, refreshAccess, decrementTrialLeft } = useAuth()

  /**
   * All mutable session state lives in a single ref to avoid stale-closure
   * problems inside setInterval / setTimeout callbacks.  We also store the
   * two functions that call each other (startListen ↔ runTurn) as ref fields
   * so each can invoke the latest version of the other.
   *
   * appendDiag closes over the stable setDiagLog setter (React guarantees
   * setter identity is stable across renders).
   */
  const S = useRef({
    mounted: true,
    active: false,
    processing: false,
    preparing: false,    // lock: prevent parallel Audio.Recording.createAsync calls
    sessionId: "",       // UUID for this call session — set on start()
    sessionFirstTurn: true, // true until first successful turn is saved to history
    recording: null as Audio.Recording | null,
    sound: null as Audio.Sound | null,
    pollTimer: null as ReturnType<typeof setInterval> | null,
    maxTimer: null as ReturnType<typeof setTimeout> | null,
    preparingTimer: null as ReturnType<typeof setTimeout> | null, // timeout-safe lock release
    speechDetected: false,
    silenceAt: 0,
    // Latest-ref for user — updated on every render so the effect closure always
    // reads current data without needing user in the effect's dependency array.
    user: user,
    // Circular-call refs — set by the useEffect below
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

  // Keep user ref in sync on every render (cheap, no effect re-run).
  S.current.user = user

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
      if (rec) lockForUnload(() => rec.stopAndUnloadAsync().catch(() => {}))
      if (s.sound) {
        s.sound.stopAsync().catch(() => {})
        s.sound.unloadAsync().catch(() => {})
        s.sound = null
      }
    }
  }, [])

  /**
   * Re-create startListen / runTurn whenever dependencies change.
   * Both are stored in S.current so they can reference each other without
   * creating a dependency cycle in React hooks.
   */
  useEffect(() => {
    const s = S.current

    // ── Helpers ──────────────────────────────────────────────────────────────

    function clearTimers() {
      if (s.pollTimer) {
        clearInterval(s.pollTimer)
        s.pollTimer = null
      }
      if (s.maxTimer) {
        clearTimeout(s.maxTimer)
        s.maxTimer = null
      }
    }

    async function stopSound() {
      if (s.sound) {
        try {
          await s.sound.stopAsync()
          await s.sound.unloadAsync()
        } catch {}
        s.sound = null
      }
    }

    async function grabRecording(): Promise<string | null> {
      clearTimers()
      const rec = s.recording
      s.recording = null
      if (!rec) return null
      try {
        await rec.stopAndUnloadAsync()
        return rec.getURI()
      } catch {
        return null
      }
    }

    // ── Turn processor: STT → Agent → TTS → playback ─────────────────────────

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
        // 1. STT — FormData upload (file:// URI, works on iOS + Android)
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
          // Empty / garbage transcript — loop back silently
          s.appendDiag("STT: empty transcript — loop")
          s.processing = false
          if (s.mounted && s.active) s.startListen()
          return
        }
        s.appendDiag(`STT: "${text.slice(0, 30)}"`)
        setTranscript(text)

        // 2. Agent — use same full payload as Chat (userId, sessionId, deviceId, etc.)
        // characterId defaults to "mia" for voice (no character selector in voice mode)
        s.appendDiag("AGT → /api/turbotaai-agent")
        const payload = await buildMessagePayload({
          query: text,
          language: locale,
          mode: "voice",
          userId: s.user?.id || null,
          sessionId: s.sessionId,
          email: s.user?.email,
          gender,
          characterId: "mia",
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

        // Save turn to conversation history — fire-and-forget, same pattern as Chat.
        const isFirstTurn = s.sessionFirstTurn
        s.sessionFirstTurn = false
        saveConversation({
          conversationId: s.sessionId,
          messages: [
            { role: "user", content: text },
            { role: "assistant", content: replyText },
          ],
          mode: "voice",
          title: isFirstTurn ? text.slice(0, 64) : undefined,
        }).catch(() => {})
        // Decrement trial counter here — consistent with Chat flow
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

        // 4. Playback — write base64 to a temp file (data URIs unsupported on Android)
        setPhase("speaking")
        await stopSound()
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        })

        const ext = contentType.includes("wav") ? "wav" : "m4a"
        const tmpPath = `${FileSystem.cacheDirectory}tts_${Date.now()}.${ext}`
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
          const finish = () => {
            if (!done) {
              done = true
              resolve()
            }
          }
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
        const msg: string = err?.message || "Voice session error"
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

    // ── Listener: record + silence detection ─────────────────────────────────

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
        // Wait for any previous screen's recording to finish unloading before
        // calling createAsync — prevents "Only one Recording" across screens.
        await waitForUnlock()
        if (!s.mounted || !s.active) { s.preparing = false; return }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        })
        const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS)

        // Clear the timeout — createAsync resolved before the deadline
        if (s.preparingTimer) { clearTimeout(s.preparingTimer); s.preparingTimer = null }
        s.preparing = false     // release lock after successful prepare

        if (!s.mounted || !s.active) {
          await recording.stopAndUnloadAsync()
          return
        }
        s.recording = recording
        setPhase("listening")

        // Metering poll — silence detection
        s.pollTimer = setInterval(async () => {
          const rec = s.recording
          if (!rec || !s.mounted) {
            clearTimers()
            return
          }
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

        // Safety cutoff
        s.maxTimer = setTimeout(() => {
          if (s.speechDetected) {
            s.runTurn()
          } else {
            // Nothing spoken yet — stop and restart
            grabRecording().then(() => {
              if (s.mounted && s.active) s.startListen()
            })
          }
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

    // Wire up circular refs
    s.startListen = startListen
    s.runTurn = runTurn

    // If deps changed while a session was active but NOT mid-processing (e.g.
    // locale changed), restart listening with the new closures so silence
    // detection picks up the updated locale.
    if (s.active && !s.processing && !s.recording && !s.preparing) {
      startListen()
    }

    // Cleanup: cancel poll/max timers and stop stale recording so the
    // replacement closures (installed by the next effect run) start clean.
    return () => {
      if (s.pollTimer) { clearInterval(s.pollTimer); s.pollTimer = null }
      if (s.maxTimer)  { clearTimeout(s.maxTimer);  s.maxTimer = null  }
      // Stop any recording left from the previous closure so the new startListen
      // can createAsync without hitting the "Only one Recording" error.
      const stale = s.recording
      if (stale) {
        s.recording = null
        lockForUnload(() => stale.stopAndUnloadAsync().catch(() => {}))
      }
    }
  }, [gender, locale, refreshAccess, decrementTrialLeft])

  // ── Public API ──────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    const s = S.current
    if (s.active) return
    s.active = true
    s.processing = false
    s.preparing = false          // reset lock for fresh session
    s.sessionId = generateUUID() // fresh session ID per call
    s.sessionFirstTurn = true     // reset history title flag for each new call
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
    if (rec) lockForUnload(() => rec.stopAndUnloadAsync().catch(() => {}))
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

  /** Restart listening after an error (session stays active) */
  const retryFromError = useCallback(async () => {
    const s = S.current
    if (!s.active) return
    s.processing = false
    s.preparing = false           // reset lock in case it was stuck
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
