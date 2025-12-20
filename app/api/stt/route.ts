import OpenAI from "openai"
import { NextRequest, NextResponse } from "next/server"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

type Lang = "uk" | "ru" | "en"

function pickExt(contentType: string) {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("webm")) return "webm"
  if (ct.includes("ogg")) return "ogg"
  if (ct.includes("wav")) return "wav"
  if (ct.includes("mpeg") || ct.includes("mp3")) return "mp3"
  if (ct.includes("mp4") || ct.includes("m4a")) return "m4a"
  return "bin"
}

function normLang(v: string | null): Lang | undefined {
  const s = (v || "").toLowerCase().trim()
  if (!s) return undefined
  if (s === "uk" || s.startsWith("uk-") || s.includes("ukrain")) return "uk"
  if (s === "ru" || s.startsWith("ru-") || s.includes("russian")) return "ru"
  if (s === "en" || s.startsWith("en-") || s.includes("english")) return "en"
  return undefined
}

function countAny(text: string, re: RegExp) {
  const m = (text || "").match(re)
  return m ? m.length : 0
}

function wordHits(t: string, words: string[]) {
  let c = 0
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const re = new RegExp("(^|\\s)" + w + "(\\s|$)", "g")
    c += countAny(t, re)
  }
  return c
}

function hasCyrillic(text: string) {
  return /[А-Яа-яІіЇїЄєҐґ]/.test(text || "")
}
function hasLatin(text: string) {
  return /[A-Za-z]/.test(text || "")
}

function langScore(text: string, lang: "uk" | "ru") {
  const t = (" " + (text || "").toLowerCase() + " ").replace(/\s+/g, " ")

  // буквы-идентификаторы
  const ukLetters = countAny(t, /[іїєґ]/g)
  const ruLetters = countAny(t, /[ыэъё]/g)

  // слова-идентификаторы (включаем “як/справи/привіт” и “как/дела/привет”)
  const ukWords = wordHits(t, [
    "будь",
    "ласка",
    "дякую",
    "що",
    "це",
    "мені",
    "тобі",
    "зараз",
    "дуже",
    "як",
    "справи",
    "привіт",
    "сьогодні",
  ])

  const ruWords = wordHits(t, [
    "пожалуйста",
    "спасибо",
    "что",
    "это",
    "мне",
    "тебе",
    "сейчас",
    "очень",
    "как",
    "дела",
    "привет",
    "сегодня",
  ])

  if (lang === "uk") return ukLetters * 7 + ukWords * 3 - ruLetters * 6 - ruWords * 2
  return ruLetters * 7 + ruWords * 3 - ukLetters * 6 - ukWords * 2
}

function looksEnglish(text: string) {
  const t = (" " + (text || "").toLowerCase() + " ").replace(/\s+/g, " ")
  if (!hasLatin(t) || hasCyrillic(t)) return false

  // простой “english-детектор” по частым словам
  const enWords = ["the", "and", "you", "are", "what", "how", "today", "thank", "please", "help", "support", "can", "ready"]
  const hits = wordHits(t, enWords)
  return hits >= 1
}

function avgNoSpeechProb(tr: any): number | null {
  const segs = tr?.segments
  if (!Array.isArray(segs) || segs.length === 0) return null

  let sum = 0
  let n = 0
  for (let i = 0; i < segs.length; i++) {
    const p = Number(segs[i]?.no_speech_prob)
    if (!Number.isNaN(p)) {
      sum += p
      n++
    }
  }
  if (!n) return null
  return sum / n
}

function shouldDropAsSilence(tr: any, text: string) {
  const t = (text || "").trim()
  const ns = avgNoSpeechProb(tr)
  if (!t) return true

  // если Whisper сам говорит “это, скорее всего, не речь” — выкидываем
  if (ns != null) {
    if (ns >= 0.65) return true
    // короткие фразы на шуме — тоже режем агрессивнее
    if (t.length <= 32 && ns >= 0.55) return true
  }
  return false
}

async function transcribeOnce(file: File, language?: Lang) {
  const params: any = {
    model: process.env.OPENAI_STT_MODEL || "whisper-1",
    file,
    response_format: "verbose_json",
    temperature: 0,
  }
  if (language) params.language = language
  return await openai.audio.transcriptions.create(params)
}

