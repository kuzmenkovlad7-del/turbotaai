import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import {
  OPENAI_TTS_MODEL,
  normalizeLanguage,
  normalizeGender,
  selectOpenAIVoice,
} from "@/lib/google-tts"

export const runtime = "nodejs"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const rawText = body.text || body.input || ""
    const text = String(rawText || "").trim()

    if (!text) {
      return NextResponse.json({ success: false, error: "Missing 'text' for TTS" }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ success: false, error: "Server TTS is not configured" }, { status: 500 })
    }

    const langCode = normalizeLanguage(body.language)
    const gender = normalizeGender(body.gender)
    const voice = selectOpenAIVoice(langCode, gender)

    const response = await openai.audio.speech.create({
      model: OPENAI_TTS_MODEL,
      voice,
      input: text,
    })

    const buffer = Buffer.from(await response.arrayBuffer())
    const audioContent = buffer.toString("base64")

    return NextResponse.json({
      success: true,
      audioContent,
      language: langCode,
      gender,
      voice,
      contentType: "audio/mpeg",
    })
  } catch {
    return NextResponse.json({ success: false, error: "TTS generation failed" }, { status: 500 })
  }
}
