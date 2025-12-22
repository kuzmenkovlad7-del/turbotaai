import { NextResponse } from "next/server"
import OpenAI from "openai"
import { toFile } from "openai/uploads"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function normalizeMime(type?: string) {
  if (!type) return ""
  return String(type).split(";")[0].trim().toLowerCase()
}

function extFromMime(mime: string) {
  const m = normalizeMime(mime)
  if (m.includes("webm")) return "webm"
  if (m.includes("ogg") || m.includes("oga")) return "ogg"
  if (m.includes("wav")) return "wav"
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3"
  if (m.includes("mp4") || m.includes("m4a")) return "m4a"
  return "webm"
}

function safeFilename(name: string | undefined, ext: string) {
  const n = (name || "").trim()
  if (!n || n === "blob" || !n.includes(".")) return `speech.${ext}`
  return n
}

function normalizeLang(code: any) {
  const s = String(code || "").toLowerCase()
  if (s.startsWith("uk")) return "uk"
  if (s.startsWith("ru")) return "ru"
  if (s.startsWith("en")) return "en"
  return ""
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get("file") || form.get("audio")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 })
    }

    const mime = normalizeMime(file.type) || "audio/webm"
    const ext = extFromMime(mime)
    const filename = safeFilename(file.name, ext)

    const ab = await file.arrayBuffer()
    const size = ab?.byteLength || 0
    if (size < 1024) {
      return NextResponse.json({ error: "Empty audio" }, { status: 400 })
    }

    const lang = normalizeLang(form.get("language") || form.get("lang"))

    const upload = await toFile(Buffer.from(ab), filename, { type: mime })

    const resp = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: upload,
      ...(lang ? { language: lang } : {}),
    })

    return NextResponse.json({ text: resp?.text || "" })
  } catch (e: any) {
    console.error("[api/stt] error:", e?.message || e)
    // не отдаём наружу сырой OpenAI error/json
    return NextResponse.json(
      { error: "STT failed" },
      { status: 500 },
    )
  }
}
