export const OPENAI_TTS_MODEL = "gpt-4o-mini-tts" as const

export type TTSGender = "MALE" | "FEMALE"

/**
 * Нормализуем язык в формат OpenAI ("uk-UA" | "ru-RU" | "en-US").
 */
export function normalizeLanguage(language?: string): string {
  const raw = (language || "").toLowerCase().trim()

  if (raw.startsWith("uk")) return "uk-UA"
  if (raw.startsWith("ru")) return "ru-RU"
  if (raw.startsWith("en")) return "en-US"

  // дефолт — английский
  return "en-US"
}

/**
 * Старое имя, если где-то используется.
 */
export function normalizeLanguageCode(language?: string): string {
  return normalizeLanguage(language)
}

/**
 * Нормализуем пол в строгий union.
 */
export function normalizeGender(gender?: string): TTSGender {
  const raw = (gender || "").toLowerCase().trim()

  if (raw === "male" || raw === "m" || raw === "man") return "MALE"
  if (raw === "female" || raw === "f" || raw === "woman") return "FEMALE"

  // по умолчанию — женский (как в твоём UX)
  return "FEMALE"
}

/**
 * ГОЛОСА ПО ЯЗЫКУ:
 * - uk-UA: меняем мужской на более мягкий, чтобы уйти от металлического тембра
 * - ru-RU/en-US: оставляем как было, чтобы не менять привычное звучание
 */
const VOICE_MAP: Record<string, { MALE: string; FEMALE: string }> = {
  "en-US": {
    MALE: "onyx",
    FEMALE: "shimmer",
  },
  "ru-RU": {
    MALE: "onyx",
    FEMALE: "shimmer",
  },
  "uk-UA": {
    MALE: "sage",
    FEMALE: "shimmer",
  },
}

/**
 * Выбор голоса OpenAI по языку и полу.
 */
export function selectOpenAIVoice(language: string, gender: TTSGender): string {
  const lang = normalizeLanguage(language)
  const g = normalizeGender(gender)

  const forLang = VOICE_MAP[lang]
  if (forLang) {
    return g === "MALE" ? forLang.MALE : forLang.FEMALE
  }

  // запасной вариант — базовая пара
  return g === "MALE" ? "onyx" : "shimmer"
}

/**
 * Алиас, если где-то вызывается pickVoice.
 */
export function pickVoice(language: string, gender: TTSGender): string {
  return selectOpenAIVoice(language, gender)
}

/**
 * Оставляем старый helper — говорит, что можно использовать OpenAI-TTS.
 */
export function shouldUseGoogleTTS(language: string): boolean {
  const lang = normalizeLanguage(language)
  return lang === "uk-UA" || lang === "ru-RU" || lang === "en-US"
}

/**
 * Клиентский helper для tts-test-component и т.п.
 * Ходит в /api/tts и возвращает data URL с base64-аудио.
 */
export async function generateGoogleTTS(
  text: string,
  language: string,
  gender?: string,
): Promise<string> {
  const lang = normalizeLanguage(language)
  const g = normalizeGender(gender)

  if (!text || !text.trim()) {
    throw new Error("TTS: empty text")
  }

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      language: lang,
      gender: g,
    }),
  })

  const raw = await res.text()
  let data: any = null

  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    throw new Error("TTS: server returned non-JSON response: " + raw.slice(0, 200))
  }

  if (!res.ok || !data?.success || !data.audioContent) {
    throw new Error(data?.error || "TTS: request failed")
  }

  // готовый data URL для <audio>
  return `data:audio/mpeg;base64,${data.audioContent as string}`
}
