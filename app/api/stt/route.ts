import { NextRequest, NextResponse } from "next/server"

export const runtime = "edge"

function normalizeLanguage(raw: string | null): string | undefined {
  if (!raw) return undefined
  // "uk-ua" -> "uk", "uk_UA" -> "uk", "uk" -> "uk"
  const code = raw.toString().trim().toLowerCase().split(/[-_]/)[0]
  if (!code || code.length < 2 || code.length > 5) return undefined
  return code
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const file = formData.get("file")
    const rawLanguage = (formData.get("language") as string | null) ?? null
    const language = normalizeLanguage(rawLanguage)

    if (!file || !(file instanceof Blob)) {
      console.error("[/api/stt] no audio file in request")
      return NextResponse.json(
        { success: false, error: "No audio file provided" },
        { status: 400 },
      )
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error("[/api/stt] OPENAI_API_KEY is missing")
      return NextResponse.json(
        { success: false, error: "Server STT config error (missing API key)" },
        { status: 500 },
      )
    }

    // Собираем форму для OpenAI: обязательно язык в формате ISO-639-1
    const openaiForm = new FormData()
    openaiForm.append("file", file, "audio.webm")
    openaiForm.append("model", "whisper-1")
    openaiForm.append("response_format", "json")
    if (language) {
      openaiForm.append("language", language)
    }

    console.log("[/api/stt] sending to OpenAI STT", {
      langRaw: rawLanguage,
      langNormalized: language,
    })

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: openaiForm,
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      console.error("[/api/stt] OpenAI error", {
        status: res.status,
        error: data?.error,
      })

      const message =
        data?.error?.message ||
        `STT request failed with status ${res.status}`

      return NextResponse.json(
        { success: false, error: message },
        { status: 500 },
      )
    }

    const text =
      typeof data?.text === "string" ? data.text : ""

    console.log("[/api/stt] transcription ok, length:", text.length)

    return NextResponse.json({
      success: true,
      text,
    })
  } catch (error) {
    console.error("[/api/stt] unexpected error", error)
    return NextResponse.json(
      { success: false, error: "Internal STT error" },
      { status: 500 },
    )
  }
}
