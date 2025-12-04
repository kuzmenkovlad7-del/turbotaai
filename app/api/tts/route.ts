import { NextRequest, NextResponse } from "next/server"
import * as textToSpeech from "@google-cloud/text-to-speech"

export const runtime = "nodejs"

type Gender = "male" | "female"

type VoiceConfig = {
  languageCode: string
  name: string
}

// Базовые голоса для трёх языков (можно потом расширить)
const VOICE_MAP: Record<string, Record<Gender, VoiceConfig>> = {
  uk: {
    female: { languageCode: "uk-UA", name: "uk-UA-Standard-A" },
    male: { languageCode: "uk-UA", name: "uk-UA-Standard-B" },
  },
  ru: {
    female: { languageCode: "ru-RU", name: "ru-RU-Standard-A" },
    male: { languageCode: "ru-RU", name: "ru-RU-Standard-B" },
  },
  en: {
    female: { languageCode: "en-US", name: "en-US-Standard-C" },
    male: { languageCode: "en-US", name: "en-US-Standard-B" },
  },
}

let ttsClient: textToSpeech.TextToSpeechClient | null = null

function getTtsClient() {
  if (ttsClient) return ttsClient

  const credentialsJson = process.env.GOOGLE_TTS_CREDENTIALS
  const options: textToSpeech.ClientOptions = {}

  if (credentialsJson) {
    try {
      options.credentials = JSON.parse(credentialsJson)
    } catch (error) {
      console.error("Invalid GOOGLE_TTS_CREDENTIALS JSON:", error)
    }
  }

  ttsClient = new textToSpeech.TextToSpeechClient(options)
  return ttsClient
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const text =
      typeof body?.text === "string" ? body.text.trim() : ""
    let language =
      typeof body?.language === "string"
        ? body.language.toLowerCase()
        : "uk"
    const genderRaw =
      body?.gender === "male" || body?.gender === "female"
        ? body.gender
        : "female"

    const gender: Gender = genderRaw

    const speakingRate =
      typeof body?.speakingRate === "number"
        ? body.speakingRate
        : 1.0
    const pitch =
      typeof body?.pitch === "number" ? body.pitch : 0

    if (!text) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 },
      )
    }

    // поддерживаем только ключи из VOICE_MAP, остальное — fallback на uk
    if (!Object.prototype.hasOwnProperty.call(VOICE_MAP, language)) {
      language = "uk"
    }

    const languageVoices = VOICE_MAP[language]
    const voiceConfig =
      languageVoices?.[gender] ?? VOICE_MAP.uk.female

    const client = getTtsClient()

    const requestData = {
      input: { text },
      voice: {
        languageCode: voiceConfig.languageCode,
        name: voiceConfig.name,
        ssmlGender: gender === "male" ? "MALE" : "FEMALE",
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate,
        pitch,
      },
    }

    const [response] = await client.synthesizeSpeech(
      requestData as any,
    )

    if (!response.audioContent) {
      console.error("Google TTS: empty audioContent")
      return NextResponse.json(
        { error: "Failed to synthesize speech" },
        { status: 500 },
      )
    }

    const audioBase64 = Buffer.from(
      response.audioContent as Uint8Array,
    ).toString("base64")

    return NextResponse.json({
      audioUrl: `data:audio/mp3;base64,${audioBase64}`,
    })
  } catch (error) {
    console.error("Error in TTS route:", error)
    return NextResponse.json(
      { error: "Failed to synthesize speech" },
      { status: 500 },
    )
  }
}
