import OpenAI from "openai"
import { NextRequest, NextResponse } from "next/server"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function pickExt(contentType: string) {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("webm")) return "webm"
  if (ct.includes("ogg")) return "ogg"
  if (ct.includes("wav")) return "wav"
  if (ct.includes("mpeg") || ct.includes("mp3")) return "mp3"
  if (ct.includes("mp4") || ct.includes("m4a")) return "m4a"
  return "bin"
}

function normLang(v: string | null): "uk" | "ru" | "en" | undefined {
  const s = (v || "").toLowerCase().trim()
  if (!s) return undefined
  if (s === "uk" || s.startsWith("uk-") || s.includes("ukrain")) return "uk"
  if (s === "ru" || s.startsWith("ru-") || s.includes("russian")) return "ru"
  if (s === "en" || s.startsWith("en-") || s.includes("english")) return "en"
  return undefined
}

function hasCyrillic(text: string) {
  return /[А-Яа-яІіЇїЄєҐґ]/.test(text || "")
}
function hasLatin(text: string) {
  return /[A-Za-z]/.test(text || "")
}

function normalizeText(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[.,!?;:"'(){}\[\]<>«»“”„…—–]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function countAny(text: string, re: RegExp) {
  const m = (text || "").match(re)
  return m ? m.length : 0
}

function wordHits(t: string, words: string[]) {
  // без Set/for..of по Set (чтобы не словить target es5 проблемы)
  let c = 0
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const re = new RegExp("(^|\\s)" + w + "(\\s|$)", "g")
    c += countAny(t, re)
  }
  return c
}

function langScore(text: string, lang: "uk" | "ru") {
  const t = (" " + normalizeText(text) + " ").replace(/\s+/g, " ")
  const ukLetters = countAny(t, /[іїєґ]/g)
  const ruLetters = countAny(t, /[ыэъё]/g)

  const ukWords = wordHits(t, [
    "будь","ласка","дякую","що","це","мені","тобі","зараз","дуже","привіт","вітаю","як","справи",
    "будьмо","перепрошую","будь-який","сьогодні","вибач","вибачте",
  ])

  const ruWords = wordHits(t, [
    "пожалуйста","спасибо","что","это","мне","тебе","сейчас","очень","привет","здравствуй","здравствуйте","как","дела",
    "извините","сегодня",
  ])

  if (lang === "uk") return ukLetters * 6 + ukWords * 2 - ruLetters * 5 - ruWords
  return ruLetters * 6 + ruWords * 2 - ukLetters * 5 - ukWords
}

function looksLikeEnglish(text: string) {
  const t = " " + normalizeText(text) + " "
  // простая эвристика — чтобы не “перетранскрибировать” нормальный английский
  const hits =
    (t.includes(" how ") ? 1 : 0) +
    (t.includes(" what ") ? 1 : 0) +
    (t.includes(" thank ") ? 1 : 0) +
    (t.includes(" you ") ? 1 : 0) +
    (t.includes(" are ") ? 1 : 0) +
    (t.includes(" i ") ? 1 : 0) +
    (t.includes(" we ") ? 1 : 0) +
    (t.includes(" today ") ? 1 : 0)
  return hits >= 2
}

function tokenize(text: string) {
  const t = normalizeText(text)
  if (!t) return [] as string[]
  return t.split(" ").filter(Boolean)
}

function overlapRatio(a: string, b: string) {
  const A = tokenize(a)
  const B = tokenize(b)
  if (!A.length || !B.length) return 0

  const map: Record<string, number> = {}
  for (let i = 0; i < A.length; i++) map[A[i]] = 1

  let inter = 0
  for (let j = 0; j < B.length; j++) if (map[B[j]] === 1) inter++

  const denom = Math.max(A.length, B.length)
  return denom ? inter / denom : 0
}

function isHallucination(text: string) {
  const t = normalizeText(text)
  if (!t) return true

  // известные “тишинные” фразы
  const bad = [
    "thank you for watching",
    "thanks for watching",
    "subscribe",
    "like and subscribe",
  ]
  for (let i = 0; i < bad.length; i++) {
    if (t.includes(bad[i])) return true
  }

  // если почти нет букв — мусор
  const letters = countAny(t, /[a-zа-яіїєґ]/g)
  if (letters < 3) return true

  // если одно и то же слово повторяется
  const toks = tokenize(t)
  if (toks.length >= 3) {
    const first = toks[0]
    let same = 0
    for (let i = 0; i < toks.length; i++) if (toks[i] === first) same++
    if (same / toks.length > 0.85) return true
  }

  return false
}

