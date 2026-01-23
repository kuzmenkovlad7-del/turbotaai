import fs from "fs"

function read(p) {
  return fs.readFileSync(p, "utf8")
}
function write(p, s) {
  fs.writeFileSync(p, s)
  console.log("OK patched:", p)
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// гарантируем запятую перед "} as const"
function ensureCommaBeforeClose(s) {
  return s.replace(
    /(\n\s*"[^"]+"\s*:\s*"[^"]*")\n(\s*}\s+as const)/,
    "$1,\n$2",
  )
}

function upsertTranslations(file, entries) {
  let s = read(file)
  s = ensureCommaBeforeClose(s)

  for (const [k, v] of Object.entries(entries)) {
    const key = escapeRegExp(k)

    // replace existing
    const re = new RegExp(`("${key}"\\s*:\\s*)"(?:\\\\.|[^"\\\\])*"`, "g")
    if (re.test(s)) {
      s = s.replace(re, `$1${JSON.stringify(v)}`)
      continue
    }

    // insert new before "} as const"
    const insert = `  ${JSON.stringify(k)}: ${JSON.stringify(v)},\n`
    if (!/\n}\s+as const/.test(s)) {
      throw new Error("Can't find '} as const' in " + file)
    }
    s = s.replace(/\n}\s+as const/, `\n${insert}} as const`)
  }

  write(file, s)
}

function patchGoogleTTS() {
  const p = "lib/google-tts.ts"
  let s = read(p)

  // Полностью переписываем selectOpenAIVoice на стабильный вариант (один голос на все языки)
  const reFn = /export function selectOpenAIVoice\([\s\S]*?\)\s*:\s*string\s*{\s*[\s\S]*?\n}\n/
  if (!reFn.test(s)) throw new Error("selectOpenAIVoice() not found in " + p)

  const newFn = `export function selectOpenAIVoice(language: string, gender: TTSGender): string {
  const g = normalizeGender(gender)

  // Один мужской/женский голос для en/ru/uk, можно быстро менять через env без правок кода
  const male = (process.env.OPENAI_TTS_MALE_VOICE || "marin") as string
  const female = (process.env.OPENAI_TTS_FEMALE_VOICE || "shimmer") as string

  return g === "MALE" ? male : female
}
`

  s = s.replace(reFn, newFn)
  write(p, s)
}

function patchVideoDialog() {
  const p = "components/video-call-dialog.tsx"
  let s = read(p)

  // 1) Меняем "specialist" -> "companion" (ключ под переводы)
  s = s.replaceAll(
    "Select the AI specialist you'd like to speak with during your video call.",
    "Select the AI companion you'd like to speak with during your video call.",
  )

  // 2) Если где-то остался plain text без i18n — оборачиваем в t()
  s = s.replace(
    />\s*Select the AI companion you'd like to speak with during your video call\.\s*</g,
    `>{t("Select the AI companion you'd like to speak with during your video call.")}<`,
  )

  // 3) Описания карточек персонажей: делаем переводимыми (Leo/Mia точно)
  // заменяем {something.description} -> {t(something.description)}
  s = s.replace(/\{([A-Za-z_$][\w$]*)\.description\}/g, "{t($1.description)}")

  // 4) Если Alex был захардкожен на укр/ру — приводим к одному ключу
  s = s.replaceAll(
    "AI співрозмовник для тривоги, стресу та перевантаження",
    "AI companion for anxiety, stress, and overload",
  )
  s = s.replaceAll(
    "AI собеседник для тревоги, стресса и перегрузки",
    "AI companion for anxiety, stress, and overload",
  )

  write(p, s)
}

function patchZIndex() {
  // Виджет должен быть выше хедера, но ниже модалок
  // header: z-50 -> z-30
  // assistant-fab: z-50/z-[100] -> z-40
  {
    const p = "components/header.tsx"
    let s = read(p)
    s = s.replace(/\bz-50\b/g, "z-30")
    write(p, s)
  }

  {
    const p = "components/assistant-fab.tsx"
    let s = read(p)
    s = s.replace(/z-\[100\]/g, "z-40")
    s = s.replace(/\bz-50\b/g, "z-40")
    write(p, s)
  }
}

try {
  patchGoogleTTS()

  // Переводы для карточек и подсказки под заголовком в видео-модалке
  upsertTranslations("lib/i18n/translations/en.ts", {
    "Select the AI companion you'd like to speak with during your video call.":
      "Select the AI companion you'd like to speak with during your video call.",
    "Calm AI companion for everyday conversations and support":
      "Calm AI companion for everyday conversations and support",
    "Warm AI companion for supportive conversations":
      "Warm AI companion for supportive conversations",
    "AI companion for anxiety, stress, and overload":
      "AI companion for anxiety, stress, and overload",
  })

  upsertTranslations("lib/i18n/translations/ru.ts", {
    "Select the AI companion you'd like to speak with during your video call.":
      "Выберите AI собеседника, с которым хотите поговорить во время видеозвонка.",
    "Calm AI companion for everyday conversations and support":
      "Спокойный AI собеседник для ежедневных разговоров и поддержки",
    "Warm AI companion for supportive conversations":
      "Теплый AI собеседник для поддерживающих разговоров",
    "AI companion for anxiety, stress, and overload":
      "AI собеседник для тревоги, стресса и перегрузки",
  })

  upsertTranslations("lib/i18n/translations/uk.ts", {
    "Select the AI companion you'd like to speak with during your video call.":
      "Оберіть AI співрозмовника, з яким хочете поговорити під час відеодзвінка.",
    "Calm AI companion for everyday conversations and support":
      "Спокійний AI співрозмовник для щоденних розмов і підтримки",
    "Warm AI companion for supportive conversations":
      "Теплий AI співрозмовник для підтримуючих розмов",
    "AI companion for anxiety, stress, and overload":
      "AI співрозмовник для тривоги, стресу та перевантаження",
  })

  patchVideoDialog()
  patchZIndex()

  console.log("DONE fix-leftovers-voice-i18n-z")
} catch (e) {
  console.error("FAILED:", e)
  process.exit(1)
}
