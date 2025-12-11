import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function jsonError(message: string, status = 500) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status },
  )
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error("[STT] missing OPENAI_API_KEY")
      return jsonError("Server STT config error (no API key)", 500)
    }

    const form = await req.formData()
    const file = form.get("file")

    if (!file || !(file instanceof Blob)) {
      console.error("[STT] no file in form-data")
      return jsonError("No audio file provided", 400)
    }

    const incomingBlob = file as Blob
    const arrayBuffer = await incomingBlob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // создаём нормальный File с типом audio/webm
    const audioFile = new File([buffer], "audio.webm", {
      type: incomingBlob.type || "audio/webm",
    })

    const openaiForm = new FormData()
    openaiForm.append("file", audioFile)
    openaiForm.append("model", "whisper-1")
    openaiForm.append("response_format", "json")

    console.log(
      "[STT] sending to OpenAI: size=" +
        buffer.length +
        " contentType=" +
        (incomingBlob.type || "audio/webm"),
    )

    const openaiRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
        },
        body: openaiForm,
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

      const errMessage =
        (data && data.error && data.error.message) ||
        raw.slice(0, 200) ||
        "OpenAI STT error"

      // ВАЖНО: если это тот самый 400 "Audio file might be corrupted or unsupported",
      // считаем это мягкой ошибкой и просто возвращаем пустую строку,
      // чтобы фронт не ломался и продолжал слушать.
      if (
        openaiRes.status === 400 &&
        errMessage.toLowerCase().includes("audio file might be corrupted or unsupported")
      ) {
        console.warn("[STT] soft 400 error from OpenAI, returning empty text")
        return NextResponse.json(
          {
            success: true,
            text: "",
          },
          { status: 200 },
        )
      }

      return jsonError(
        "OpenAI STT error: " +
          openaiRes.status +
          " " +
          (errMessage || openaiRes.statusText),
        500,
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
    return jsonError(
      error?.message || "Unexpected error while processing speech-to-text request",
      500,
    )
  }
}
