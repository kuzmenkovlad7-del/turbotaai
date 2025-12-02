// app/api/tts/route.ts
import { NextRequest, NextResponse } from "next/server"
import textToSpeech from "@google-cloud/text-to-speech"

// Нам нужен Node runtime (не edge), чтобы работала Google Cloud библиотека
export const runtime = "nodejs"

type Gender = "female" | "male"

type VoiceConfig = {
  languageCode: string
  name?: string
}

// Карта голосов: здесь сразу выбираем "лучший" мужской/женский
const VOICE_MAP: Record<string, Record<Gender, VoiceConfig>> = {
  "uk-UA": {
    // Женский: даём Google самому выбрать лучший женский голос для uk-UA
    female: { languageCode: "uk-UA" },

    // Мужской: твой премиальный Chirp3-голос (Dr. Alexander)
    male: {
      languageCode: "uk-UA",
      name: "uk-UA-Chirp3-HD-Schedar",
    },
  },

  "en-US": {
    // На будущее — хорошие нейросетевые голоса
    female: {
      languageCode: "en-US",
      name: "en-US-Neural2-C",
    },
    male: {
      languageCode: "en-US",
      name: "en-US-Neural2-D",
    },
  },
}

// В .env.local должен быть полный JSON сервис-аккаунта:
// GOOGLE_TTS_CREDENTIALS_JSON='{ ... }'
const credentialsJson = process.env.GOOGLE_TTS_CREDENTIALS_JSON

if (!credentialsJson) {
  console.warn(
    "[TTS] GOOGLE_TTS_CREDENTIALS_JSON is not set. /api/tts будет возвращать 500.",
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
        {
          success: false,
          error:
            "TTS client is not configured (missing GOOGLE_TTS_CREDENTIALS_JSON)",
        },
        { status: 500 },
      )
    }

    const body = await req.json()
    const rawText = (body?.text ?? "").toString()
    const text = rawText.trim()
    const rawLang = (body?.languageCode ?? "").toString().trim()
    const genderInput = body?.gender as Gender | undefined

    if (!text || !rawLang) {
      return NextResponse.json(
        { success: false, error: "Missing text or languageCode" },
        { status: 400 },
      )
    }

    // Если пришло "uk", "uk-ua" и т.п. — нормализуем в "uk-UA"
    const normalizedLang = rawLang.toLowerCase().startsWith("uk")
      ? "uk-UA"
      : rawLang

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
        { success: false, error: "No audio content from TTS" },
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
        success: false,
        error: "TTS error",
        details: error?.message ?? String(error),
      },
      { status: 500 },
    )
  }
}

// Простой health-check (опционально)
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
