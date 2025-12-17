import OpenAI from "openai"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function pickFilename(ctRaw: string | null): string {
  const ct = (ctRaw || "").toLowerCase()
  if (ct.includes("webm")) return "speech.webm"
  if (ct.includes("mp4")) return "speech.mp4"
  if (ct.includes("mpeg") || ct.includes("mp3")) return "speech.mp3"
  if (ct.includes("wav")) return "speech.wav"
  if (ct.includes("ogg")) return "speech.ogg"
  return "speech.audio"
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { success: false, error: "OPENAI_API_KEY is not set" },
        { status: 500 },
      )
    }

    const ct = req.headers.get("content-type")
    const ab = await req.arrayBuffer()
    if (!ab || ab.byteLength === 0) {
      return Response.json(
        { success: false, error: "Empty audio body" },
        { status: 400 },
      )
    }

    const url = new URL(req.url)
    const lang = (url.searchParams.get("lang") || "").toLowerCase()
    const language =
      lang === "uk" || lang === "ru" || lang === "en" ? (lang as any) : undefined

    const bytes = new Uint8Array(ab)
    const blob = new Blob([bytes], { type: ct || "application/octet-stream" })
    const file = new File([blob], pickFilename(ct), {
      type: ct || "application/octet-stream",
    })

    const tr = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language,
    })

    return Response.json({ success: true, text: tr.text || "" })
  } catch (e: any) {
    return Response.json(
      { success: false, error: e?.message || "STT error" },
      { status: 500 },
    )
  }
}