async function transcribe(file: File, language?: "uk" | "ru" | "en") {
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
    const contentType = contentTypeRaw.split(";")[0].trim() || contentTypeRaw
    const ext = pickExt(contentType)

    const debug = (req.headers.get("x-debug") || req.headers.get("X-Debug") || "") === "1"

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
      req.headers.get("X-STT-Lang") ||
      ""

    const hint = normLang(String(hintRaw || ""))

    const file = new File([buf], `audio.${ext}`, { type: contentType || "application/octet-stream" })

    // 1) базовая автодетекция (НЕ переводим, не переписываем)
    const trAuto: any = await transcribe(file, undefined)
    const baseText = String(trAuto?.text ?? "").trim()

    if (!baseText) {
      return NextResponse.json({ success: true, text: "", language: undefined }, { status: 200 })
    }

    // защита от “тишины”
    if (isHallucination(baseText)) {
      return NextResponse.json(
        { success: true, text: "", language: undefined, ...(debug ? { debug: { dropped: true, baseText } } : {}) },
        { status: 200 }
      )
    }

    const baseHasCyr = hasCyrillic(baseText)
    const baseHasLat = hasLatin(baseText)

    // 2) если латиница и это похоже на нормальный английский — оставляем en
    if (baseHasLat && !baseHasCyr && looksLikeEnglish(baseText)) {
      return NextResponse.json(
        { success: true, text: baseText, language: "en", ...(debug ? { debug: { kind: "en_base", baseText } } : {}) },
        { status: 200 }
      )
    }

    // 3) если латиница, но UI ждёт ru/uk — перетранскрибируем ru+uk и выберем (это чинит “jak sprawy”)
    if (baseHasLat && !baseHasCyr && (hint === "uk" || hint === "ru")) {
      const trRu: any = await transcribe(file, "ru")
      const trUk: any = await transcribe(file, "uk")

      const txtRu = String(trRu?.text ?? "").trim()
      const txtUk = String(trUk?.text ?? "").trim()

      const dRu = langScore(txtRu, "uk") - langScore(txtRu, "ru")
      const dUk = langScore(txtUk, "uk") - langScore(txtUk, "ru")

      // выбираем более “уверенный” вариант (по модулю)
      const pickUk = Math.abs(dUk) > Math.abs(dRu) ? dUk > 0 : dRu > 0
      const picked = pickUk ? "uk" : "ru"
      const pickedText = pickUk ? txtUk : txtRu

      if (!pickedText || isHallucination(pickedText)) {
        return NextResponse.json(
          { success: true, text: "", language: undefined, ...(debug ? { debug: { kind: "latin_drop", baseText, txtRu, txtUk } } : {}) },
          { status: 200 }
        )
      }

      return NextResponse.json(
        { success: true, text: pickedText, language: picked, ...(debug ? { debug: { kind: "latin_non_en_ruuk", hint, baseText, txtRu, txtUk, dRu, dUk, picked } } : {}) },
        { status: 200 }
      )
    }

    // 4) кириллица → делаем ru+uk и выбираем (НО БЕЗ автоперевода/словарей)
    if (baseHasCyr) {
      const trRu: any = await transcribe(file, "ru")
      const trUk: any = await transcribe(file, "uk")

      const txtRu = String(trRu?.text ?? "").trim()
      const txtUk = String(trUk?.text ?? "").trim()

      // если один пустой — берём другой
      if (!txtRu && txtUk) {
        return NextResponse.json(
          { success: true, text: txtUk, language: "uk", ...(debug ? { debug: { kind: "cyr_only_uk", hint, baseText, txtUk } } : {}) },
          { status: 200 }
        )
      }
      if (!txtUk && txtRu) {
        return NextResponse.json(
          { success: true, text: txtRu, language: "ru", ...(debug ? { debug: { kind: "cyr_only_ru", hint, baseText, txtRu } } : {}) },
          { status: 200 }
        )
      }

      const dRu = langScore(txtRu, "uk") - langScore(txtRu, "ru") // >0 => uk-like, <0 => ru-like
      const dUk = langScore(txtUk, "uk") - langScore(txtUk, "ru")

      // базовый выбор — по уверенности (|delta|)
      let picked: "uk" | "ru"
      let pickedText: string
      if (Math.abs(dUk) > Math.abs(dRu)) {
        picked = dUk > 0 ? "uk" : "ru"
        pickedText = txtUk
      } else {
        picked = dRu > 0 ? "uk" : "ru"
        pickedText = txtRu
      }

      // безопасный тай-брейк по hint ТОЛЬКО если тексты почти одинаковые (чтобы не “переводить”)
      if ((hint === "uk" || hint === "ru") && txtRu && txtUk) {
        const ov = overlapRatio(txtRu, txtUk)
        if (ov >= 0.85) {
          picked = hint
          pickedText = hint === "uk" ? txtUk : txtRu
        }
      }

      if (!pickedText || isHallucination(pickedText)) {
        return NextResponse.json(
          { success: true, text: "", language: undefined, ...(debug ? { debug: { kind: "cyr_drop", baseText, txtRu, txtUk } } : {}) },
          { status: 200 }
        )
      }

      return NextResponse.json(
        { success: true, text: pickedText, language: picked, ...(debug ? { debug: { kind: "cyr_ruuk", hint, baseText, txtRu, txtUk, dRu, dUk, picked } } : {}) },
        { status: 200 }
      )
    }

    // 5) остальное → вернём base как есть, но язык только en/undefined (чтобы не было “польского режима”)
    if (baseHasLat) {
      return NextResponse.json(
        { success: true, text: baseText, language: "en", ...(debug ? { debug: { kind: "latin_fallback_en", baseText } } : {}) },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { success: true, text: baseText, language: undefined, ...(debug ? { debug: { kind: "unknown", baseText } } : {}) },
      { status: 200 }
    )
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
