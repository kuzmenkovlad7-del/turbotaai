"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Volume2, Play, Square, AlertCircle, CheckCircle } from "lucide-react"
import { generateGoogleTTS } from "@/lib/google-tts"

export default function TTSTestComponent() {
  const [testText, setTestText] = useState(
    "Привіт! Як ви себе сьогодні почуваєте?",
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle")
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)

  const stopCurrentAudio = () => {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
    }
  }

  const handleTest = async (gender: "MALE" | "FEMALE") => {
    try {
      setIsLoading(true)
      setError(null)
      setStatus("idle")

      console.log("🎤 Testing voice…", { gender })

      // получаем data URL от /api/tts
      const dataUrl = await generateGoogleTTS(testText, "uk-UA", gender)

      stopCurrentAudio()

      const audio = new Audio(dataUrl)
      setCurrentAudio(audio)

      await audio.play()
      setStatus("ok")
    } catch (e: any) {
      console.error("TTS test error:", e)
      setError(e?.message || "Помилка при генерації голосу")
      setStatus("error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleStop = () => {
    stopCurrentAudio()
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4" />
        <span className="font-medium">
          TTS тестовий компонент (українська)
        </span>
      </div>

      <Textarea
        value={testText}
        onChange={(e) => setTestText(e.target.value)}
        rows={3}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isLoading}
          onClick={() => handleTest("FEMALE")}
          className="flex items-center gap-1"
        >
          <Play className="h-3 w-3" />
          Жіночий голос
        </Button>

        <Button
          type="button"
          size="sm"
          disabled={isLoading}
          onClick={() => handleTest("MALE")}
          className="flex items-center gap-1"
        >
          <Play className="h-3 w-3" />
          Чоловічий голос
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isLoading}
          onClick={handleStop}
          className="flex items-center gap-1"
        >
          <Square className="h-3 w-3" />
          Стоп
        </Button>
      </div>

      {status === "ok" && (
        <div className="flex items-center gap-1 text-xs text-emerald-600">
          <CheckCircle className="h-3 w-3" />
          Голос успішно відтворено
        </div>
      )}

      {status === "error" && error && (
        <div className="flex items-center gap-1 text-xs text-rose-600">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}
    </div>
  )
}
