import { NextResponse } from "next/server"

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_STT || ""

// можно включить edge-runtime, но это опционально
export const runtime = "edge"

const SUPPORTED_MIME_TYPES = [
  "audio/flac",
  "audio/m4a",
  "audio/mp3",
  "audio/mp4",
  "audio/mpeg",
  "audio/mpga",
  "audio/ogg",
  "audio/oga",
  "audio/wav",
  "audio/webm",
  "video/webm",
]

const SUPPORTED_EXTS = [
  "flac",
  "m4a",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "oga",
  "ogg",
  "wav",
  "webm",
]

function guessExt(mime: string): string {
  if (mime.includes("flac")) return "flac"
  if (mime.includes("m4a")) return "m4a"
  if (mime.includes("mp3")) return "mp3"
  if (mime.includes("mp4")) return "mp4"
  if (mime.includes("mpeg") || mime.includes("mpga")) return "mpeg"
  if (mime.includes("oga")) return "oga"
  if (mime.includes("ogg")) return "ogg"
  if (mime.includes("wav")) return "wav"
  if (mime.includes("webm")) return "webm"
  return "webm"
}

export async function POST(req: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing OPENAI_API_KEY for STT",
        },
        { status: 500 },
      )
    }

    const formData = await req.formData()
    const file = formData.get("file")
    const languageRaw = (formData.get("language") || "uk").toString()

    if (!(file instanceof Blob)) {
      return NextResponse.json(
        {
          success: false,
          error: "No audio file provided",
        },
        { status: 400 },
      )
    }

    const mime = file.type || "audio/webm"

    const isSupported =
      SUPPORTED_MIME_TYPES.includes(mime) ||
      mime.startsWith("audio/") ||
      mime.startsWith("video/")

    if (!isSupported) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid file format. Supported formats: ${JSON.stringify(
            SUPPORTED_EXTS,
          )}`,
        },
        { status: 400 },
      )
    }

    const ext = guessExt(mime)
    const audioFile =
      file instanceof File
        ? file
        : new File([file], `speech.${ext}`, { type: mime })

    const lang = languageRaw.split("-")[0] || "uk"

    const fd = new FormData()
    fd.append("file", audioFile)
    fd.append("model", "gpt-4o-mini-transcribe")
    fd.append("language", lang)
    fd.append("response_format", "json")

    const openaiRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: fd,
      },
    )

    const raw = await openaiRes.text()
    let data: any = null

    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!openaiRes.ok || !data) {
      console.error("STT OpenAI error:", openaiRes.status, raw)
      return NextResponse.json(
        {
          success: false,
          error:
            data?.error?.message ||
            `OpenAI STT error: ${openaiRes.status} ${openaiRes.statusText}`,
        },
        { status: 500 },
      )
    }

    const text = (data.text || "").toString().trim()

    return NextResponse.json({
      success: true,
      text,
    })
  } catch (error: any) {
    console.error("STT route fatal error:", error)
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Unexpected error while processing speech-to-text request",
      },
      { status: 500 },
    )
  }
}
