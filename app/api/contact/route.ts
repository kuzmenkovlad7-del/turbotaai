// app/api/contact/route.ts
import { NextResponse } from "next/server"
import nodemailer from "nodemailer"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, subject, message } = body

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 },
      )
    }

    const webhookUrl = process.env.N8N_CONTACT_WEBHOOK_URL

    // Вариант 1 — отправляем в n8n
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "turbotaai-contact-form",
          name,
          email,
          subject,
          message,
        }),
      })

      return NextResponse.json({ ok: true })
    }

    // Вариант 2 — отправляем напрямую на почту (Google Workspace)
    const host = process.env.EMAIL_SERVER_HOST
    const user = process.env.EMAIL_SERVER_USER
    const pass = process.env.EMAIL_SERVER_PASSWORD

    if (!host || !user || !pass) {
      console.error("No N8N webhook or SMTP config")
      return NextResponse.json(
        { ok: false, error: "Config error" },
        { status: 500 },
      )
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.EMAIL_SERVER_PORT || 587),
      secure: false,
      auth: {
        user,
        pass,
      },
    })

    const to =
      process.env.CONTACT_FORM_RECIPIENT || process.env.EMAIL_SERVER_USER

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || user,
      to,
      subject: `[TurbotaAI] ${subject}`,
      replyTo: email,
      text: `
Имя: ${name}
Email: ${email}

Сообщение:
${message}
      `.trim(),
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
