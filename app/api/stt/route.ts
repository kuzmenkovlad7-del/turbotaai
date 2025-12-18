import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export const runtime = "nodejs"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

function pickExt(contentType: string) {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("mp4") || ct.includes("m4a")) return "mp4"
  if (ct.includes("mpeg") || ct.includes("mp3")) return "mp3"
  if (ct.includes("wav")) return "wav"
  if (ct.includes("webm")) return "webm"
  return "webm"
}

function normLang(v: string | null): "uk" | "ru" | "en" | undefined {
  const x = (v || "").toLowerCase().trim()
  if (x === "uk" || x.startsWith("uk")) return "uk"
  if (x === "ru" || x.startsWith("ru")) return "ru"
  if (x === "en" || x.startsWith("en")) return "en"
  return undefined
}

function isCommonHallucination(text: string) {
  const t = text.toLowerCase().trim()
  return (
    t === "thank you" ||
    t === "thanks" ||
    t === "bye" ||
    t === "bye bye" ||
    t === "ok" ||
    t === "okay"
  )
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "application/octet-stream"
  const ext = pickExt(contentType)

  const url = req.nextUrl
  const langRaw =
    req.headers.get("x-stt-language") ||
    url.searchParams.get("lang") ||
    url.searchParams.get("stt") ||
    null

  // по умолчанию ВСЕГДА украинский
  const lang = normLang(req.headers.get("x-stt-language") || req.nextUrl.searchParams.get("lang"))
|| "uk"
  const debug = req.headers.get("x-debug") === "1"

  try {
    const arrayBuffer = await req.arrayBuffer()
    const size = arrayBuffer?.byteLength ?? 0

    // мелочь = тишина/шум
    if (!arrayBuffer || size < 1500) {
      return NextResponse.json(
        { success: true, text: "", debug: debug ? { contentType, size, ext, lang, note: "too_small" } : undefined },
        { status: 200 },
      )
    }

    const buffer = Buffer.from(arrayBuffer)
    const file = new File([buffer], `speech.${ext}`, { type: contentType })

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: lang,
    })

    const text = (transcription.text ?? "").trim()

    // анти-«галлюцинации» на коротких/тихих кусках
    if (size < 25000 && isCommonHallucination(text)) {
      return NextResponse.json(
        { success: true, text: "", debug: debug ? { contentType, size, ext, lang, note: "filtered_hallucination" } : undefined },
        { status: 200 },
      )
    }

    return NextResponse.json(
      { success: true, text, debug: debug ? { contentType, size, ext, lang, textLen: text.length } : undefined },
      { status: 200 },
    )
  } catch (error: any) {
    console.error("[/api/stt] error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "stt_failed",
        debug: debug
          ? { contentType, ext, lang, message: error?.message || String(error) }
          : undefined,
      },
      { status: 500 },
    )
  }
}
