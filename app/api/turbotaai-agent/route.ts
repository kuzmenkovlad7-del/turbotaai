import { type NextRequest, NextResponse } from "next/server"
import { requireAccess } from "@/lib/access/access-control"
import { resolveAuthUserId } from "@/lib/auth/resolve-user"
import { normalizeGender } from "@/lib/payload"

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
    const mode = String(body?.mode ?? "chat")

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

    // Normalize identity fields — never send "guest@example.com"
    const rawUserId = body?.userId
    const bodyUserId = (typeof rawUserId === "string" && rawUserId.trim()) ? rawUserId.trim() : null

    // Server auth reconciliation: resolve real userId from Supabase session cookies
    const authUserId = await resolveAuthUserId(request)
    const userId = authUserId || bodyUserId

    if (authUserId && !bodyUserId) {
      console.warn("[turbotaai-agent] Auth reconciliation: body.userId was null but server auth resolved:", authUserId)
    }

    // ── Pre-webhook payload preparation ─────────────────────────────────────
    // Wrapped so that any unexpected throw is visible in Vercel logs with a
    // clear label, rather than silently becoming "Agent route failed".
    let clientMessageId: string
    let sessionId: string
    let deviceId: string
    let timestamp: string
    let email: string | undefined
    let user: string
    let characterId: string
    let genderNorm: "male" | "female"
    let voiceId: string | null
    let voiceLanguage: string | null

    try {
      clientMessageId = String(body?.clientMessageId || crypto.randomUUID())
      sessionId = String(body?.sessionId || `sess_${clientMessageId}`)
      deviceId = String(body?.deviceId ?? "")
      timestamp = String(body?.timestamp || new Date().toISOString())
      email = body?.email || undefined
      user = userId ?? `guest:${sessionId}`

      // Gender normalization: resolve from any frontend field, never "unknown"
      characterId = (typeof body?.characterId === "string" && body.characterId.trim())
        ? body.characterId.trim()
        : "mia"
      const rawGender = normalizeGender(body?.gender ?? body?.roleGender ?? body?.assistantGender)
      genderNorm = rawGender ?? (characterId === "leo" || characterId === "alex" ? "male" : "female")
      voiceId = (typeof body?.voiceId === "string" && body.voiceId.trim()) ? body.voiceId.trim() : null
      voiceLanguage = (typeof body?.voiceLanguage === "string" && body.voiceLanguage.trim())
        ? body.voiceLanguage.trim()
        : (typeof body?.language === "string" && body.language.trim()) ? body.language.trim() : null
    } catch (prepErr: any) {
      console.error("[turbotaai-agent] CRASH in pre-webhook payload prep:", prepErr?.message, prepErr?.stack)
      return NextResponse.json(
        { ok: false, error: "Agent route failed", details: String(prepErr?.message || prepErr) },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }

    if (mode === "voice" || mode === "video") {
      console.debug(`[turbotaai-agent] mode=${mode} gender=${genderNorm} characterId=${characterId} voiceId=${voiceId}`)
    }

    const payload = {
      query,
      language,
      mode,
      userId,
      sessionId,
      deviceId,
      clientMessageId,
      timestamp,
      user,
      ...(email ? { email } : {}),
      gender: genderNorm,
      roleGender: genderNorm,
      assistantGender: genderNorm,
      characterId,
      voiceId,
      voiceLanguage,
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

    // Attach remainingQuestions so mobile can update the trial counter without
    // a separate bootstrap round-trip. Only relevant for trial users (no paid/promo).
    const grant = access.grant
    const isTrialUser = grant && !grant.paid_until && !grant.promo_until
    const remainingQuestions: number | null = isTrialUser
      ? (typeof grant.trial_questions_left === "number" ? grant.trial_questions_left : null)
      : null

    try {
      const json = JSON.parse(raw)
      const extra = remainingQuestions !== null ? { remainingQuestions } : {}
      // n8n sometimes returns an array of objects — normalize to the first element
      // so extractReplyText (which checks data.output / data.text / data.response)
      // can always find the text regardless of whether n8n used array or object form.
      const body = Array.isArray(json) ? (json[0] ?? {}) : json
      return NextResponse.json({ ...body, ...extra }, { status: 200, headers: { "cache-control": "no-store" } })
    } catch {
      const extra = remainingQuestions !== null ? { remainingQuestions } : {}
      return NextResponse.json({ ok: true, response: raw, ...extra }, { status: 200, headers: { "cache-control": "no-store" } })
    }
  } catch (e: any) {
    console.error("[turbotaai-agent] OUTER CATCH — unexpected throw:", e?.message, e?.stack ?? String(e))
    return NextResponse.json(
      { ok: false, error: "Agent route failed", details: String(e?.message || e) },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}

export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200, headers: { "cache-control": "no-store" } })
}
