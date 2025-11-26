// app/api/chat/route.ts
import { NextResponse } from "next/server"
import OpenAI from "openai"

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const BASE_SYSTEM_PROMPT = `
You are TurbotaAI, an empathetic AI-psychologist assistant for an online mental health platform.

Your goals:
- Provide short, clear, supportive responses.
- Always first clarify the situation with questions, then give recommendations.
- Never give 20 советов сразу. 2–3 конкретных шага максимум.
- If the user is in crisis (suicidal, self-harm, acute psychosis) — gently recommend обратиться к живому специалисту/службам помощи.
- Adapt your style for women 30–50 with stress, anxiety, emotional burnout, loneliness; also teens 12–18 (soft, careful tone).

Language rules:
- Always answer in the language specified by the "language" field (uk, ru, en, etc.).
- For Ukrainian and Russian — обращайся на "Вы".
- Keep phrases short, without water, but emotionally warm.

Conversation format:
- 1–3 уточняющих вопроса в начале ("Что сейчас беспокоит больше всего?", "Что вы чувствуете в теле?" и т.п.)
- затем короткое упражнение или практика (дыхание, grounding, дневник эмоций)
- затем мягкая рекомендация, что делать дальше (например, вести дневник, повторить упражнение, обсудить с близким/специалистом)
`

export async function POST(req: Request) {
  try {
    const { query, language, email } = await req.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { text: "Сервіс тимчасово недоступний: не налаштовано ключ OpenAI." },
        { status: 500 }
      )
    }

    if (!query || typeof query !== "string") {
      return NextResponse.json({ text: "Будь ласка, напишіть повідомлення." }, { status: 400 })
    }

    const langCode = typeof language === "string" && language.length <= 5 ? language : "uk"

    const system = `${BASE_SYSTEM_PROMPT}\nCurrent UI language code: ${langCode}.\nUser email (may be null): ${
      email ?? "guest"
    }`

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: query },
      ],
    })

    const text =
      completion.choices[0]?.message?.content ||
      "Вибачте, зараз не вдалося обробити запит. Спробуйте, будь ласка, ще раз."

    return NextResponse.json({ text })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json(
      { text: "Вибачте, трапилась помилка. Будь ласка, спробуйте ще раз пізніше." },
      { status: 500 }
    )
  }
}
