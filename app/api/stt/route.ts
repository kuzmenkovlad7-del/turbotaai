import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export const runtime = "nodejs"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

function pickFilename(contentTypeHeader: string): string {
  const ct = String(contentTypeHeader || "").toLowerCase().split(";")[0].trim()

  if (ct.includes("mp4") || ct.includes("m4a")) return "speech.mp4"
  if (ct.includes("mpeg") || ct.includes("mp3")) return "speech.mp3"
  if (ct.includes("wav")) return "speech.wav"
  if (ct.includes("ogg")) return "speech.ogg"
  if (ct.includes("webm")) return "speech.webm"

  return "speech.audio"
}

function normalizeLang(raw: string): "uk" | "ru" | "en" | undefined {
  const v = String(raw || "").toLowerCase()
  if (v.startsWith("uk")) return "uk"
  if (v.startsWith("ru")) return "ru"
  if (v.startsWith("en")) return "en"
  return undefined
}

export async function POST(req: NextRequest) {
  try {
    const contentTypeHeader = req.headers.get("content-type") || "audio/webm"
    const contentType = String(contentTypeHeader).split(";")[0].trim() || "audio/webm"

    const arrayBuffer = await req.arrayBuffer()
    const byteLength = arrayBuffer?.byteLength ?? 0

    if (!arrayBuffer || byteLength < 1000) {
      return NextResponse.json({ success: true, text: "" }, { status: 200 })
    }

    const buffer = Buffer.from(arrayBuffer)
    const filename = pickFilename(contentTypeHeader)
    const file = new File([buffer], filename, { type: contentType })

    const rawLang = req.headers.get("x-lang") || ""
    const language = normalizeLang(rawLang)

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      ...(language ? { language } : {}),
    })

    const text = String(transcription.text || "").trim()

    return NextResponse.json({ success: true, text }, { status: 200 })
  } catch (error) {
    console.error("[/api/stt] error:", error)
    return NextResponse.json(
      { success: false, error: "Audio file might be corrupted or unsupported" },
      { status: 500 },
    )
  }
}
