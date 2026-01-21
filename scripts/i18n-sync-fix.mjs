import fs from "fs"
import path from "path"
import vm from "vm"
import { createRequire } from "module"

const require = createRequire(import.meta.url)

function loadTsDict(filePath, langGuess) {
  const esbuild = require("esbuild")
  const input = fs.readFileSync(filePath, "utf8")

  const out = esbuild.transformSync(input, {
    loader: "ts",
    format: "cjs",
    target: "es2019",
    sourcemap: false,
  })

  const mod = { exports: {} }
  vm.runInNewContext(out.code, { module: mod, exports: mod.exports, require, process })

  const exp = mod.exports || {}
  const byLang =
    exp.default ||
    exp[langGuess] ||
    exp.translations ||
    exp[Object.keys(exp).find((k) => typeof exp[k] === "object")] ||
    null

  if (!byLang || typeof byLang !== "object") {
    throw new Error(`Cannot load dict from ${filePath}`)
  }
  return byLang
}

function detectExportName(filePath, fallback) {
  const txt = fs.readFileSync(filePath, "utf8")
  const m = txt.match(/export\s+const\s+([a-zA-Z0-9_]+)\s*=/)
  if (m && m[1]) return m[1]
  return fallback
}

function stringifyObj(obj) {
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b))
  const lines = []
  lines.push("{")
  for (const k of keys) {
    const v = obj[k]
    const kk = JSON.stringify(k)
    const vv = JSON.stringify(v)
    lines.push(`  ${kk}: ${vv},`)
  }
  lines.push("}")
  return lines.join("\n")
}

function writeTsDict(filePath, exportName, dict) {
  const body = stringifyObj(dict)
  const content =
`export const ${exportName} = ${body} as const

export default ${exportName}
`
  fs.writeFileSync(filePath, content, "utf8")
}

const ROOT = process.cwd()
const files = {
  en: path.join(ROOT, "lib/i18n/translations/en.ts"),
  ru: path.join(ROOT, "lib/i18n/translations/ru.ts"),
  uk: path.join(ROOT, "lib/i18n/translations/uk.ts"),
}

const en = loadTsDict(files.en, "en")
const ru = loadTsDict(files.ru, "ru")
const uk = loadTsDict(files.uk, "uk")

// 1) Патчи EN: закрываем missing из usage-check + унифицируем психолог -> companion (в UI)
const patchEN = {
  "AI Psychologist": "AI companion",
  "AI specialist Video Call": "AI companion Video Call",
  "Choose Your AI specialist": "Choose Your AI companion",
  "Choose an AI specialist and press “Start video call” to begin.": "Choose an AI companion and press “Start video call” to begin.",
  "Support for everyday conversations, powered by AI": "Support for everyday conversations, powered by AI",

  "Home": "Home",
  "About": "About",
  "Contacts": "Contacts",
  "Pricing": "Pricing",
  "Profile": "Profile",
  "Languages": "Languages",

  "Welcome Back": "Welcome Back",
  "Enter your credentials": "Enter your credentials",
  "Already have an account?": "Already have an account?",
  "Create account": "Create account",
  "Creating account...": "Creating account...",
  "Sign in to continue": "Sign in to continue",
  "Signing in...": "Signing in...",
  "Sign Out": "Sign Out",
  "Register to save your sessions and preferences.": "Register to save your sessions and preferences.",

  "Full name (optional)": "Full name (optional)",
  "Password": "Password",
  "Repeat password": "Repeat password",
  "Passwords do not match": "Passwords do not match",

  "Select": "Select",
  "Selected": "Selected",
  "Select Language": "Select Language",

  "Send": "Send",
  "Sending": "Sending",
  "Loading...": "Loading...",

  "Connecting": "Connecting",
  "Connecting...": "Connecting...",
  "Connection error. Please try again.": "Connection error. Please try again.",

  "Listening...": "Listening...",
  "Thinking...": "Thinking...",
  "Speaking...": "Speaking...",
  "Assistant is speaking...": "Assistant is speaking...",
  "Assistant is speaking. Please wait a moment.": "Assistant is speaking. Please wait a moment.",

  "Microphone is not available.": "Microphone is not available.",
  "Failed to start the call. Please check your microphone and camera permissions.": "Failed to start the call. Please check your microphone and camera permissions.",
  "Your browser does not support voice recording. Please use Chrome or another modern browser.": "Your browser does not support voice recording. Please use Chrome or another modern browser.",
  "AI assistant is temporarily unavailable. Please try again a bit later.": "AI assistant is temporarily unavailable. Please try again a bit later.",

  "Start with female voice": "Start with female voice",
  "Start with male voice": "Start with male voice",
  "Choose voice for this session": "Choose voice for this session",

  // чтобы не зависеть от того какие ключи использует hero
  "Live Psychological Support,": "AI companion,",
  "Live emotional support,": "AI companion,",
  "AI-Enhanced": "always nearby",
  "AI emotional support": "Emotional support",

  "Professionals supported by AI assistants. We help gather history, maintain journals, and remind about sessions.":
    "A calm and private space to talk. Speak, breathe, and feel supported by an AI companion built for emotional care.",
  "Licensed specialists supported by AI assistants. We help gather history, maintain journals, and remind about sessions.":
    "A calm and private space to talk. Speak, breathe, and feel supported by an AI companion built for emotional care.",
}

