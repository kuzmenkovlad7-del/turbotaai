import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export const runtime = "nodejs"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

function normalizeContentType(raw: string | null): string {
  // важно: убираем параметры типа ";codecs=opus"
  const ct = (raw || "").split(";")[0].trim().toLowerCase()
  return ct || "audio/webm"
}

function filenameForContentType(ct: string): string {
  if (ct.includes("mp4")) return "speech.mp4"
  if (ct.includes("webm")) return "speech.webm"
  if (ct.includes("wav")) return "speech.wav"
  if (ct.includes("mpeg") || ct.includes("mp3")) return "speech.mp3"
  if (ct.includes("ogg")) return "speech.ogg"
  if (ct.includes("aac")) return "speech.aac"
  if (ct.includes("flac")) return "speech.flac"
  return "speech.audio"
}

function normalizeLang(raw: string | null): "uk" | "ru" | "en" | undefined {
  const s = (raw || "").toLowerCase().trim()
  if (!s) return undefined
  if (s.startsWith("uk")) return "uk"
  if (s.startsWith("ru")) return "ru"
  if (s.startsWith("en")) return "en"
  return undefined
}

export async function POST(req: NextRequest) {
  try {
    const rawContentType = req.headers.get("content-type")
    const contentType = normalizeContentType(rawContentType)

    const arrayBuffer = await req.arrayBuffer()
    const byteLength = arrayBuffer?.byteLength ?? 0

    // микрофон может отдавать микро-кусочки/тишину — просто игнорируем
    if (!arrayBuffer || byteLength < 2000) {
      return NextResponse.json({ success: true, text: "" }, { status: 200 })
    }

    const buffer = Buffer.from(arrayBuffer)
    const filename = filenameForContentType(contentType)

    const file = new File([buffer], filename, { type: contentType })

    // язык берём из заголовка x-lang (клиент будет слать uk-UA/ru-RU/en-US)
    const lang = normalizeLang(req.headers.get("x-lang"))

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      ...(lang ? { language: lang } : {}),
    })

    const text = (transcription.text ?? "").trim()

    return NextResponse.json({ success: true, text }, { status: 200 })
  } catch (error) {
    console.error("[/api/stt] error:", error)
    return NextResponse.json(
      { success: false, error: "Audio file might be corrupted or unsupported" },
      { status: 500 },
    )
  }
}
