// app/api/chat/route.ts
import { NextResponse } from "next/server"

type ChatBody = {
  query: string
  language?: string
  email?: string | null
  mode?: "chat" | "voice" | "video" | string
  characterId?: string | null // добавили
}

function buildSystemPrompt(language: string, mode?: string) {
  const isVoice = mode === "voice" || mode === "voice_call"
  const lang = language || "en"

  if (lang.startsWith("ru")) {
    return (
      "Ты эмпатичный, спокойный ИИ-психолог сервиса TurbotaAI. " +
      "Разговаривай с человеком как с живым клиентом: мягко, без осуждения, " +
      "помогай прояснить чувства и следующие шаги. " +
      "Никогда не ставь диагнозы и не давай медицинских рекомендаций. " +
      "В опасных ситуациях говори, что нужно срочно обратиться к живому специалисту или в экстренные службы. " +
      (isVoice
        ? "Отвечай так, как будто говоришь голосом: 1–3 коротких предложения, простым языком."
        : "Отвечай структурировано, но коротко: до 4–6 предложений, без лишней воды.")
    )
  }

  if (lang.startsWith("uk")) {
    return (
      "Ти емпатичний, спокійний ШІ-психолог сервісу MyITRA. " +
      "Спілкуйся з людиною як з живим клієнтом: мʼяко, без осуду, " +
      "допомагай прояснити почуття та наступні кроки. " +
      "Ніколи не став діагнози і не давай медичних рекомендацій. " +
      "У небезпечних ситуаціях кажи, що потрібно негайно звернутися до живого спеціаліста або в екстрені служби. " +
      (isVoice
        ? "Відповідай так, ніби говориш голосом: 1–3 короткі речення, простою мовою."
        : "Відповідай структуровано, але коротко: до 4–6 речень, без зайвої води.")
    )
  }

  // EN default
  return (
    "You are an empathetic, calm AI-psychologist for the MyITRA service. " +
    "Talk to the user like a real therapist: gently, without judgement, " +
    "help them clarify feelings and next steps. " +
    "Never give medical diagnoses or strict medical advice. " +
    "If there is any risk of self-harm or danger, always tell them to immediately contact local emergency services or a real professional. " +
    (isVoice
      ? "Answer as if you are speaking out loud: 1–3 short sentences, simple language."
      : "Answer in a compact, structured way: up to 4–6 sentences, no unnecessary fluff.")
  )
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatBody
    const { query, language = "en", email, mode = "chat" } = body

    if (!query || typeof query !== "string") {
      return NextResponse.json({ text: "" }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error("OPENAI_API_KEY is missing")
      return NextResponse.json(
        {
          text:
            "AI assistant is temporarily unavailable. Please try again a bit later.",
        },
        { status: 500 },
      )
    }

    const systemPrompt = buildSystemPrompt(language, mode)

    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...(email
          ? [
              {
                role: "system" as const,
                content: `User email (if provided): ${email}`,
              },
            ]
          : []),
        { role: "user", content: query },
      ],
      temperature: 0.8,
      max_tokens: 600,
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => "")
      console.error("OpenAI error:", response.status, errText)
      return NextResponse.json(
        {
          text:
            "AI assistant is temporarily unavailable. Please try again later.",
        },
        { status: 500 },
      )
    }

    const data = (await response.json()) as any
    const text =
      data?.choices?.[0]?.message?.content?.trim() ||
      "I'm sorry, I couldn't process your message. Please try again."

    return NextResponse.json({ text })
  } catch (error) {
    console.error("API /api/chat error:", error)
    return NextResponse.json(
      {
        text:
          "AI assistant is temporarily unavailable. Please try again later.",
      },
      { status: 500 },
    )
  }
}
