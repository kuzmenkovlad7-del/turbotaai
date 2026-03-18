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
import { sendMessage, extractReplyText, apiFetch, saveConversation } from "@/services/api"
import { buildMessagePayload } from "@/services/messagePayload"
import { generateUUID } from "@/services/storage"
import { useAuth } from "@/hooks/useAuth"
import { lockForUnload, waitForUnlock } from "@/utils/recordingLock"
import { isMostlyGarbage } from "@/utils/sttGuard"
import { API_BASE_URL } from "@/constants/config"
import type { Locale } from "@/constants/i18n"

export type VideoPhase = "idle" | "listening" | "processing" | "speaking" | "error"
export type VideoTurn = { role: "user" | "assistant"; text: string; ts: number }

// ── Silence-detection tuning (same as voice) ─────────────────────────────────
const SPEECH_DB = -35
const SILENCE_DB = -45
const SILENCE_AFTER_MS = 3500
// Hard fallback: force-submit the recording after this many ms regardless of
// whether silence-detection (metering) fired. Android metering can silently
// return -100 dBFS on some devices, making speechDetected always false and
// leaving the session stuck in "listening" forever.
const MAX_REC_MS = 9_000
const POLL_MS = 150
// Max wait for Audio.Recording.createAsync before releasing lock and retrying.
// Android can hang here after an audio-session mode transition (record→play→record).
const PREPARE_TIMEOUT_MS = 8_000
// Minimum voiced polling frames required before sending audio to STT.
// At POLL_MS=150 this is ≈300 ms of metered speech above SPEECH_DB,
// which mirrors the web VAD's MIN_UTTERANCE_MS=250 ms threshold.
// Keeps the Android max-timer fallback intact (meteringActive=false path).
// Reduced from 2 → 1 so crisp short phrases like "Привет" (single voiced
// frame, ~150 ms) are no longer discarded. isMostlyGarbage() still guards
// against Whisper hallucinations on real silence.
const MIN_SPEECH_FRAMES = 1

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

/**
 * Split a TTS text into sentence-boundary chunks of at most maxLen chars,
 * then merge consecutive very-short chunks (< 80 chars) into their neighbour
 * to reduce the number of TTS round-trips without losing sentence boundaries.
 * Splitting at sentence endings lets each chunk be synthesized and played
 * immediately, so the first audio starts after ~300–600 ms instead of
 * waiting for the full reply to be synthesized (~10 s for long responses).
 */
function splitTtsChunks(text: string, maxLen = 200): string[] {
  if (text.length <= maxLen) return [text]
  const parts: string[] = []
  let rem = text
  while (rem.length > maxLen) {
    const head = rem.slice(0, maxLen)
    const m = head.match(/^[\s\S]*[.!?](?:\s|$)/)
    const cut = m ? m[0].length : maxLen
    parts.push(rem.slice(0, cut).trim())
    rem = rem.slice(cut).trim()
  }
  if (rem) parts.push(rem)
  const raw = parts.filter(Boolean)
  // Merge short preceding chunks (< 80 chars) forward into the next chunk
  // to cut round-trips for sentences like "Да." / "Хорошо." / "I see.".
  const merged: string[] = []
  for (const part of raw) {
    const last = merged.length - 1
    if (last >= 0 && merged[last].length < 80 && merged[last].length + 1 + part.length <= maxLen) {
      merged[last] = merged[last] + " " + part
    } else {
      merged.push(part)
    }
  }
  return merged
}

function sttLang(locale: Locale): string {
  if (locale === "uk") return "uk"
  if (locale === "ru") return "ru"
  return "en"
}

