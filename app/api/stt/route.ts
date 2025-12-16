import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export const runtime = "nodejs"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

function pickFilename(contentType: string): string {
  const ct = String(contentType || "").toLowerCase()

  // iOS/Safari MediaRecorder чаще всего отдаёт audio/mp4
  if (ct.includes("mp4") || ct.includes("m4a")) return "speech.mp4"

  // иногда встречается mpeg/mp3
  if (ct.includes("mpeg") || ct.includes("mp3")) return "speech.mp3"

  if (ct.includes("wav")) return "speech.wav"
  if (ct.includes("ogg")) return "speech.ogg"

  // дефолт под Chrome/Android
  if (ct.includes("webm")) return "speech.webm"

  // запасной вариант
  return "speech.audio"
}

function pickLanguage(req: NextRequest): string | undefined {
  const raw = (req.headers.get("x-lang") || "").toLowerCase()
  if (raw.startsWith("uk")) return "uk"
  if (raw.startsWith("ru")) return "ru"
  if (raw.startsWith("en")) return "en"
  return undefined // пусть Whisper сам детектит
}

export async function POST(req: NextRequest) {
  try {
    const contentType =
      req.headers.get("content-type") || "application/octet-stream"

    const arrayBuffer = await req.arrayBuffer()
    const byteLength = arrayBuffer?.byteLength ?? 0

    // слишком маленький фрагмент — считаем тишиной
    if (!arrayBuffer || byteLength < 2000) {
      return NextResponse.json({ success: true, text: "" }, { status: 200 })
    }

    const buffer = Buffer.from(arrayBuffer)
    const filename = pickFilename(contentType)
    const language = pickLanguage(req)

    // Node 18+ / Next.js route handler: File доступен глобально
    const file = new File([buffer], filename, { type: contentType })

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