for (const [k, v] of Object.entries(patchEN)) en[k] = v

// 2) Патчи RU
const patchRU = {
  "Home": "Главная",
  "About": "О нас",
  "Contacts": "Контакты",
  "Pricing": "Цены",
  "Profile": "Профиль",
  "Languages": "Языки",

  "AI Psychologist": "AI-собеседник",
  "AI specialist Video Call": "Видеозвонок с AI-собеседником",
  "Choose Your AI specialist": "Выберите AI-собеседника",
  "Choose an AI specialist and press “Start video call” to begin.": "Выберите AI-собеседника и нажмите «Начать видеозвонок».",
  "Support for everyday conversations, powered by AI": "Поддержка для повседневных разговоров, усиленная AI",

  "Welcome Back": "С возвращением",
  "Enter your credentials": "Введите данные для входа",
  "Already have an account?": "Уже есть аккаунт?",
  "Create account": "Создать аккаунт",
  "Creating account...": "Создаём аккаунт...",
  "Sign in to continue": "Войдите, чтобы продолжить",
  "Signing in...": "Входим...",
  "Sign Out": "Выйти",
  "Register to save your sessions and preferences.": "Зарегистрируйтесь, чтобы сохранять диалоги и настройки.",

  "Full name (optional)": "Имя (необязательно)",
  "Password": "Пароль",
  "Repeat password": "Повторите пароль",
  "Passwords do not match": "Пароли не совпадают",

  "Select": "Выбрать",
  "Selected": "Выбрано",
  "Select Language": "Выберите язык",

  "Send": "Отправить",
  "Sending": "Отправка",
  "Loading...": "Загрузка...",

  "Connecting": "Подключение",
  "Connecting...": "Подключаемся...",
  "Connection error. Please try again.": "Ошибка соединения. Попробуйте ещё раз.",

  "Listening...": "Слушаю...",
  "Thinking...": "Думаю...",
  "Speaking...": "Говорю...",
  "Assistant is speaking...": "Ассистент говорит...",
  "Assistant is speaking. Please wait a moment.": "Ассистент говорит. Подождите немного.",

  "Microphone is not available.": "Микрофон недоступен.",
  "Failed to start the call. Please check your microphone and camera permissions.": "Не удалось начать звонок. Проверьте доступ к микрофону и камере.",
  "Your browser does not support voice recording. Please use Chrome or another modern browser.": "Ваш браузер не поддерживает запись голоса. Используйте Chrome или другой современный браузер.",
  "AI assistant is temporarily unavailable. Please try again a bit later.": "Ассистент временно недоступен. Попробуйте чуть позже.",

  "Start with female voice": "Женский голос",
  "Start with male voice": "Мужской голос",
  "Choose voice for this session": "Выберите голос для сессии",

  // hero
  "Live Psychological Support,": "AI-собеседник,",
  "Live emotional support,": "AI-собеседник,",
  "AI-Enhanced": "который всегда рядом",

  "Professionals supported by AI assistants. We help gather history, maintain journals, and remind about sessions.":
    "Спокойное и приватное пространство для разговора. Поговорите, успокойтесь и почувствуйте поддержку от AI-собеседника для эмоциональной заботы.",
  "Licensed specialists supported by AI assistants. We help gather history, maintain journals, and remind about sessions.":
    "Спокойное и приватное пространство для разговора. Поговорите, успокойтесь и почувствуйте поддержку от AI-собеседника для эмоциональной заботы.",

  // ключи которых не хватало по audit RU vs EN
  "AI Companion Video Call": "Видеозвонок с AI-собеседником",
  "Choose Your AI Companion": "Выберите AI-собеседника",
  "Select the AI companion you'd like to speak with during your video call.": "Выберите AI-собеседника для видеозвонка.",
  "Press the button to start the call. Allow microphone access, then speak as if with a real specialist.": "Нажмите кнопку старта, разрешите микрофон и говорите спокойно в своём темпе.",
  "Your Message": "Ваше сообщение",
}

for (const [k, v] of Object.entries(patchRU)) ru[k] = v

