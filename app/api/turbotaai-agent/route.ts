import { NextRequest, NextResponse } from "next/server"
import { requireAccess } from "@/lib/access/access-control"
import { getOrCreateConversationId, appendMessage } from "@/lib/history/history-store"

const N8N_WEBHOOK_URL =
  process.env.N8N_TURBOTA_AGENT_WEBHOOK_URL ??
  "https://n8n.vladkuzmenko.com/webhook/turbotaai-agent"

async function forwardToN8N(payload: any) {
  const res = await fetch(N8N_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload ?? {}),
    cache: "no-store",
  })

  const text = await res.text()
  const contentType = res.headers.get("content-type") || "text/plain"

  if (contentType.includes("application/json")) {
    try {
      const json = text ? JSON.parse(text) : {}
      return { ok: res.ok, status: res.status, contentType, body: json }
    } catch {
      // fallthrough
    }
  }

  return { ok: res.ok, status: res.status, contentType, body: text }
}

export async function POST(req: NextRequest) {
  // лимиты: 1 вопрос на каждый вызов /api/turbotaai-agent
  const access = await requireAccess(req, true)
  if (!access.ok) {
    return NextResponse.json(
      { error: "payment_required", reason: access.reason, grant: access.grant },
      { status: access.status },
    )
  }

  let payload: any = {}
  try {
    payload = await req.json()
  } catch {}

  const result = await forwardToN8N(payload)

  // история
  try {
    const deviceHash = req.cookies.get("turbotaai_device")?.value || ""
    const mode =
      typeof payload?.mode === "string" && payload.mode.trim()
        ? payload.mode.trim()
        : "chat"

    const q = typeof payload?.query === "string" ? payload.query.trim() : ""
    const email = typeof payload?.email === "string" ? payload.email.trim() : null

    if (deviceHash && q) {
      const title = q.slice(0, 80)
      const convId = await getOrCreateConversationId({
        deviceHash,
        mode,
        title,
        userEmail: email,
      })

      if (convId) {
        await appendMessage({ conversationId: convId, role: "user", text: q })

        const answer =
          typeof result.body === "string" ? result.body : JSON.stringify(result.body)
        await appendMessage({ conversationId: convId, role: "assistant", text: String(answer || "").trim() })
      }
    }
  } catch (e) {
    console.warn("History save failed:", e)
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: `Webhook returned ${result.status}`, status: result.status, body: result.body },
      { status: 502 },
    )
  }

  if (typeof result.body === "string") {
    return new NextResponse(result.body, {
      status: 200,
      headers: { "Content-Type": result.contentType },
    })
  }

  return NextResponse.json(result.body, { status: 200 })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)

  const query =
    url.searchParams.get("query") ||
    url.searchParams.get("q") ||
    url.searchParams.get("text") ||
    url.searchParams.get("message")

  if (!query) {
    return NextResponse.json({ ok: true })
  }

  const language = url.searchParams.get("language") || "uk"
  const email = url.searchParams.get("email") || url.searchParams.get("userEmail") || "guest@example.com"
  const mode = url.searchParams.get("mode") || "video"

  // GET тоже считаем как вопрос
  const access = await requireAccess(req, true)
  if (!access.ok) {
    return NextResponse.json(
      { error: "payment_required", reason: access.reason, grant: access.grant },
      { status: access.status },
    )
  }

  const payload = { query, language, email, mode }
  const result = await forwardToN8N(payload)

  if (!result.ok) {
    return NextResponse.json(
      { error: `Webhook returned ${result.status}`, status: result.status, body: result.body },
      { status: 502 },
    )
  }

  if (typeof result.body === "string") {
    return new NextResponse(result.body, {
      status: 200,
      headers: { "Content-Type": result.contentType },
    })
  }

  return NextResponse.json(result.body, { status: 200 })
}

export const dynamic = "force-dynamic"
