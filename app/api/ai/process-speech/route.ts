import { NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export async function POST(request: Request) {
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    // Проверяем, что ключ вообще существует (для надёжности),
    // но в сам openai() его НЕ передаём — ai-sdk берёт его из env.
    const apiKey = process.env.OPENAI_API_KEY?.trim()

    if (!apiKey) {
      console.error("OpenAI API key is missing")
      return NextResponse.json(
        {
          response:
            "I'm sorry, I'm having trouble connecting to my knowledge base. Please try again later.",
        },
        { status: 500 },
      )
    }

    // Генерация ответа через AI SDK
    const { text: aiResponse } = await generateText({
      model: openai("gpt-4o"), // или "gpt-4o-mini", если хочешь дешевле
      system: `You are a friendly and attentive AI Assistant that plays the role of a professional psychologist. Your task is to answer any user's questions, including mundane, personal, emotional, philosophical, or even superficial ones, with respect, empathy, and a deep understanding of psychology.

You can use any available information (including general knowledge, psychological theories, research, behavioral models, real-life examples, analogies, etc.) to provide a detailed, meaningful, and supportive answer whenever needed.

Your answers should be:

Empathetic: show understanding and support, even if the question seems trivial or joking.

Structured: give logical, reasoned, and in-depth answers.

Psychologically sound: if necessary, use well-known models (e.g., cognitive-behavioral approach, attachment theory, Maslow's pyramid, etc.).

Friendly and open to dialog: encourage the user to ask additional questions or share more.

Always respond as if you were talking to a real person in a psychologist's office.

Be sure to respond in the language of the request message`,
      prompt: text,
      // НИКАКИХ maxTokens здесь не указываем — именно из-за этого была вторая ошибка
    })

    return NextResponse.json({ response: aiResponse })
  } catch (error) {
    console.error("Error processing speech:", error)
    return NextResponse.json({
      response: "I'm here to help. Please feel free to share what's on your mind.",
    })
  }
}
