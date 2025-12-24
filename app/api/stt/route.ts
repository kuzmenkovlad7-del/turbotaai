import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Lang3 = "uk" | "ru" | "en"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_STT_MODEL = process.env.OPENAI_STT_MODEL || "whisper-1"

function asLang3(v: string | null | undefined): Lang3 {
  const s = (v || "").toLowerCase().trim()
  if (s.startsWith("uk")) return "uk"
  if (s.startsWith("ru")) return "ru"
  return "en"
}

function baseMime(contentType: string): string {
  return (contentType || "").split(";")[0].trim().toLowerCase()
}

function extFromMime(mime: string): string {
  const m = baseMime(mime)
  if (m.includes("webm")) return "webm"
  if (m.includes("wav")) return "wav"
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3"
  if (m.includes("mp4") || m.includes("m4a")) return "m4a"
  if (m.includes("ogg")) return "ogg"
  if (m.includes("flac")) return "flac"
  return "webm"
}

function shouldDropAsGarbage(text: string): boolean {
  const t = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[“”"«»]/g, '"')
    .trim()

  if (!t) return true
  if (t.length <= 1) return true

  const patterns: RegExp[] = [
    /^(thank(s| you).*)$/i,
    /^thanks for (watching|listening).*$/i,
    /^subscribe.*$/i,
    /^(спасибо|дякую)(.*)$/i,
    /спасибо за (просмотр|внимание)/i,
    /дякую за (перегляд|увагу)/i,
    /постав(ьте|те) лайк/i,
    /подпис(ывайтесь|уйтесь)/i,
    /see you next time/i,
    /ви маєте можливість.*перейти на відео/i,
    /перейти на відео.*дяку(ю|ємо)/i,
    /яке ви бачите на екрані/i,
    /перейти на видео.*спасибо/i,
    /которое вы видите на экране/i,
    /switch to (the )?video/i,
    /that you see on (the )?screen/i,
  ]

  return patterns.some((re) => re.test(t))
}

async function whisperTranscribe(args: { bytes: Uint8Array; mime: string; lang: Lang3 }) {
  const { bytes, mime, lang } = args

  const form = new FormData()
  const cleanMime = baseMime(mime) || "audio/webm"
  const ab = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(ab).set(bytes)
  const blob = new Blob([ab], { type: cleanMime })
  const filename = `audio.${extFromMime(cleanMime)}`

  form.append("file", blob, filename)
  form.append("model", OPENAI_STT_MODEL)
  form.append("language", lang)
  form.append("response_format", "verbose_json")
  form.append("temperature", "0")
  form.append(
    "prompt",
    "Transcribe speech verbatim. If there is no clear speech, return an empty transcription.",
  )

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  })

  const raw = await resp.text()
  let json: any = null
  try {
    json = JSON.parse(raw)
  } catch {}

  if (!resp.ok) {
    const msg =
      (json && (json.error?.message || json.message)) || raw || `OpenAI STT error: ${resp.status}`
    throw new Error(msg)
  }

  return json as { text?: string; language?: string }
}

export async function POST(request: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ success: false, error: "Missing OPENAI_API_KEY" }, { status: 500 })
    }

    const lang = asLang3(
      request.headers.get("x-stt-lang") ||
        request.headers.get("x-lang") ||
        request.headers.get("x-stt-hint") ||
        "uk",
    )

    const contentType = request.headers.get("content-type") || ""
    const isMultipart = contentType.toLowerCase().includes("multipart/form-data")

    let bytes: Uint8Array
    let mime = baseMime(contentType) || "audio/webm"

    if (isMultipart) {
      const fd = await request.formData()
      const maybe = fd.get("audio") || fd.get("file") || fd.get("blob") || fd.get("data")
      if (!maybe || !(maybe instanceof Blob)) {
        return NextResponse.json(
          { success: false, error: "Missing audio file in multipart form-data" },
          { status: 400 },
        )
      }
      mime = baseMime((maybe as Blob).type) || mime
      bytes = new Uint8Array(await (maybe as Blob).arrayBuffer())
    } else {
      const ab = await request.arrayBuffer()
      bytes = new Uint8Array(ab)
      mime = baseMime(contentType) || "audio/webm"
    }

    if (!bytes || bytes.byteLength < 900) {
      return NextResponse.json({
        success: true,
        text: "",
        lang,
        debug: { dropped: "too_small", bytes: bytes?.byteLength || 0 },
      })
    }

    const result = await whisperTranscribe({ bytes, mime, lang })
    const text = (result?.text || "").trim()

    if (!text || shouldDropAsGarbage(text)) {
      return NextResponse.json({
        success: true,
        text: "",
        lang,
        debug: { dropped: true, reason: "garbage_or_empty" },
      })
    }

    return NextResponse.json({ success: true, text, lang })
  } catch (err: any) {
    const message = (err && (err.message || String(err))) || "Unknown error in /api/stt"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
