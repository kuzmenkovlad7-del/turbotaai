import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export const runtime = "nodejs"

function extFromContentType(mime: string | null | undefined): string {
  const ct = String(mime || "").toLowerCase()
  if (ct.includes("mp4")) return "mp4"
  if (ct.includes("mpeg")) return "mp3"
  if (ct.includes("wav")) return "wav"
  if (ct.includes("webm")) return "webm"
  if (ct.includes("ogg")) return "ogg"
  return "webm"
}

function normalizeWhisperLanguage(value: string | null): string | undefined {
  if (!value) return undefined
  const v = value.toLowerCase().trim()
  if (!v) return undefined

  // поддержка форматов типа "uk-UA", "ru-RU"
  if (v.startswith("uk")) return "uk"
  if (v.startswith("ru")) return "ru"
  if (v.startswith("en")) return "en"
  // если пришло что-то экзотическое — отдаём как есть (Whisper может проигнорировать)
  return v
}

export async function POST(req: NextRequest) {
  try {
    const ctHeader = req.headers.get("content-type") || ""
    const mime = ctHeader.split(";")[0].trim()

    const languageFromHeader =
      req.headers.get("x-lang") ||
      req.nextUrl.searchParams.get("lang") ||
      req.nextUrl.searchParams.get("language")

    const language = normalizeWhisperLanguage(languageFromHeader)

    let file: File | null = null
    let usedMime = mime

    // 1) form-data: ожидаем key "file"
    if (ctHeader.toLowerCase().includes("multipart/form-data")) {
      const form = await req.formData()
      const f = form.get("file")

      if (!f || !(f instanceof File)) {
        return NextResponse.json(
          { success: false, error: "No file provided in form-data under key 'file'" },
          { status: 400 },
        )
      }

      file = f
      usedMime = f.type || usedMime
    } else {
      // 2) raw audio: MediaRecorder присылает просто bytes
      const ab = await req.arrayBuffer()
      if (!ab || ab.byteLength < 4000) {
        return NextResponse.json(
          { success: false, error: "Audio payload is too small" },
          { status: 400 },
        )
      }

      const bytes = new Uint8Array(ab)
      const ext = extFromContentType(usedMime)
      file = new File([bytes], `speech.${ext}`, {
        type: usedMime || "application/octet-stream",
      })
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const model = process.env.OPENAI_STT_MODEL || "whisper-1"

    const result = await client.audio.transcriptions.create({
      file,
      model,
      ...(language ? { language } : {}),
    })

    const text = ((result as any)?.text || "").toString().trim()
    return NextResponse.json({ success: true, text })
  } catch (err: any) {
    console.error("[/api/stt] error:", err)
    return NextResponse.json(
      { success: false, error: err?.message || "STT error" },
      { status: 500 },
    )
  }
}
