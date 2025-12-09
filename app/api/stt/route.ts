import { NextResponse } from "next/server"

export const runtime = "edge"

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_API_KEY_STT ||
  process.env.OPENAI_API_KEY_TURBOTA ||
  ""

/**
 * Простой мост к OpenAI STT:
 * - принимает файл из MediaRecorder (обычно audio/webm)
 * - НЕ делает никаких лишних проверок "повреждён / неподдерживаемый"
 * - отправляет как есть в /v1/audio/transcriptions
 * - возвращает { success: true, text } или { success: false, error }
 */
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

    // Делаем File, чтобы у OpenAI точно было имя и расширение
    const ext = mime.includes("webm")
      ? "webm"
      : mime.includes("wav")
        ? "wav"
        : mime.includes("mp3")
          ? "mp3"
          : "webm"

    const audioFile =
      file instanceof File
        ? file
        : new File([file], `speech.${ext}`, { type: mime })

    const lang = languageRaw.split("-")[0] || "uk"

    const fd = new FormData()
    fd.append("file", audioFile)
    // модель можно поменять при необходимости
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

      // ВАЖНО: не роняем всё, а аккуратно возвращаем ошибку наверх
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
