import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, message } = body as {
      name?: string;
      email?: string;
      message?: string;
    };

    if (!email || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    const to = process.env.CONTACT_RECEIVER_EMAIL;

    if (!apiKey || !domain || !to) {
      console.error("Mailgun env vars are not set.");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const params = new URLSearchParams();
    params.append("from", `TurbotaAI <no-reply@${domain}>`);
    params.append("to", to);
    params.append("subject", "Нове звернення з сайту TurbotaAI");
    params.append(
      "text",
      [
        "Нове повідомлення з контактної форми TurbotaAI:",
        "",
        `Ім'я: ${name || "—"}`,
        `Email: ${email}`,
        "",
        "Повідомлення:",
        message,
        "",
        "— Автоматичне повідомлення TurbotaAI",
      ].join("\n")
    );

    const auth = Buffer.from(`api:${apiKey}`).toString("base64");

    const mailgunRes = await fetch(
      `https://api.mailgun.net/v3/${domain}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    if (!mailgunRes.ok) {
      const text = await mailgunRes.text();
      console.error("Mailgun error:", mailgunRes.status, text);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
