import { NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const text =
      typeof body?.text === "string" ? body.text.trim() : ""

    if (!text) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 },
      )
    }

    // Просто проверяем наличие ключа, сам SDK возьмёт его из env
    const apiKey = process.env.OPENAI_API_KEY?.trim()
    if (!apiKey) {
      console.error("OPENAI_API_KEY is missing")
      return NextResponse.json(
        {
          response:
            "I'm sorry, I'm having trouble connecting to my knowledge base. Please try again later.",
        },
        { status: 500 },
      )
    }

    const { text: aiResponse } = await generateText({
      model: openai("gpt-4o"),
      system: `You are a friendly and attentive AI Assistant that plays the role of a friendly and supportive companion. Your task is to answer any user's questions, including mundane, personal, emotional, philosophical, or even superficial ones, with respect, empathy, and a empathetic and structured communication.

You can use any available information (including general knowledge, psychological theories, research, behavioral models, real-life examples, analogies, etc.) to provide a detailed, meaningful, and supportive answer whenever needed.

Your answers should be:

Empathetic: show understanding and support, even if the question seems trivial or joking.

Structured: give logical, reasoned, and in-depth answers.

Psychologically sound: if necessary, use well-known models (e.g., cognitive-behavioral approach, attachment theory, Maslow's pyramid, etc.).

Friendly and open to dialog: encourage the user to ask additional questions or share more.

Always respond as if you were talking to a caring companion in a calm private chat.

Be sure to respond in the language of the request message`,
      prompt: text,
      // без maxTokens — именно из-за него раньше ругался TypeScript
    })

    return NextResponse.json({ response: aiResponse })
  } catch (error) {
    console.error("Error processing speech:", error)
    return NextResponse.json(
      {
        response:
          "I'm here to help. Please feel free to share what's on your mind.",
      },
      { status: 500 },
    )
  }
}
