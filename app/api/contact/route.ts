import { NextResponse } from "next/server"
import nodemailer from "nodemailer"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, subject, message } = body

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      )
    }

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT || 587),
      secure: false,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    })

    const to = process.env.CONTACT_FORM_RECIPIENT || process.env.EMAIL_SERVER_USER

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
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
    console.error("Contact form error:", error)
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    )
  }
}
