import { type NextRequest, NextResponse } from "next/server"
import { requireAccess } from "@/lib/access/access-control"
import { getOrCreateConversationId, appendMessage } from "@/lib/history/history-store"

const FALLBACK_WEBHOOK_URL = "https://vladkuzmenko.com/webhook/turbotaai-agent"

// ВАЖНО: тут только серверные URL, НЕ NEXT_PUBLIC, иначе будет рекурсия когда
// NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL=/api/chat
const WEBHOOK_URL =
  process.env.TURBOTA_AGENT_WEBHOOK_URL ||
  process.env.N8N_TURBOTA_AGENT_WEBHOOK_URL ||
  FALLBACK_WEBHOOK_URL

function extractAnswer(data: any): string {
  if (!data) return ""
  if (typeof data === "string") return data.trim()

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] ?? {}
    return (
      first.text ||
      first.response ||
      first.output ||
      first.message ||
      first.content ||
      first.result ||
      JSON.stringify(first)
    )
      ?.toString()
      .trim()
  }

  if (typeof data === "object") {
    return (
      data.text ||
      data.response ||
      data.output ||
      data.message ||
      data.content ||
      data.result ||
      JSON.stringify(data)
    )
      ?.toString()
      .trim()
  }

  return ""
}

export async function POST(request: NextRequest) {
  try {
    let requestData: any = {}
    try {
      requestData = await request.json()
    } catch {
      requestData = {}
    }

    const userMessage: string =
      typeof requestData.query === "string" ? requestData.query : ""

    const userLanguage: string =
      typeof requestData.language === "string" ? requestData.language : "uk"

    const userEmail: string =
      typeof requestData.email === "string" && requestData.email.trim()
        ? requestData.email
        : "guest@example.com"

    if (!userMessage.trim()) {
      return NextResponse.json({ error: "Empty query" }, { status: 400 })
    }

    // лимиты: тратим 1 вопрос на каждый вызов /api/chat
    const access = await requireAccess(request, true)
    if (!access.ok) {
      return NextResponse.json(
        { error: "payment_required", reason: access.reason, grant: access.grant },
        { status: access.status },
      )
    }

    const payload = {
      query: userMessage,
      language: userLanguage,
      user: userEmail,
      requestType: "chat",
      source: "turbota-web-chat",
      channel: "web",
    }

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    })

    const rawText = await response.text()

    if (!response.ok) {
      return NextResponse.json(
        { error: `Webhook returned ${response.status}`, status: response.status, body: rawText },
        { status: 502 },
      )
    }

    let data: any
    try {
      data = JSON.parse(rawText)
    } catch {
      data = { response: rawText }
    }

    // история (не ломает ответ клиенту)
    try {
      const deviceHash =
        request.cookies.get("ta_device_hash")?.value || ""

      const title = userMessage.trim().slice(0, 80)
      const convId = await getOrCreateConversationId({
        deviceHash,
        mode: "chat",
        title,
        userEmail,
      })

      if (convId) {
        await appendMessage({ conversationId: convId, role: "user", text: userMessage.trim() })

        const answer = extractAnswer(data) || rawText
        await appendMessage({ conversationId: convId, role: "assistant", text: String(answer || "").trim() })
      }
    } catch (e) {
      console.warn("History save failed:", e)
    }

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
