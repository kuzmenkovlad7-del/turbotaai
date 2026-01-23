import fs from "fs"

function read(p) {
  return fs.readFileSync(p, "utf8")
}
function write(p, s) {
  fs.writeFileSync(p, s)
}

function patchFile(path, fn) {
  const before = read(path)
  const after = fn(before)
  if (after !== before) {
    write(path, after)
    console.log("OK patched:", path)
  } else {
    console.log("OK no-change:", path)
  }
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function upsertTranslations(file, entries) {
  let s = read(file)

  for (const [k, v] of Object.entries(entries)) {
    const keyRe = new RegExp(`^\\s*["']${escapeRegExp(k)}["']\\s*:`, "m")

    if (keyRe.test(s)) {
      // update value if key exists
      const valRe = new RegExp(
        `(^\\s*["']${escapeRegExp(k)}["']\\s*:\\s*)["'][^"']*["']\\s*,?\\s*$`,
        "m",
      )
      if (valRe.test(s)) {
        s = s.replace(valRe, `$1"${v}",`)
      }
      continue
    }

    // insert before } as const
    const insertPoint = /\n\}\s*as const/m
    if (!insertPoint.test(s)) {
      console.log("WARN cannot insert, missing '} as const' in:", file)
      continue
    }

    s = s.replace(insertPoint, `\n  "${k}": "${v}",\n} as const`)
  }

  // cleanup occasional double commas
  s = s.replace(/,\s*,/g, ",")
  s = s.replace(/\{\s*,/g, "{")
  s = s.replace(/,\s*\}/g, "}")

  if (s !== read(file)) {
    write(file, s)
    console.log("OK patched translations:", file)
  } else {
    console.log("OK no-change translations:", file)
  }
}

console.log("=== final polish ui ===")

// 1) Video modal: убрать hardcode английский сабтайтл + перевести описания аватаров через t(...)
patchFile("components/video-call-dialog.tsx", (s) => {
  // subtitle in modal (inside <p> ... </p>)
  s = s.replace(
    /(<p[^>]*>\s*)Select the AI specialist[\s\S]*?video call\.(\s*<\/p>)/m,
    `$1{t("Select the AI companion you'd like to speak with during your video call.")}$2`,
  )

  // card description: {character.description} => {t(character.description)}
  s = s.replace(/\{\s*character\.description\s*\}/g, "{t(character.description)}")

  // sometimes it's named "assistant"
  s = s.replace(/\{\s*assistant\.description\s*\}/g, "{t(assistant.description)}")

  return s
})

// 2) Pricing page: убрать Subscribe/Opening... как hardcode
patchFile("app/pricing/page.tsx", (s) => {
  s = s.replace(/title="Subscribe"/g, 'title={t("Subscribe")}')
  s = s.replace(/\{payLoading \? "Opening\.\.\." : "Subscribe"\}/g, '{payLoading ? t("Opening...") : t("Subscribe")}')
  s = s.replace(/>Subscribe</g, ">{t(\"Subscribe\")}<")
  s = s.replace(/Opening\.\.\./g, 't("Opening...")')
  s = s.replace(/Check trial balance and history/g, '{t("Check trial balance and history")}')
  return s
})

// 3) Z-index: хедер ниже, виджет выше
patchFile("components/header.tsx", (s) => {
  // чаще всего header sticky z-50 -> опускаем до z-40
  s = s.replace(/\bz-50\b/g, "z-40")
  s = s.replace(/\bz-\[50\]\b/g, "z-[40]")
  return s
})

patchFile("components/assistant-fab.tsx", (s) => {
  // виджет должен быть выше хедера
  s = s.replace(/\bz-40\b/g, "z-[60]")
  s = s.replace(/\bz-50\b/g, "z-[60]")
  s = s.replace(/\bz-\[40\]\b/g, "z-[60]")
  s = s.replace(/\bz-\[50\]\b/g, "z-[60]")
  return s
})

// 4) Мужской голос: глубже и медленнее (browser params)
patchFile("lib/i18n/translation-utils.ts", (s) => {
  // Ukrainian male: rate/pitch немного ниже
  s = s.replace(
    /rate:\s*0\.85,\s*\/\/ Ukrainian male speech pattern/g,
    "rate: 0.82, // Ukrainian male speech pattern (slower, calmer)",
  )
  s = s.replace(
    /pitch:\s*0\.92,\s*\/\/ Ukrainian male intonation/g,
    "pitch: 0.88, // Deeper warm Ukrainian male tone",
  )
  return s
})

// 5) Мужской голос: OpenAI TTS voice (если используете server TTS)
patchFile("lib/google-tts.ts", (s) => {
  const sig = "export function selectOpenAIVoice"
  const i = s.indexOf(sig)
  if (i === -1) return s

  // find function block
  const start = s.indexOf("{", i)
  if (start === -1) return s

  let depth = 0
  let end = -1
  for (let p = start; p < s.length; p++) {
    if (s[p] === "{") depth++
    else if (s[p] === "}") {
      depth--
      if (depth === 0) {
        end = p
        break
      }
    }
  }
  if (end === -1) return s

  const before = s.slice(0, i)
  const after = s.slice(end + 1)

  const fn = `export function selectOpenAIVoice(language: string, gender: TTSGender): string {
  const g = normalizeGender(gender)
  // male voice: deeper + calmer
  if (g === "MALE") return process.env.OPENAI_TTS_MALE_VOICE || "onyx"
  // female voice: natural warm
  return process.env.OPENAI_TTS_FEMALE_VOICE || "nova"
}
`

  return before + fn + after
})

// 6) Переводы для строк, которые были на английском в UI
upsertTranslations("lib/i18n/translations/en.ts", {
  "Select the AI companion you'd like to speak with during your video call.": "Select the AI companion you'd like to speak with during your video call.",
  "Calm AI companion for everyday conversations and support": "Calm AI companion for everyday conversations and support",
  "Warm AI companion for supportive conversations": "Warm AI companion for supportive conversations",
  "Opening...": "Opening...",
  "Check trial balance and history": "Check trial balance and history",
})

upsertTranslations("lib/i18n/translations/ru.ts", {
  "Unlimited": "Безлимит",
  "Select the AI companion you'd like to speak with during your video call.": "Выберите AI собеседника, с которым хотите поговорить во время видеозвонка.",
  "Calm AI companion for everyday conversations and support": "Спокойный AI собеседник для ежедневных разговоров и поддержки",
  "Warm AI companion for supportive conversations": "Теплый AI собеседник для поддерживающих разговоров",
  "Opening...": "Открываем...",
  "Check trial balance and history": "Проверить доступ и историю",
})

upsertTranslations("lib/i18n/translations/uk.ts", {
  "Unlimited": "Безліміт",
  "Select the AI companion you'd like to speak with during your video call.": "Оберіть AI співрозмовника, з яким хочете поговорити під час відеодзвінка.",
  "Calm AI companion for everyday conversations and support": "Спокійний AI співрозмовник для щоденних розмов і підтримки",
  "Warm AI companion for supportive conversations": "Теплий AI співрозмовник для підтримуючих розмов",
  "Opening...": "Відкриваємо...",
  "Check trial balance and history": "Перевірити доступ та історію",
})

console.log("DONE final polish ui")