export async function POST(req: NextRequest) {
  try {
    const contentTypeRaw = req.headers.get("content-type") || "application/octet-stream"
    const contentType = (contentTypeRaw.split(";")[0] || contentTypeRaw).trim()
    const ext = pickExt(contentType)

    const buf = Buffer.from(await req.arrayBuffer())
    if (!buf.length) {
      return NextResponse.json({ success: false, text: "", error: "empty_audio" }, { status: 400 })
    }

    const hintRaw =
      req.headers.get("x-stt-hint") ||
      req.headers.get("x-stt-language") ||
      req.headers.get("x-stt-lang") ||
      req.headers.get("X-STT-Hint") ||
      req.headers.get("X-STT-Language") ||
      ""

    const forceRaw = req.headers.get("x-stt-force") || req.headers.get("X-STT-Force") || ""
    const force = forceRaw === "1"

    const debugRaw = req.headers.get("x-debug") || req.headers.get("X-Debug") || ""
    const debug = debugRaw === "1"

    const hint = normLang(hintRaw)

    const file = new File([buf], `audio.${ext}`, { type: contentType || "application/octet-stream" })

    // FORCE: жёстко задан язык
    if (force && hint) {
      const trF: any = await transcribeOnce(file, hint)
      const textF = String(trF?.text ?? "").trim()
      if (!textF || shouldDropAsSilence(trF, textF)) {
        return NextResponse.json({ success: true, text: "", language: hint }, { status: 200 })
      }
      return NextResponse.json({ success: true, text: textF, language: hint }, { status: 200 })
    }

    // BASE
    const trBase: any = await transcribeOnce(file, undefined)
    const baseText = String(trBase?.text ?? "").trim()

    if (!baseText || shouldDropAsSilence(trBase, baseText)) {
      return NextResponse.json({ success: true, text: "", language: hint }, { status: 200 })
    }

    // 1) кириллица => сравниваем ru/uk (и выбираем только из этих двух)
    if (hasCyrillic(baseText)) {
      const pair = await Promise.all([transcribeOnce(file, "ru"), transcribeOnce(file, "uk")])
      const trRu: any = pair[0]
      const trUk: any = pair[1]

      const candRu = String(trRu?.text ?? "").trim()
      const candUk = String(trUk?.text ?? "").trim()

      const sRu = langScore(candRu, "ru")
      const sUk = langScore(candUk, "uk")
      const delta = Math.abs(sUk - sRu)

      // базовые “сигналы” из base (если есть)
      const base = (" " + baseText.toLowerCase() + " ")
      const baseHasUk = /[іїєґ]/.test(base)
      const baseHasRu = /[ыэъё]/.test(base)

      let picked: "uk" | "ru" = sUk > sRu ? "uk" : "ru"

      // если очень неоднозначно — используем hint, а если его нет — базовые буквы
      if (delta <= 3) {
        if (hint === "uk" || hint === "ru") picked = hint
        else if (baseHasUk && !baseHasRu) picked = "uk"
        else if (baseHasRu && !baseHasUk) picked = "ru"
      }

      const outText = picked === "uk" ? candUk : candRu

      if (debug) {
        console.log("[/api/stt] cyr", {
          hint,
          base: baseText,
          candRu,
          candUk,
          sRu,
          sUk,
          delta,
          picked,
        })
      }

      return NextResponse.json({ success: true, text: outText, language: picked }, { status: 200 })
    }

    // 2) латиница => либо en, либо принудительно ru/uk (чтобы не было польского/и т.д.)
    if (hasLatin(baseText)) {
      const isEn = looksEnglish(baseText)

      if (isEn) {
        if (debug) {
          console.log("[/api/stt] latin", { hint, base: baseText, picked: "en" })
        }
        return NextResponse.json({ success: true, text: baseText, language: "en" }, { status: 200 })
      }

      const pair = await Promise.all([transcribeOnce(file, "ru"), transcribeOnce(file, "uk")])
      const trRu: any = pair[0]
      const trUk: any = pair[1]

      const candRu = String(trRu?.text ?? "").trim()
      const candUk = String(trUk?.text ?? "").trim()

      const sRu = langScore(candRu, "ru")
      const sUk = langScore(candUk, "uk")
      const delta = Math.abs(sUk - sRu)

      let picked: "uk" | "ru" = sUk > sRu ? "uk" : "ru"
      if (delta <= 3 && (hint === "uk" || hint === "ru")) picked = hint

      const outText = picked === "uk" ? candUk : candRu

      if (debug) {
        console.log("[/api/stt] latin_non_en -> forced_ru_uk", {
          hint,
          base: baseText,
          candRu,
          candUk,
          sRu,
          sUk,
          delta,
          picked,
        })
      }

      return NextResponse.json({ success: true, text: outText, language: picked }, { status: 200 })
    }

    // fallback: отдаем как есть, но язык не заявляем
    if (debug) {
      console.log("[/api/stt] fallback", { hint, base: baseText })
    }
    return NextResponse.json({ success: true, text: baseText, language: hint }, { status: 200 })
  } catch (e: any) {
    console.error("[/api/stt] error:", e)

    const status = e?.status || e?.response?.status
    const code = e?.code || e?.error?.code

    if (status === 429 || code === "insufficient_quota") {
      return NextResponse.json({ success: false, text: "", error: "insufficient_quota" }, { status: 429 })
    }

    return NextResponse.json({ success: false, text: "", error: "stt_failed" }, { status: 500 })
  }
}
