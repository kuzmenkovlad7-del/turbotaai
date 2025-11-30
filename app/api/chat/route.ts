// app/api/chat/route.ts
import { type NextRequest, NextResponse } from "next/server"

const FALLBACK_WEBHOOK_URL = "https://vladkuzmenko.com/webhook/turbotaai-agent"

const WEBHOOK_URL =
  process.env.TURBOTA_AGENT_WEBHOOK_URL ||
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL ||
  FALLBACK_WEBHOOK_URL

export async function POST(request: NextRequest) {
  try {
    let requestData: any = {}
    try {
      requestData = await request.json()
    } catch {
      requestData = {}
    }

    const userMessage: string = typeof requestData.query === "string" ? requestData.query : ""
    const userLanguage: string = typeof requestData.language === "string" ? requestData.language : "uk"
    const userEmail: string =
      typeof requestData.email === "string" && requestData.email.trim()
        ? requestData.email
        : "guest@example.com"

    if (!userMessage.trim()) {
      return NextResponse.json({ error: "Empty query" }, { status: 400 })
    }

    const payload = {
      // то, что реально нужно ноде Webhook в n8n
      query: userMessage,
      language: userLanguage,
      user: userEmail,

      // полезные метаданные на будущее
      requestType: "chat",
      source: "turbota-web-chat",
      channel: "web",
    }

    console.log("Proxying POST to n8n webhook:", WEBHOOK_URL, "payload:", payload)

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    })

    const rawText = await response.text()
    console.log("Webhook status:", response.status)
    console.log("Webhook raw response:", rawText)

    if (!response.ok) {
      // Пробрасываем тело, чтобы легче дебажить
      return NextResponse.json(
        {
          error: `Webhook returned ${response.status}`,
          status: response.status,
          body: rawText,
        },
        { status: 502 },
      )
    }

    let data: any

    try {
      data = JSON.parse(rawText)
    } catch {
      // если n8n вернул просто текст
      data = { response: rawText }
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("API /api/chat error:", error)
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
