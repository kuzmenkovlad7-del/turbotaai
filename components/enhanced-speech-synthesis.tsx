"use client"

import { useCallback, useRef, useEffect, useState } from "react"
import { ensureAudioUnlocked } from "@/lib/audio/unlock-audio"


interface EnhancedSpeechSynthesisProps {
  onSpeechStart?: () => void
  onSpeechEnd?: () => void
  onSpeechError?: (error: string) => void
}

interface VoiceConfig {
  language: string
  gender: "male" | "female"
  rate: number
  pitch: number
  volume: number
}

interface SpeechRequest {
  text: string
  config: VoiceConfig
  resolve: () => void
  reject: (error: Error) => void
  retryCount: number
}

export function useEnhancedSpeechSynthesis({
  onSpeechStart,
  onSpeechEnd,
  onSpeechError,
}: EnhancedSpeechSynthesisProps = {}) {
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const voiceCacheRef = useRef<Map<string, SpeechSynthesisVoice>>(new Map())
  const isInitializedRef = useRef(false)
  const speechQueueRef = useRef<SpeechRequest[]>([])
  const isProcessingRef = useRef(false)
  const lastSpeechTimeRef = useRef(0)
  const [isSpeechReady, setIsSpeechReady] = useState(false)

  const MAX_RETRIES = 3
  const SPEECH_DELAY = 200 // Minimum delay between speech requests
  const RETRY_DELAY = 500 // Delay before retry

  // Premium voice configurations for different languages
  const VOICE_CONFIGS: Record<string, Record<string, string[]>> = {
    en: {
      female: [
        "Google US English Female",
        "Microsoft Zira",
        "Samantha",
        "Karen",
        "Moira",
        "Tessa",
        "Victoria",
        "Google UK English Female",
      ],
      male: ["Google US English Male", "Microsoft David", "Alex", "Daniel", "Tom", "Oliver", "Google UK English Male"],
    },
    ru: {
      female: ["Google русский (female)", "Microsoft Irina", "Milena", "Katya", "Elena", "Oksana", "Google русский"],
      male: ["Google русский (male)", "Microsoft Pavel", "Dmitry", "Maxim", "Aleksandr", "Sergey", "Google русский"],
    },
    uk: {
      female: [
        "Google українська (female)",
        "Google українська",
        "Ukrainian Female",
        "Google русский (female)",
        "Microsoft Irina",
      ],
      male: [
        "Google українська (male)",
        "Google українська",
        "Ukrainian Male",
        "Google русский (male)",
        "Microsoft Pavel",
      ],
    },
  }

  // Initialize speech synthesis with better error handling
  const initializeSpeechSynthesis = useCallback(() => {
    if (!window.speechSynthesis || isInitializedRef.current) return

    const loadVoices = () => {
      try {
        const voices = window.speechSynthesis.getVoices()
        if (voices.length > 0) {
          console.log(`Loaded ${voices.length} voices for enhanced speech synthesis`)
          isInitializedRef.current = true
          setIsSpeechReady(true)

          // Cache high-quality voices
          voices.forEach((voice) => {
            const key = `${voice.lang}-${voice.name}`
            voiceCacheRef.current.set(key, voice)
          })

          // Test speech synthesis with a silent utterance
          const testUtterance = new SpeechSynthesisUtterance("")
          testUtterance.volume = 0
          testUtterance.rate = 1
          testUtterance.pitch = 1

          testUtterance.onend = () => {
            console.log("Speech synthesis test completed successfully")
          }

          testUtterance.onerror = (event) => {
            console.warn("Speech synthesis test failed:", event.error)
          }

          ensureAudioUnlocked().catch(() => {})

          window.speechSynthesis.speak(testUtterance)
          setTimeout(() => window.speechSynthesis.cancel(), 100)
        }
      } catch (error) {
        console.error("Error loading voices:", error)
        setIsSpeechReady(false)
      }
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices

    // Handle speech synthesis events
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && window.speechSynthesis.speaking) {
        console.log("Page hidden, pausing speech")
        window.speechSynthesis.pause()
      } else if (!document.hidden && window.speechSynthesis.paused) {
        console.log("Page visible, resuming speech")
        window.speechSynthesis.resume()
      }
    })
  }, [])

  // Find the best voice for given configuration
  const findBestVoice = useCallback((config: VoiceConfig): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices()
    if (voices.length === 0) return null

    const voiceOptions = VOICE_CONFIGS[config.language]?.[config.gender] || VOICE_CONFIGS.en[config.gender]

    // Try to find exact matches first
    for (const voiceName of voiceOptions) {
      const voice = voices.find((v) => v.name === voiceName)
      if (voice) {
        console.log(`Found exact voice match: ${voice.name}`)
        return voice
      }
    }

    // Try partial matches
    for (const voiceName of voiceOptions) {
      const voice = voices.find(
        (v) =>
          v.name.includes(voiceName) ||
          voiceName.includes(v.name) ||
          v.name.toLowerCase().includes(voiceName.toLowerCase()),
      )
      if (voice) {
        console.log(`Found partial voice match: ${voice.name}`)
        return voice
      }
    }

    // Language-based fallback
    const langPrefix = config.language === "uk" ? "uk" : config.language === "ru" ? "ru" : "en"
    const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix))

    if (langVoices.length > 0) {
      const sortedVoices = langVoices.sort((a, b) => {
        let scoreA = 0,
          scoreB = 0

        if (!a.default) scoreA += 10
        if (!b.default) scoreB += 10

        if (a.localService) scoreA += 5
        if (b.localService) scoreB += 5

        const genderHints =
          config.gender === "female"
            ? ["female", "woman", "zira", "irina", "samantha"]
            : ["male", "man", "david", "pavel", "alex"]

        if (genderHints.some((hint) => a.name.toLowerCase().includes(hint))) scoreA += 15
        if (genderHints.some((hint) => b.name.toLowerCase().includes(hint))) scoreB += 15

        return scoreB - scoreA
      })

      console.log(`Using language fallback voice: ${sortedVoices[0].name}`)
      return sortedVoices[0]
    }

    console.log(`Using default voice: ${voices[0].name}`)
    return voices[0]
  }, [])

  // Process speech queue
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || speechQueueRef.current.length === 0) return

    isProcessingRef.current = true
    const request = speechQueueRef.current.shift()!

    try {
      await speakInternal(request)
      request.resolve()
    } catch (error) {
      if (request.retryCount < MAX_RETRIES) {
        console.log(`Retrying speech (attempt ${request.retryCount + 1}/${MAX_RETRIES})`)
        request.retryCount++

        // Add delay before retry
        setTimeout(() => {
          speechQueueRef.current.unshift(request)
          isProcessingRef.current = false
          processQueue()
        }, RETRY_DELAY)
        return
      } else {
        request.reject(error as Error)
      }
    }

    isProcessingRef.current = false

    // Process next item in queue after a short delay
    if (speechQueueRef.current.length > 0) {
      setTimeout(processQueue, SPEECH_DELAY)
    }
  }, [])

  // Internal speak function with better error handling
  const speakInternal = useCallback(
    (request: SpeechRequest): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!window.speechSynthesis || !isSpeechReady) {
          reject(new Error("Speech synthesis not ready"))
          return
        }

        const { text, config } = request
        const cleanText = text.replace(/\*\*/g, "").replace(/\n+/g, " ").trim().substring(0, 500)

        if (!cleanText) {
          resolve()
          return
        }

        // Ensure previous speech is completely stopped
        if (currentUtteranceRef.current) {
          window.speechSynthesis.cancel()
          currentUtteranceRef.current = null
        }

        // Wait for speech synthesis to be ready
        const waitForReady = () => {
          if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            setTimeout(waitForReady, 50)
            return
          }

          try {
            const utterance = new SpeechSynthesisUtterance(cleanText)
            currentUtteranceRef.current = utterance

            // Find and set the best voice
            const voice = findBestVoice(config)
            if (voice) {
              utterance.voice = voice
            }

            // Set language and speech parameters
            const locale = config.language === "uk" ? "uk-UA" : config.language === "ru" ? "ru-RU" : "en-US"
            utterance.lang = locale
            utterance.rate = Math.max(0.1, Math.min(2.0, config.rate))
            utterance.pitch = Math.max(0.1, Math.min(2.0, config.pitch))
            utterance.volume = Math.max(0.1, Math.min(1.0, config.volume))

            let hasStarted = false
            let hasEnded = false

            // Set up event handlers
            utterance.onstart = () => {
              if (hasEnded) return
              hasStarted = true
              console.log("Enhanced speech synthesis started")
              onSpeechStart?.()
            }

            utterance.onend = () => {
              if (hasEnded) return
              hasEnded = true
              console.log("Enhanced speech synthesis ended")
              currentUtteranceRef.current = null
              onSpeechEnd?.()
              resolve()
            }

            utterance.onerror = (event) => {
              if (hasEnded) return
              hasEnded = true

              const errorMsg = `Speech synthesis error: ${event.error}`
              console.error(errorMsg, event)

              currentUtteranceRef.current = null

              // Handle specific error types
              if (event.error === "interrupted") {
                // Don't treat interruption as a fatal error for retries
                console.log("Speech was interrupted, will retry")
                onSpeechEnd?.()
                reject(new Error("interrupted"))
              } else if (event.error === "network") {
                onSpeechError?.("Network error during speech synthesis")
                reject(new Error("network"))
              } else {
                onSpeechError?.(errorMsg)
                reject(new Error(event.error))
              }
            }

            // Safety timeout
            const timeoutId = setTimeout(
              () => {
                if (currentUtteranceRef.current === utterance && !hasEnded) {
                  console.warn("Speech synthesis timeout, canceling")
                  hasEnded = true
                  window.speechSynthesis.cancel()
                  currentUtteranceRef.current = null
                  onSpeechEnd?.()
                  resolve()
                }
              },
              Math.max(15000, cleanText.length * 150),
            )

            // Start speaking
            window.speechSynthesis.speak(utterance)

            // Backup timeout in case onstart never fires
            setTimeout(() => {
              if (!hasStarted && !hasEnded) {
                console.warn("Speech didn't start within expected time")
                hasEnded = true
                clearTimeout(timeoutId)
                reject(new Error("Speech failed to start"))
              }
            }, 3000)
          } catch (error) {
            console.error("Speech synthesis setup error:", error)
            reject(error as Error)
          }
        }

        waitForReady()
      })
    },
    [findBestVoice, onSpeechStart, onSpeechEnd, onSpeechError, isSpeechReady],
  )

  // Public speak function that uses the queue
  const speak = useCallback(
    (
      text: string,
      config: VoiceConfig = {
        language: "en",
        gender: "female",
        rate: 0.9,
        pitch: 1.0,
        volume: 1.0,
      },
    ): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!text.trim()) {
          resolve()
          return
        }

        // Check rate limiting
        const now = Date.now()
        if (now - lastSpeechTimeRef.current < SPEECH_DELAY) {
          setTimeout(() => speak(text, config).then(resolve).catch(reject), SPEECH_DELAY)
          return
        }
        lastSpeechTimeRef.current = now

        // Add to queue
        const request: SpeechRequest = {
          text,
          config,
          resolve,
          reject,
          retryCount: 0,
        }

        speechQueueRef.current.push(request)
        processQueue()
      })
    },
    [processQueue],
  )

  // Stop current speech and clear queue
  const stop = useCallback(() => {
    speechQueueRef.current = []
    isProcessingRef.current = false

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
      currentUtteranceRef.current = null
      onSpeechEnd?.()
    }
  }, [onSpeechEnd])

  // Check if currently speaking
  const isSpeaking = useCallback(() => {
    return window.speechSynthesis?.speaking || isProcessingRef.current || speechQueueRef.current.length > 0
  }, [])

  // Initialize on mount
  useEffect(() => {
    initializeSpeechSynthesis()
  }, [initializeSpeechSynthesis])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      speechQueueRef.current = []
      isProcessingRef.current = false
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  return {
    speak,
    stop,
    isSpeaking,
    isReady: isSpeechReady,
  }
}
