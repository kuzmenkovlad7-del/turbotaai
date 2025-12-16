import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export const runtime = "nodejs"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

function pickExt(contentType: string) {
  const ct = (contentType || "").toLowerCase()

  // iOS Safari/Chrome(iOS) часто дают audio/mp4
  if (ct.includes("mp4") || ct.includes("m4a")) return "mp4"

  // mp3 обычно приходит как audio/mpeg
  if (ct.includes("mpeg") || ct.includes("mp3")) return "mp3"

  if (ct.includes("wav")) return "wav"
  if (ct.includes("webm")) return "webm"

  // безопасный дефолт
  return "webm"
}

function pickLanguage(raw: string | null): string | undefined {
  const v = (raw || "").toLowerCase()
  if (v.startsWith("uk")) return "uk"
  if (v.startsWith("ru")) return "ru"
  if (v.startsWith("en")) return "en"
  return undefined
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "application/octet-stream"

    const arrayBuffer = await req.arrayBuffer()
    const byteLength = arrayBuffer?.byteLength ?? 0

    // микроскопические куски считаем тишиной
    if (!arrayBuffer || byteLength < 1200) {
      return NextResponse.json({ success: true, text: "" }, { status: 200 })
    }

    const buffer = Buffer.from(arrayBuffer)
    const ext = pickExt(contentType)
    const filename = `speech.${ext}`

    // File доступен в node-runtime (Next.js nodejs runtime)
    const file = new File([buffer], filename, { type: contentType })

    const language = pickLanguage(req.headers.get("x-lang"))

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
