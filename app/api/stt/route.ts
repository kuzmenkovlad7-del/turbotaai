import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      console.error("[STT] OPENAI_API_KEY is missing")
      return NextResponse.json(
        {
          success: false,
          error: "STT server misconfigured: missing OPENAI_API_KEY",
        },
        { status: 500 },
      )
    }

    const arrayBuffer = await req.arrayBuffer()
    const byteLength = arrayBuffer.byteLength

    if (!byteLength || byteLength < 1024) {
      console.error("[STT] empty or too small audio payload:", byteLength)
      return NextResponse.json(
        {
          success: false,
          error: "Audio payload is too small or empty",
        },
        { status: 400 },
      )
    }

    console.log("[STT] received audio bytes:", byteLength)

    // Собираем webm как один файл
    const blob = new Blob([arrayBuffer], { type: "audio/webm" })
    const formData = new FormData()
    formData.append("file", blob, "audio.webm")
    formData.append("model", "gpt-4o-mini-transcribe")
    formData.append("response_format", "json")
    formData.append("temperature", "0")

    // язык можно не жёстко задавать — пусть определяет сам
    // formData.append("language", "uk")

    const openaiRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
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
            `OpenAI STT error: ${openaiRes.status} ${openaiRes.statusText}`,
        },
        { status: 500 },
      )
    }

    const text = (data.text || "").toString().trim()

    console.log("[STT] success, text:", text.slice(0, 120))

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

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      message: "STT endpoint is running",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  )
}
