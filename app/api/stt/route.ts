import { NextResponse } from "next/server"

export const runtime = "edge"

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_API_KEY_STT ||
  process.env.OPENAI_API_KEY_TURBOTA ||
  ""

/**
 * /api/stt
 *
 * Ждём:
 *  - formData "file"  (Blob от MediaRecorder, обычно audio/webm)
 *  - formData "language" (uk-UA / ru-RU / en-US и т.п.)
 *
 * Делаем:
 *  - маленькие куски (тишина) -> success: true, text: ""
 *  - нормальные куски -> отправляем в OpenAI STT
 */
export async function POST(req: Request) {
  try {
    if (!OPENAI_API_KEY) {
      console.error("[STT] Missing OPENAI_API_KEY")
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
      console.error("[STT] No audio file in request")
      return NextResponse.json(
        {
          success: false,
          error: "No audio file provided",
        },
        { status: 400 },
      )
    }

    // Совсем мелкие куски (обычно тишина) — не считаем ошибкой
    if (file.size < 1500) {
      return NextResponse.json(
        {
          success: true,
          text: "",
        },
        { status: 200 },
      )
    }

    const mime = file.type || "audio/webm"

    const ext = mime.includes("webm")
      ? "webm"
      : mime.includes("wav")
        ? "wav"
        : mime.includes("mp3") || mime.includes("mpeg")
          ? "mp3"
          : "webm"

    const audioFile =
      file instanceof File
        ? file
        : new File([file], `chunk.${ext}`, { type: mime })

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
      console.error(
        "[STT] OpenAI error:",
        openaiRes.status,
        openaiRes.statusText,
        raw.slice(0, 500),
      )

      return NextResponse.json(
        {
          success: false,
          error:
            data?.error?.message ||
            \`OpenAI STT error: \${openaiRes.status} \${openaiRes.statusText}\`,
        },
        { status: 500 },
      )
    }

    const text = (data.text || "").toString().trim()

    console.log("[STT] success, text:", text.slice(0, 80))

    return NextResponse.json(
      {
        success: true,
        text,
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error("[STT] route fatal error:", error)
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