// 3) Патчи UK
const patchUK = {
  "Home": "Головна",
  "About": "Про нас",
  "Contacts": "Контакти",
  "Pricing": "Ціни",
  "Profile": "Профіль",
  "Languages": "Мови",

  "AI Psychologist": "AI співрозмовник",
  "AI specialist Video Call": "Відео розмова з AI співрозмовником",
  "Choose Your AI specialist": "Оберіть AI співрозмовника",
  "Choose an AI specialist and press “Start video call” to begin.": "Оберіть AI співрозмовника і натисніть «Почати відео розмову».",
  "Support for everyday conversations, powered by AI": "Підтримка для щоденних розмов, підсилена AI",

  "Welcome Back": "З поверненням",
  "Enter your credentials": "Введіть дані для входу",
  "Already have an account?": "Вже є акаунт?",
  "Create account": "Створити акаунт",
  "Creating account...": "Створюємо акаунт...",
  "Sign in to continue": "Увійдіть щоб продовжити",
  "Signing in...": "Входимо...",
  "Sign Out": "Вийти",
  "Register to save your sessions and preferences.": "Зареєструйтесь, щоб зберігати діалоги та налаштування.",

  "Full name (optional)": "Імʼя (необовʼязково)",
  "Password": "Пароль",
  "Repeat password": "Повторіть пароль",
  "Passwords do not match": "Паролі не збігаються",

  "Select": "Обрати",
  "Selected": "Обрано",
  "Select Language": "Оберіть мову",

  "Send": "Надіслати",
  "Sending": "Надсилаємо",
  "Loading...": "Завантаження...",

  "Connecting": "Підключення",
  "Connecting...": "Підключаємось...",
  "Connection error. Please try again.": "Помилка зʼєднання. Спробуйте ще раз.",

  "Listening...": "Слухаю...",
  "Thinking...": "Думаю...",
  "Speaking...": "Говорю...",
  "Assistant is speaking...": "Асистент говорить...",
  "Assistant is speaking. Please wait a moment.": "Асистент говорить. Зачекайте трохи.",

  "Microphone is not available.": "Мікрофон недоступний.",
  "Failed to start the call. Please check your microphone and camera permissions.": "Не вдалося почати дзвінок. Перевірте доступ до мікрофона та камери.",
  "Your browser does not support voice recording. Please use Chrome or another modern browser.": "Ваш браузер не підтримує запис голосу. Використайте Chrome або інший сучасний браузер.",
  "AI assistant is temporarily unavailable. Please try again a bit later.": "Асистент тимчасово недоступний. Спробуйте трохи пізніше.",

  "Start with female voice": "Жіночий голос",
  "Start with male voice": "Чоловічий голос",
  "Choose voice for this session": "Оберіть голос для сесії",

  // hero
  "Live Psychological Support,": "AI співрозмовник,",
  "Live emotional support,": "AI співрозмовник,",
  "AI-Enhanced": "який завжди поруч",

  "Professionals supported by AI assistants. We help gather history, maintain journals, and remind about sessions.":
    "Спокійний і безпечний простір для розмови. Поговори, заспокойся і відчуй підтримку з AI співрозмовником для емоційної турботи.",
  "Licensed specialists supported by AI assistants. We help gather history, maintain journals, and remind about sessions.":
    "Спокійний і безпечний простір для розмови. Поговори, заспокойся і відчуй підтримку з AI співрозмовником для емоційної турботи.",

  // audit missing
  "AI Companion Video Call": "Відео розмова з AI співрозмовником",
  "Choose Your AI Companion": "Оберіть AI співрозмовника",
  "Select the AI companion you'd like to speak with during your video call.": "Оберіть AI співрозмовника для відео розмови.",
  "Press the button to start the call. Allow microphone access, then speak as if with a real specialist.": "Натисніть старт, дозвольте мікрофон і говоріть у своєму темпі.",
}

for (const [k, v] of Object.entries(patchUK)) uk[k] = v

// 4) UNION KEYS: чтобы везде было одно и то же
const union = new Set([...Object.keys(en), ...Object.keys(ru), ...Object.keys(uk)])

function fillMissing(dict, fallbackDict) {
  for (const k of union) {
    if (!(k in dict)) {
      dict[k] = fallbackDict?.[k] ?? en[k] ?? k
    }
  }
}

fillMissing(en, en)
fillMissing(ru, en)
fillMissing(uk, en)

// 5) ПОДЧИСТКА: убираем явно плохие автозамены "specialist or specialist"
function cleanupBadPhrases(dict) {
  for (const k of Object.keys(dict)) {
    const v = String(dict[k])
    dict[k] = v
      .replaceAll("licensed specialist or specialist", "professional support")
      .replaceAll("a specialist, specialist", "a professional")
      .replaceAll("специалист или специалист", "профессиональная помощь")
      .replaceAll("фахівець або фахівець", "професійна допомога")
  }
}
cleanupBadPhrases(en)
cleanupBadPhrases(ru)
cleanupBadPhrases(uk)

// WRITE BACK
const enName = detectExportName(files.en, "en")
const ruName = detectExportName(files.ru, "ru")
const ukName = detectExportName(files.uk, "uk")

writeTsDict(files.en, enName, en)
writeTsDict(files.ru, ruName, ru)
writeTsDict(files.uk, ukName, uk)

console.log("OK: synced translations EN/RU/UK with union keys + patched critical UI copy")
