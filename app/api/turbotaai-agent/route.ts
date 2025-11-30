import { NextRequest, NextResponse } from "next/server"

const N8N_WEBHOOK_URL =
  process.env.N8N_TURBOTA_AGENT_WEBHOOK_URL ||
  "https://n8n.vladkuzmenko.com/webhook/turbotaai-agent"

export async function GET(req: NextRequest) {
  const clientUrl = new URL(req.url)
  const n8nUrl = new URL(N8N_WEBHOOK_URL)

  // пробрасываем все query-параметры
  clientUrl.searchParams.forEach((value, key) => {
    n8nUrl.searchParams.set(key, value)
  })

  const res = await fetch(n8nUrl.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })

  const text = await res.text()

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "text/plain",
    },
  })
}