export type UseVideoSessionReturn = {
  phase: VideoPhase
  /** Full conversation history as ordered turns — use this to render the transcript. */
  turns: VideoTurn[]
  /** Last user speech text (kept for backwards compat). */
  transcript: string
  /** Last AI reply text (kept for backwards compat). */
  reply: string
  error: string | null
  /** Running diagnostic log — shown in the UI debug box. */
  diagLog: string
  /**
   * Manually trigger stop-and-send (for toggle-button UX on Android where
   * silence detection / metering can be unreliable).
   */
  manualStop: () => void
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
  const [turns, setTurns] = useState<VideoTurn[]>([])
  const [error, setError] = useState<string | null>(null)
  const [diagLog, setDiagLog] = useState("")

  const { user, refreshAccess, decrementTrialLeft } = useAuth()
  // Keep user in a ref so the effect closure always reads the latest value
  // without needing to re-run the effect (which would interrupt recordings).
  const userRef = useRef(user)
  userRef.current = user

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
    sessionFirstTurn: true, // true until first successful turn is saved to history
    recording: null as Audio.Recording | null,
    sound: null as Audio.Sound | null,
    pollTimer: null as ReturnType<typeof setInterval> | null,
    maxTimer: null as ReturnType<typeof setTimeout> | null,
    preparingTimer: null as ReturnType<typeof setTimeout> | null, // timeout-safe lock release
    speechDetected: false,
    silenceAt: 0,
    speechFrameCount: 0,   // voiced frames (db > SPEECH_DB) in current recording
    meteringActive: false, // true once any db reading > -99 dBFS is received
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

  // Keep S.current.user-equivalent via userRef — effect closure reads userRef.current

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

      // ── Real-speech gate ─────────────────────────────────────────────────
      // Mirrors the web's onFramesNeeded + MIN_UTTERANCE_MS model.
      // If metering gave us real readings (not the Android -100 dBFS broken
      // path) but accumulated fewer than MIN_SPEECH_FRAMES voiced frames, the
      // recording is silence or ambient noise — skip STT and restart.
      // Falls through when meteringActive=false (Android metering broken) so
      // the existing max-timer Android fallback is fully preserved.
      if (s.meteringActive && s.speechFrameCount < MIN_SPEECH_FRAMES) {
        s.appendDiag(`STT: gate — ${s.speechFrameCount} voiced frame(s) — loop`)
        s.processing = false
        if (s.mounted && s.active) s.startListen()
        return
      }

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
        // Junk / hallucination guard — mirrors web isMostlyGarbage().
        if (isMostlyGarbage(text)) {
          s.appendDiag(`STT: junk — loop ("${text.slice(0, 30)}")`)
          s.processing = false
          if (s.mounted && s.active) s.startListen()
          return
        }
        s.appendDiag(`STT: "${text.slice(0, 30)}"`)
        setTranscript(text)
        setTurns(prev => [...prev, { role: "user" as const, text, ts: Date.now() }])

        // 2. Agent — mode:"video" with character context, full Chat-compatible payload
        // Use avatarSlug as characterId (slug form: "mia"/"alex"/"leo") — matches WEB
        s.appendDiag("AGT → /api/turbotaai-agent")
        const u = userRef.current
        const payload = await buildMessagePayload({
          query: text,
          language: locale,
          mode: "video",
          userId: u?.id || null,
          sessionId: s.sessionId,
          email: u?.email,
          gender,
          characterId: avatarSlug,
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
        // Guard: empty or "..." fallback means the backend returned no usable text.
        // Surface as an error (so the user sees a retry button) rather than silently
        // looping back to listening — a silent loop causes the session to stay stuck
        // in "listening" forever and can produce phantom transcripts when TTS audio
        // from a previous turn is re-captured by the microphone.
        if (!replyText || replyText === "...") {
          s.appendDiag("AGT: empty reply — error")
          s.processing = false
          if (s.mounted) {
            setError("empty_reply")
            setPhase("error")
          }
          return
        }
        if (!s.mounted || !s.active) {
          s.processing = false
          return
        }
        s.appendDiag(`AGT: "${replyText.slice(0, 30)}"`)
        setReply(replyText)
        setTurns(prev => [...prev, { role: "assistant" as const, text: replyText, ts: Date.now() }])

        // Save turn to conversation history — fire-and-forget, same pattern as voice/chat.
        const isFirstTurn = s.sessionFirstTurn
        s.sessionFirstTurn = false
        saveConversation({
          conversationId: s.sessionId,
          messages: [
            { role: "user", content: text },
            { role: "assistant", content: replyText },
          ],
          mode: "video",
          title: isFirstTurn ? text.slice(0, 64) : undefined,
        }).catch(() => {})
        // Decrement trial counter — consistent with Chat flow
        decrementTrialLeft()
        // Sync server access state after every turn. Fire-and-forget.
        refreshAccess().catch(() => {})

        // 3. TTS + playback — sentence-chunked look-ahead pipeline.
        // Split the reply into ≤200-char sentence chunks so the first chunk
        // can be synthesized and played immediately (~300–600 ms) rather than
        // waiting for the full reply to be synthesized (~10 s for long text).
        const ttsChunks = splitTtsChunks(replyText)
        s.appendDiag(`TTS → ${ttsChunks.length} chunk(s)`)

        // Helper: fetch one TTS chunk, returns { audioContent, contentType }.
        type TtsResult = { audioContent: string; contentType: string }
        async function fetchTtsChunk(chunkText: string): Promise<TtsResult> {
          const ttsRes = await apiFetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: chunkText, language: locale, gender }),
          })
          if (!ttsRes.ok) {
            const errBody = await ttsRes.text().catch(() => "")
            throw new Error(`TTS ${ttsRes.status}: ${errBody || ttsRes.statusText}`)
          }
          const ttsData = await ttsRes.json()
          return {
            audioContent: ttsData?.audioContent || "",
            contentType: ttsData?.contentType || "audio/wav",
          }
        }

        // 4. Playback — set audio mode once before the chunk loop.
        // NOTE: setPhase("speaking") is deferred to the exact moment the first
        // chunk's audio starts (after createAsync) so the avatar animation is
        // synced with actual sound, not with the TTS fetch / file-write steps.
        await stopSound()
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        })

        // Pre-fetch chunk[0] immediately — runs while audio mode is being set above,
        // eliminating the first-chunk fetch latency from the perceived start time.
        let nextFetch: Promise<TtsResult | null> = (s.mounted && s.active && ttsChunks.length > 0)
          ? fetchTtsChunk(ttsChunks[0]).catch(() => null)
          : Promise.resolve(null)

        let playedAny = false
        for (let ci = 0; ci < ttsChunks.length; ci++) {
          if (!s.mounted || !s.active) break

          // Await the pre-fetched result for this chunk.
          const fetched = await nextFetch

          // Immediately kick off the NEXT chunk's fetch so it runs in parallel
          // with writing + loading + playing the current chunk.
          // This reduces inter-sentence gap from ~1.5 s to ~150 ms (write+load time).
          nextFetch = (ci + 1 < ttsChunks.length && s.mounted && s.active)
            ? fetchTtsChunk(ttsChunks[ci + 1]).catch(() => null)
            : Promise.resolve(null)

          if (!fetched) continue
          const { audioContent, contentType } = fetched
          if (!audioContent || !s.mounted || !s.active) continue

          const ext = contentType.includes("wav") ? "wav" : "m4a"
          const tmpPath = `${FileSystem.cacheDirectory}vid_tts_${Date.now()}_${ci}.${ext}`
          await FileSystem.writeAsStringAsync(tmpPath, audioContent, {
            encoding: FileSystem.EncodingType.Base64,
          })

          const { sound } = await Audio.Sound.createAsync(
            { uri: tmpPath },
            { shouldPlay: true },
          )
          s.sound = sound
          if (ci === 0) {
            // Switch avatar to speaking only when the FIRST chunk's audio is loaded
            // and playback has been initiated by createAsync({shouldPlay:true}).
            // This eliminates the ~500–700 ms head-start where the avatar mouth
            // moved before any sound was audible.
            setPhase("speaking")
            s.appendDiag("PLAY start")
          }

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
            // Safety timeout: estimate from base64 length (~5333 chars/sec at 32kbps AAC)
            const safetyMs = Math.min(180_000, Math.max(30_000, Math.ceil(audioContent.length / 5.3) + 10_000))
            setTimeout(finish, safetyMs)
          })

          await sound.unloadAsync().catch(() => {})
          s.sound = null
          await FileSystem.deleteAsync(tmpPath, { idempotent: true }).catch(() => {})
          playedAny = true
        }

        // Stop avatar speaking animation immediately when the last chunk ends —
        // don't let the mouth keep moving through the post-TTS cooldown delay.
        if (s.mounted) setPhase("processing")

        if (!playedAny || !s.mounted || !s.active) {
          s.appendDiag("TTS: no audio played — loop")
          s.processing = false
          if (s.mounted && s.active) s.startListen()
          return
        }
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
      // Post-TTS cooldown — mirrors the web's 400 ms ttsCooldownUntilRef.
      // Lets the audio hardware and OS echo-canceller settle before the mic
      // reopens; prevents TTS speaker output from being captured and
      // transcribed as phantom user speech (e.g. "Субтитры предоставил …").
      await new Promise<void>(r => setTimeout(r, 350))
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
      s.speechFrameCount = 0
      s.meteringActive = false
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
        // Wait for any previous recording to finish unloading before calling
        // createAsync — prevents "Only one Recording" across voice/video screens.
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
            if (db > -99) s.meteringActive = true // real reading — not the Android -100 broken path

            if (db > SPEECH_DB) {
              s.speechDetected = true
              s.speechFrameCount++
              s.silenceAt = 0
            } else if (db >= SILENCE_DB && !s.speechDetected) {
              // Gray zone BEFORE speech: audible but sub-threshold — keep silence
              // clock cleared so ambient noise / breathing before the user starts
              // speaking does not pre-arm the submit timer.
              s.silenceAt = 0
            } else if (s.speechDetected) {
              // Below SPEECH_DB after speech was detected — treat as silence.
              // Crucially this includes the gray zone (-45 to -35 dBFS): without
              // this, room noise after a short word like "Привет" or "Да" keeps
              // silenceAt at 0 forever and auto-submit never fires.
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
  }, [characterId, avatarSlug, gender, locale, refreshAccess, decrementTrialLeft])

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
    setTurns([])
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

  /**
   * Manually trigger a stop-and-send. Use for a toggle-button UX on Android
   * where silence detection may not fire reliably.
   */
  const manualStop = useCallback(() => {
    const s = S.current
    if (!s.active || s.processing || !s.recording) return
    s.appendDiag("MANUAL stop → runTurn")
    if (s.pollTimer) { clearInterval(s.pollTimer); s.pollTimer = null }
    if (s.maxTimer)  { clearTimeout(s.maxTimer);   s.maxTimer = null  }
    s.runTurn()
  }, [])

  return { phase, turns, transcript, reply, error, diagLog, manualStop, start, stop, retryFromError }
}
