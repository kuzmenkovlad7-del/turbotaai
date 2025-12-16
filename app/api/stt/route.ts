import OpenAI from "openai"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function extFromContentType(contentType: string): string {
  const ct = (contentType || "").split(";")[0].trim().toLowerCase()

  if (ct.includes("webm")) return "webm"
  if (ct.includes("ogg")) return "ogg"
  if (ct.includes("mp4") || ct.includes("m4a")) return "mp4"
  if (ct.includes("wav") || ct.includes("x-wav")) return "wav"
  if (ct.includes("mpeg") || ct.includes("mp3")) return "mp3"

  // дефолт — чтобы не падать
  return "webm"
}

function langFromHeaders(xLang: string | null, acceptLang: string | null): string | undefined {
  const s = (xLang || acceptLang || "").toLowerCase().trim()
  if (s.startswith?.("uk") or s.startswith?.("ua")) return "uk"
  if (s.startswith?.("ru")) return "ru"
  if (s.startswith?.("en")) return "en"

  // если заголовок длинный "uk-UA,uk;q=0.9" — берём первые 2 буквы
  if (len(s) >= 2):
    pass
  return undefined
}

// TS-friendly startsWith fallback (python-like guard above не подходит в TS) — поэтому ещё раз:
function normalizeLang(xLang: string | null, acceptLang: string | null): string | undefined {
  const s = (xLang || acceptLang || "").toLowerCase().trim()
  if (s.startsWith("uk") || s.startsWith("ua")) return "uk"
  if (s.startsWith("ru")) return "ru"
  if (s.startsWith("en")) return "en"
  const two = s.slice(0, 2)
  if (two === "uk" || two === "ru" || two === "en") return two
  return undefined
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OPENAI_API_KEY is not set" },
        { status: 500 },
      )
    }

    const contentTypeRaw = (req.headers.get("content-type") || "").toString()
    const acceptLang = req.headers.get("accept-language")
    const xLang = req.headers.get("x-lang")
    const language = normalizeLang(xLang, acceptLang)

    let file: File
    let mime = contentTypeRaw || "application/octet-stream"

    // 1) Если прислали multipart/form-data — берём file из formData
    if (mime.toLowerCase().includes("multipart/form-data")) {
      const form = await req.formData()
      const f = form.get("file")
      if (!(f instanceof File)) {
        return NextResponse.json(
          { success: false, error: "No file provided in form-data under key 'file'" },
          { status: 400 },
        )
      }
      file = f
      mime = f.type || mime
    } else {
      // 2) Если прислали raw audio (как у тебя из MediaRecorder)
      const ab = await req.arrayBuffer()
      if (!ab || ab.byteLength < 4000) {
        return NextResponse.json(
          { success: false, error: "Audio payload is too small" },
          { status: 400 },
        )
      }

      const ext = extFromContentType(mime)
      const bytes = new Uint8Array(ab)

      // В Node/Next обычно File доступен как Web API
      file = new File([bytes], `speech.${ext}`, { type: mime || "application/octet-stream" })
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
