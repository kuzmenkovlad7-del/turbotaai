import { useState, useRef, useCallback, useEffect } from "react"
import { Platform } from "react-native"
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition"

export type VoiceState = "idle" | "requesting" | "listening" | "processing" | "error"

/** Minimum transcript length to accept (reject noise/taps) */
const MIN_TRANSCRIPT_LENGTH = 3

/**
 * Hook that wraps expo-speech-recognition for push-to-talk style voice input.
 *
 * Returns live transcript, final transcript, voice state, and start/stop controls.
 */
export function useVoiceRecorder(locale: string) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle")
  const [liveTranscript, setLiveTranscript] = useState("")
  const [finalTranscript, setFinalTranscript] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const activeRef = useRef(false)

  // Map app locale to BCP-47 speech recognition lang
  const sttLang = locale === "uk" ? "uk-UA" : locale === "ru" ? "ru-RU" : "en-US"

  // --- Event handlers ---

  useSpeechRecognitionEvent("start", () => {
    console.log("[VoiceRecorder] recognition started")
    setVoiceState("listening")
    setError(null)
  })

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results?.[0]?.transcript ?? ""
    if (event.isFinal) {
      console.log("[VoiceRecorder] final transcript:", transcript)
      activeRef.current = false
      if (transcript.trim().length < MIN_TRANSCRIPT_LENGTH) {
        // Too short — reject as noise
        setLiveTranscript("")
        setFinalTranscript(null)
        setVoiceState("idle")
        setError("too_short")
        return
      }
      setLiveTranscript(transcript.trim())
      setFinalTranscript(transcript.trim())
      setVoiceState("processing")
    } else {
      setLiveTranscript(transcript)
    }
  })

  useSpeechRecognitionEvent("end", () => {
    console.log("[VoiceRecorder] recognition ended")
    activeRef.current = false
    // Only go idle if we didn't get a final transcript
    setVoiceState((prev) => (prev === "processing" ? prev : "idle"))
  })

  useSpeechRecognitionEvent("error", (event) => {
    console.warn("[VoiceRecorder] error:", event.error, event.message)
    activeRef.current = false
    // "no-speech" is not an error — just means silence
    if (event.error === "no-speech" || event.error === "speech-timeout") {
      setVoiceState("idle")
      setLiveTranscript("")
      return
    }
    setError(event.error)
    setVoiceState("error")
  })

  const startListening = useCallback(async () => {
    if (activeRef.current) return

    setVoiceState("requesting")
    setLiveTranscript("")
    setFinalTranscript(null)
    setError(null)

    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
      if (!granted) {
        setError("not-allowed")
        setVoiceState("error")
        return
      }

      activeRef.current = true
      ExpoSpeechRecognitionModule.start({
        lang: sttLang,
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        addsPunctuation: true,
      })
    } catch (e: any) {
      console.warn("[VoiceRecorder] start error:", e?.message)
      activeRef.current = false
      setError(e?.message ?? "unknown")
      setVoiceState("error")
    }
  }, [sttLang])

  const stopListening = useCallback(() => {
    if (!activeRef.current) return
    try {
      ExpoSpeechRecognitionModule.stop()
    } catch {
      // ignore
    }
  }, [])

  const reset = useCallback(() => {
    setVoiceState("idle")
    setLiveTranscript("")
    setFinalTranscript(null)
    setError(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeRef.current) {
        try { ExpoSpeechRecognitionModule.abort() } catch {}
      }
    }
  }, [])

  return {
    voiceState,
    liveTranscript,
    finalTranscript,
    error,
    startListening,
    stopListening,
    reset,
  }
}
