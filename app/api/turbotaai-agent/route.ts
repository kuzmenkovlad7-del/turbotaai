import { type NextRequest, NextResponse } from "next/server"
import { requireAccess } from "@/lib/access/access-control"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const FALLBACK_WEBHOOK_URL = "https://vladkuzmenko.com/webhook/turbotaai-agent"

// Важно: используем только серверные переменные, НЕ NEXT_PUBLIC, чтобы не словить рекурсию
const WEBHOOK_URL =
  process.env.TURBOTA_AGENT_WEBHOOK_URL ||
  process.env.N8N_TURBOTA_AGENT_WEBHOOK_URL ||
  FALLBACK_WEBHOOK_URL

function isBadWebhookUrl(url: string) {
  const u = String(url || "").trim()
  if (!u) return true
  if (u.startsWith("/")) return true
  if (u.includes("/api/turbotaai-agent")) return true
  if (u.includes("/api/chat")) return true
  return false
}

export async function POST(request: NextRequest) {
  try {
    if (isBadWebhookUrl(WEBHOOK_URL)) {
      return NextResponse.json(
        { ok: false, error: "Bad webhook URL. Check TURBOTA_AGENT_WEBHOOK_URL or N8N_TURBOTA_AGENT_WEBHOOK_URL" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const query = String(body?.query ?? body?.message ?? body?.text ?? "").trim()
    const language = String(body?.language ?? "uk")
    const userEmail = String(body?.user ?? body?.email ?? "guest@example.com")

    if (!query) {
      return NextResponse.json({ ok: false, error: "Empty query" }, { status: 400, headers: { "cache-control": "no-store" } })
    }

    const access = await requireAccess(request, true)
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: "payment_required", reason: access.reason, grant: access.grant },
        { status: access.status, headers: { "cache-control": "no-store" } }
      )
    }

    const payload = {
      ...body,
      query,
      language,
      user: userEmail,
    }

    const r = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    })

    const raw = await r.text()

    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: "Webhook failed", httpStatus: r.status, body: raw },
        { status: 502, headers: { "cache-control": "no-store" } }
      )
    }

    try {
      const json = JSON.parse(raw)
      return NextResponse.json(json, { status: 200, headers: { "cache-control": "no-store" } })
    } catch {
      return NextResponse.json({ ok: true, response: raw }, { status: 200, headers: { "cache-control": "no-store" } })
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "Agent route failed", details: String(e?.message || e) },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}

export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200, headers: { "cache-control": "no-store" } })
}
