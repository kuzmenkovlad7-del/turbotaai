// myitra-assistant-core/app/api/contact/route.ts
import { NextResponse } from 'next/server'
import {
  CONTACT_EMAIL_FROM,
  CONTACT_EMAIL_TO,
  SITE_NAME,
} from '@/lib/app-config'

function getMailgunAuthHeader() {
  const apiKey = process.env.MAILGUN_API_KEY
  if (!apiKey) {
    throw new Error('MAILGUN_API_KEY is not set')
  }
  const token = Buffer.from(`api:${apiKey}`).toString('base64')
  return `Basic ${token}`
}

export async function POST(request: Request) {
  try {
    const { name, email, message } = await request.json()

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Missing fields' },
        { status: 400 },
      )
    }

    const domain =
      process.env.MAILGUN_DOMAIN || 'turbotaai.com'

    const params = new URLSearchParams({
      from: CONTACT_EMAIL_FROM,
      to: CONTACT_EMAIL_TO,
      subject: `[${SITE_NAME}] Новий запит з форми`,
      text: [
        `Ім'я: ${name}`,
        `Email: ${email}`,
        '',
        'Повідомлення:',
        message,
      ].join('\n'),
    })

    const res = await fetch(
      `https://api.mailgun.net/v3/${domain}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: getMailgunAuthHeader(),
          'Content-Type':
            'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    )

    if (!res.ok) {
      const text = await res.text()
      console.error('Mailgun error:', text)
      return NextResponse.json(
        { error: 'Mail service error' },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Contact API error', error)
    return NextResponse.json(
      { error: 'Unexpected error' },
      { status: 500 },
    )
  }
}
