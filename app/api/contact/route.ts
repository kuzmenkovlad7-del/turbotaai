// app/api/contact/route.ts
import { NextRequest, NextResponse } from "next/server"

const N8N_WEBHOOK_URL = process.env.N8N_CONTACT_WEBHOOK_URL

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "Invalid payload" },
        { status: 400 },
      )
    }

    const { name, email, message } = body as {
      name?: string
      email?: string
      message?: string
    }

    if (!email || !message) {
      return NextResponse.json(
        {
          success: false,
          message: "Email та повідомлення обовʼязкові.",
        },
        { status: 400 },
      )
    }

    if (!N8N_WEBHOOK_URL) {
      console.error("N8N_CONTACT_WEBHOOK_URL is not set")
      return NextResponse.json(
        {
          success: false,
          message:
            "Форма тимчасово недоступна. Спробуйте, будь ласка, пізніше.",
        },
        { status: 500 },
      )
    }

    const resp = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "turbotaai-contact-form",
        name: name || null,
        email,
        message,
      }),
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => "")
      console.error("n8n webhook error:", resp.status, text)

      return NextResponse.json(
        {
          success: false,
          message:
            "Не вдалося надіслати повідомлення. Спробуйте, будь ласка, пізніше.",
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message:
        "Ваше повідомлення надіслано. Ми відповімо протягом 24 годин.",
    })
  } catch (error) {
    console.error("Contact API error:", error)

    return NextResponse.json(
      {
        success: false,
        message:
          "Не вдалося надіслати повідомлення. Спробуйте, будь ласка, пізніше.",
      },
      { status: 500 },
    )
  }
}
