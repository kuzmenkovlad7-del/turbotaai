import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export const runtime = "nodejs"

function pickFilename(contentTypeRaw: string) {
  const ct = (contentTypeRaw || "").toLowerCase()
  if (ct.includes("mp4")) return "speech.mp4"
  if (ct.includes("mpeg") || ct.includes("mp3")) return "speech.mp3"
  if (ct.includes("wav")) return "speech.wav"
  if (ct.includes("ogg")) return "speech.ogg"
  if (ct.includes("webm")) return "speech.webm"
  return "speech.audio"
}

export async function POST(req: NextRequest) {
  try {
    const contentTypeHeader = req.headers.get("content-type") || "audio/webm"
    const contentType = contentTypeHeader.split(";")[0].trim() || "audio/webm"

    const arrayBuffer = await req.arrayBuffer()
    const byteLength = arrayBuffer?.byteLength ?? 0

    if (!arrayBuffer || byteLength < 2000) {
      return NextResponse.json({ success: true, text: "" }, { status: 200 })
    }

    const buffer = Buffer.from(arrayBuffer)
    const filename = pickFilename(contentType)

    const file = new File([buffer], filename, { type: contentType })

    const rawLang = (req.headers.get("x-lang") || "").toLowerCase()
    let language: string | undefined

    if (rawLang.startsWith("uk")) language = "uk"
    else if (rawLang.startsWith("ru")) language = "ru"
    else if (rawLang.startsWith("en")) language = "en"

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      ...(language ? { language } : {}),
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
