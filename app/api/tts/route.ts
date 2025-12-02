// app/api/tts/route.ts
import { NextRequest, NextResponse } from "next/server"
import textToSpeech from "@google-cloud/text-to-speech"

// Важно: для Google Cloud SDK нужен Node.js runtime
export const runtime = "nodejs"

type Gender = "female" | "male"

type VoiceConfig = {
  languageCode: string
  name?: string
}

// Карта голосов: здесь настраиваем мужской/женский под языки.
// Можно пока оставить без name — тогда Google сам выберет голос по gender.
const VOICE_MAP: Record<string, Record<Gender, VoiceConfig>> = {
  "uk-UA": {
    female: { languageCode: "uk-UA" },
    male: { languageCode: "uk-UA" }, // сюда можно повесить Dr. Alexander (Chirp3)
  },
  "en-US": {
    female: { languageCode: "en-US" },
    male: { languageCode: "en-US" },
  },
}

// В .env.local кладём полный JSON сервис-аккаунта:
// GOOGLE_TTS_CREDENTIALS_JSON={ ... }
const credentialsJson = process.env.GOOGLE_TTS_CREDENTIALS_JSON

if (!credentialsJson) {
  console.warn(
    "[TTS] GOOGLE_TTS_CREDENTIALS_JSON is not set. /api/tts will return 500.",
  )
}

const client =
  credentialsJson != null
    ? new textToSpeech.TextToSpeechClient({
        credentials: JSON.parse(credentialsJson),
      })
    : null

export async function POST(req: NextRequest) {
  try {
    if (!client) {
      return NextResponse.json(
        { error: "TTS client is not configured (missing GOOGLE_TTS_CREDENTIALS_JSON)" },
        { status: 500 },
      )
    }

    const body = await req.json()
    const text = (body?.text ?? "").toString().trim()
    const languageCode = (body?.languageCode ?? "").toString().trim()
    const genderInput = body?.gender as Gender | undefined

    if (!text || !languageCode) {
      return NextResponse.json(
        { error: "Missing text or languageCode" },
        { status: 400 },
      )
    }

    const normalizedLang =
      languageCode.toLowerCase().startsWith("uk") ? "uk-UA" : languageCode

    const voiceGender: Gender =
      genderInput === "male" || genderInput === "female"
        ? genderInput
        : "female"

    const voiceConfig =
      VOICE_MAP[normalizedLang]?.[voiceGender] ??
      VOICE_MAP["uk-UA"][voiceGender]

    const voice: any = {
      languageCode: voiceConfig.languageCode,
      ssmlGender: voiceGender === "male" ? "MALE" : "FEMALE",
    }

    if (voiceConfig.name) {
      voice.name = voiceConfig.name
    }

    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice,
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 0.95,
      },
    })

    const audioContent = response.audioContent

    if (!audioContent) {
      return NextResponse.json(
        { error: "No audio content from TTS" },
        { status: 500 },
      )
    }

    const buffer = Buffer.from(audioContent as Uint8Array)
    const base64 = buffer.toString("base64")
    const audioUrl = `data:audio/mp3;base64,${base64}`

    return NextResponse.json({
      success: true,
      audioUrl,
      language: normalizedLang,
      gender: voiceGender,
    })
  } catch (error: any) {
    console.error("[TTS] Error:", error)
    return NextResponse.json(
      {
        error: "TTS error",
        details: error?.message ?? String(error),
      },
      { status: 500 },
    )
  }
}

// Опциональный health-check (можно оставить — не мешает)
export async function GET() {
  return NextResponse.json(
    {
      success: true,
      message: "Google Cloud TTS API is running",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  )
}
