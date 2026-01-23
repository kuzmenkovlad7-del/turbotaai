import fs from "fs"

function read(file) {
  return fs.readFileSync(file, "utf8")
}
function write(file, s) {
  fs.writeFileSync(file, s, "utf8")
  console.log("OK fixed:", file)
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Safely upsert keys into:  const xx = { ... } as const
 * - removes existing lines for those keys
 * - ensures last existing line ends with comma
 * - appends new keys with comma
 */
function upsertAsConstObject(file, entries) {
  let s = read(file)

  const re = /const\s+(\w+)\s*=\s*\{([\s\S]*?)\}\s*as\s+const/m
  const m = s.match(re)
  if (!m) throw new Error(`Can't find "const xx = { ... } as const" in ${file}`)

  const varName = m[1]
  let body = m[2]

  // remove existing keys
  for (const k of Object.keys(entries)) {
    const rk = new RegExp(`^\\s*"${escapeRegExp(k)}"\\s*:\\s*.*?,?\\s*$\\n?`, "gm")
    body = body.replace(rk, "")
  }

  // normalize end
  const lines = body.split(/\r?\n/)
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop()

  if (lines.length > 0) {
    const last = lines[lines.length - 1].trim()
    if (!last.endsWith(",")) {
      lines[lines.length - 1] = lines[lines.length - 1].replace(/\s*$/, ",")
    }
  }

  let newBody = lines.join("\n")
  if (newBody.length && !newBody.endsWith("\n")) newBody += "\n"

  for (const [k, v] of Object.entries(entries)) {
    newBody += `  "${k}": ${JSON.stringify(v)},\n`
  }

  const newBlock = `const ${varName} = {${newBody}} as const`
  s = s.replace(re, newBlock)

  write(file, s)
}

function fixPricing(file) {
  let s = read(file)

  // fix broken nested t("t("Opening...")")
  s = s.split('t("t("Opening...")")').join('t("Opening...")')

  // also fix if it happened with extra spaces
  s = s.replace(/t\("t\("Opening\.\.\."\)"\)"\)/g, 't("Opening...")')

  // If some place still has raw "Opening..." inside ternary for subscribe button, normalize safely
  s = s.replace(/\?\s*"Opening\.\.\."\s*:\s*t\("Subscribe"\)/g, '? t("Opening...") : t("Subscribe")')

  write(file, s)
}

function fixVideoDialog(file) {
  let s = read(file)

  // 1) Replace "specialist" -> "companion" key (so it matches translations)
  s = s.split('Select the AI specialist you\'d like to speak with during your video call.')
       .join('Select the AI companion you\'d like to speak with during your video call.')

  // 2) Ensure descriptions are passed through t()
  // if somewhere still {character.description} -> {t(character.description)}
  s = s.replace(/\{\s*character\.description\s*\}/g, "{t(character.description)}")

  // 3) If there is a subtitle text node that is hardcoded (not wrapped), we keep it as t("...")
  // This is safe even if already fixed.
  s = s.replace(
    /Select the AI companion you'd like to speak with during your video call\./g,
    `\${t("Select the AI companion you'd like to speak with during your video call.")}`
  )

  write(file, s)
}

function boostAssistantFabZ(file) {
  let s = read(file)

  // Raise widget above header: first className that contains "fixed" -> ensure z-[100]
  s = s.replace(/className="([^"]*\bfixed\b[^"]*)"/m, (full, cls) => {
    let out = cls

    // remove existing z-xxx if any
    out = out.replace(/\bz-(?:\d+|\[[0-9]+\])\b/g, "").replace(/\s+/g, " ").trim()

    // add very high z-index
    out = out + " z-[100]"
    return `className="${out}"`
  })

  write(file, s)
}

try {
  // translations: repair syntax + add missing keys
  upsertAsConstObject("lib/i18n/translations/en.ts", {
    "Opening...": "Opening...",
    "Unlimited": "Unlimited",
    "Select the AI companion you'd like to speak with during your video call.": "Select the AI companion you'd like to speak with during your video call.",
    "Calm AI companion for everyday conversations and support": "Calm AI companion for everyday conversations and support",
    "Warm AI companion for supportive conversations": "Warm AI companion for supportive conversations",
    "Check trial balance and history": "Check trial balance and history",
  })

  upsertAsConstObject("lib/i18n/translations/ru.ts", {
    "Opening...": "Открываем...",
    "Unlimited": "Безлимит",
    "Select the AI companion you'd like to speak with during your video call.": "Выберите AI собеседника, с которым хотите поговорить во время видеозвонка.",
    "Calm AI companion for everyday conversations and support": "Спокойный AI собеседник для ежедневных разговоров и поддержки",
    "Warm AI companion for supportive conversations": "Тёплый AI собеседник для поддерживающих разговоров",
    "Check trial balance and history": "Проверить доступ и историю",
  })

  upsertAsConstObject("lib/i18n/translations/uk.ts", {
    "Opening...": "Відкриваємо...",
    "Unlimited": "Безліміт",
    "Select the AI companion you'd like to speak with during your video call.": "Оберіть AI співрозмовника, з яким хочете поговорити під час відеодзвінка.",
    "Calm AI companion for everyday conversations and support": "Спокійний AI співрозмовник для щоденних розмов і підтримки",
    "Warm AI companion for supportive conversations": "Теплий AI співрозмовник для підтримуючих розмов",
    "Check trial balance and history": "Перевірити доступ та історію",
  })

  fixPricing("app/pricing/page.tsx")
  fixVideoDialog("components/video-call-dialog.tsx")
  boostAssistantFabZ("components/assistant-fab.tsx")

  console.log("DONE fix-final-polish-bugs")
} catch (e) {
  console.error("FAILED:", e)
  process.exit(1)
}
