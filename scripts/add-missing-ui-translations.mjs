import fs from "fs"

function escRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function upsert(file, dict) {
  let src = fs.readFileSync(file, "utf8")

  // заменяем существующие ключи
  for (const [k, v] of Object.entries(dict)) {
    const re = new RegExp(`(^\\s*)${escRegExp(JSON.stringify(k))}\\s*:\\s*("([^"\\\\]|\\\\.)*"|\\\`[\\s\\S]*?\\\`)\\s*,?\\s*$`, "m")
    if (re.test(src)) {
      src = src.replace(re, `$1${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    }
  }

  // вставляем недостающие в конец объекта перед "} as const"
  const marker = "} as const"
  const idx = src.lastIndexOf(marker)
  if (idx === -1) throw new Error(`Can't find "${marker}" in ${file}`)

  const before = src.slice(0, idx).replace(/\s*$/, "")
  const after = src.slice(idx)

  const missing = []
  for (const [k, v] of Object.entries(dict)) {
    const keyNeedle = `${JSON.stringify(k)}:`
    if (!src.includes(keyNeedle)) {
      missing.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    }
  }

  if (missing.length) {
    const lastChar = before.trim().slice(-1)
    const glue = lastChar === "{" ? "\n" : (lastChar === "," ? "\n" : ",\n")
    src = before + glue + missing.join("\n") + "\n" + after
  }

  fs.writeFileSync(file, src)
  console.log("OK translations:", file)
}

const en = {
  "English": "English",
  "Russian": "Russian",
  "Ukrainian": "Ukrainian",

  "How would you like to start?": "How would you like to start?",
  "Chat": "Chat",
  "Text conversation": "Text conversation",
  "Voice": "Voice",
  "Talk now": "Talk now",
  "Video": "Video",
  "Avatar format": "Avatar format",

  "Open pricing": "Open pricing",
  "Later": "Later",

  "Sign in": "Sign in",
  "Signing in...": "Signing in...",
  "Sign up": "Sign up",
  "Creating account...": "Creating account...",
}

const ru = {
  "English": "Английский",
  "Russian": "Русский",
  "Ukrainian": "Украинский",

  "How would you like to start?": "Как Вам удобнее начать?",
  "Chat": "Чат",
  "Text conversation": "Текстовый формат",
  "Voice": "Голос",
  "Talk now": "Поговорить сейчас",
  "Video": "Видео",
  "Avatar format": "Формат аватара",

  "Open pricing": "Открыть тарифы",
  "Later": "Позже",

  "Sign in": "Войти",
  "Signing in...": "Входим...",
  "Sign up": "Регистрация",
  "Creating account...": "Создаем аккаунт...",
}

const uk = {
  "English": "Англійська",
  "Russian": "Російська",
  "Ukrainian": "Українська",

  "How would you like to start?": "Як Вам зручніше почати?",
  "Chat": "Чат",
  "Text conversation": "Текстовий формат",
  "Voice": "Голос",
  "Talk now": "Поговорити зараз",
  "Video": "Відео",
  "Avatar format": "Формат аватара",

  "Open pricing": "Відкрити тарифи",
  "Later": "Пізніше",

  "Sign in": "Увійти",
  "Signing in...": "Входимо...",
  "Sign up": "Реєстрація",
  "Creating account...": "Створюємо акаунт...",
}

upsert("lib/i18n/translations/en.ts", en)
upsert("lib/i18n/translations/ru.ts", ru)
upsert("lib/i18n/translations/uk.ts", uk)

console.log("DONE add-missing-ui-translations")
