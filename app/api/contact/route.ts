// app/api/contact/route.ts
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const webhookUrl = process.env.N8N_CONTACT_WEBHOOK_URL
    if (!webhookUrl) {
      console.error("N8N_CONTACT_WEBHOOK_URL is not set")
      return NextResponse.json(
        { ok: false, error: "Config error" },
        { status: 500 },
      )
    }

    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "myitra-contact-form",
        ...body,
      }),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Contact API error:", error)
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    )
  }
}
