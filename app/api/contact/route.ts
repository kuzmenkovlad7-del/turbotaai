// app/api/contact/route.ts
import { NextRequest, NextResponse } from "next/server"

const RESEND_API_KEY = process.env.RESEND_API_KEY
const CONTACT_RECIPIENT = process.env.CONTACT_RECIPIENT || "support@turbotaai.com"
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://turbotaai.com"

export async function POST(req: NextRequest) {
  try {
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not set")
      return NextResponse.json(
        { success: false, error: "Email service not configured" },
        { status: 500 },
      )
    }

    const body = await req.json()

    const {
      name,
      email,
      message,
      company,
      topic,
      preferredChannel, // "chat" | "call" | "video"
    } = body || {}

    if (!email || !message) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      )
    }

    const subject = `Новый запрос с сайта TurbotaAI${topic ? `: ${topic}` : ""}`

    const text = `
Имя: ${name || "-"}
Email: ${email}
Компания: ${company || "-"}
Тема/тип запроса: ${topic || "-"}
Предпочтительный формат: ${preferredChannel || "-"}

Сообщение:
${message}

---

Отправлено с формы обратной связи TurbotaAI (${SITE_URL})
    `.trim()

    const html = `
      <h2>Новый запрос с сайта TurbotaAI</h2>
      <p><strong>Имя:</strong> ${name || "-"}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Компания:</strong> ${company || "-"}</p>
      <p><strong>Тема/тип запроса:</strong> ${topic || "-"}</p>
      <p><strong>Предпочтительный формат:</strong> ${preferredChannel || "-"}</p>
      <hr />
      <p><strong>Сообщение:</strong></p>
      <p>${(message || "").replace(/\n/g, "<br />")}</p>
      <hr />
      <p style="font-size:12px;color:#888;">
        Отправлено с формы обратной связи TurbotaAI (${SITE_URL})
      </p>
    `

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "TurbotaAI <no-reply@turbotaai.com>",
        to: [CONTACT_RECIPIENT],
        reply_to: email,
        subject,
        text,
        html,
      }),
    })

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text()
      console.error("Resend error:", errorText)

      return NextResponse.json(
        { success: false, error: "Failed to send email" },
        { status: 500 },
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: "Ваш запит надіслано. Ми відповімо якнайшвидше.",
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Contact form error:", error)
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    )
  }
}
