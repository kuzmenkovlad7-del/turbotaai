import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export const runtime = "edge"

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "OPENAI_API_KEY is not configured" },
        { status: 500 },
      )
    }

    const audioBuffer = await req.arrayBuffer()
    if (!audioBuffer || audioBuffer.byteLength < 8000) {
      // слишком короткий / пустой звук — просто возвращаем пустой текст
      return NextResponse.json(
        { success: true, text: "" },
        { status: 200 },
      )
    }

    const blob = new Blob([audioBuffer], { type: "audio/webm" })

    const formData = new FormData()
    formData.append("file", blob, "audio.webm")
    formData.append("model", "whisper-1")
    // язык можно не указывать — Whisper сам определит;
    // при желании можно добавить: formData.append("language", "uk");

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

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text()
      console.error("OpenAI STT error:", openaiRes.status, errorText)
      return NextResponse.json(
        {
          success: false,
          error: "Speech recognition error",
          details: errorText,
        },
        { status: 500 },
      )
    }

    const data: any = await openaiRes.json()
    const text = (data.text || "").toString().trim()

    return NextResponse.json(
      {
        success: true,
        text,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("STT route fatal error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Unexpected server error while processing audio",
      },
      { status: 500 },
    )
  }
}
