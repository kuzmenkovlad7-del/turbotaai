import fs from "fs"
import path from "path"

const ROOT = process.cwd()

const FILES = [
  "app/pricing/page.tsx",
  "app/pricing/pricing-client.tsx",
  "app/profile/page.tsx",
  "app/subscription/page.tsx",
  "app/subscription/subscription-client.tsx",
  "components/assistant-fab.tsx",
  "components/ai-chat-dialog.tsx",
  "components/footer.tsx",
]

const TFILES = {
  en: "lib/i18n/translations/en.ts",
  ru: "lib/i18n/translations/ru.ts",
  uk: "lib/i18n/translations/uk.ts",
}

const PACK = [
  // PRICING
  { key: "Monthly", en: "Monthly", ru: "Ежемесячно", uk: "Щомісяця" },
  {
    key: "Unlimited access to chat, voice and video",
    en: "Unlimited access to chat, voice and video",
    ru: "Неограниченный доступ к чату, голосу и видео",
    uk: "Необмежений доступ до чату, голосу та відео",
  },
  { key: "Unlimited requests", en: "Unlimited requests", ru: "Неограниченное количество запросов", uk: "Необмежена кількість запитів" },
  { key: "Chat, voice and video", en: "Chat, voice and video", ru: "Чат, голос и видео", uk: "Чат, голос і відео" },
  {
    key: "History is saved in your profile",
    en: "History is saved in your profile",
    ru: "История сохраняется в профиле",
    uk: "Історія зберігається у профілі",
  },
  { key: "Subscribe", en: "Subscribe", ru: "Подписаться", uk: "Підписатися" },
  {
    key: "Payment is available without signing in. To activate a promo code and save history we recommend signing in.",
    en: "Payment is available without signing in. To activate a promo code and save history we recommend signing in.",
    ru: "Оплата возможна без входа. Для активации промокода и сохранения истории рекомендуем войти.",
    uk: "Оплата можлива без входу. Для активації промокоду та збереження історії рекомендуємо увійти.",
  },
  { key: "Your profile", en: "Your profile", ru: "Ваш профиль", uk: "Ваш профіль" },
  {
    key: "Check your trial balance and history",
    en: "Check your trial balance and history",
    ru: "Проверяйте баланс триала и историю",
    uk: "Перевіряйте баланс тріалу та історію",
  },
  { key: "Status", en: "Status", ru: "Статус", uk: "Статус" },
  { key: "Guest", en: "Guest", ru: "Гость", uk: "Гість" },
  { key: "Trial left", en: "Trial left", ru: "Осталось триала", uk: "Залишилось тріалу" },
  { key: "Open profile", en: "Open profile", ru: "Открыть профиль", uk: "Відкрити профіль" },
  { key: "Sign in", en: "Sign in", ru: "Войти", uk: "Увійти" },
  { key: "Promo code", en: "Promo code", ru: "Промокод", uk: "Промокод" },
  {
    key: "12 months of free access with a promo code",
    en: "12 months of free access with a promo code",
    ru: "12 месяцев бесплатного доступа по промокоду",
    uk: "12 місяців безкоштовного доступу за промокодом",
  },
  { key: "Activate promo", en: "Activate promo", ru: "Активировать промо", uk: "Активувати промо" },
  {
    key: "Promo activation requires sign-in.",
    en: "Promo activation requires sign-in.",
    ru: "Активация промокода требует входа.",
    uk: "Активація промокоду потребує входу.",
  },

  // PROFILE
  { key: "Profile", en: "Profile", ru: "Профиль", uk: "Профіль" },
  { key: "Account", en: "Account", ru: "Аккаунт", uk: "Обліковий запис" },
  { key: "Login status and access", en: "Login status and access", ru: "Статус входа и доступ", uk: "Статус входу та доступ" },
  { key: "Email", en: "Email", ru: "Email", uk: "Email" },
  { key: "Access", en: "Access", ru: "Доступ", uk: "Доступ" },
  { key: "Paid until", en: "Paid until", ru: "Оплачено до", uk: "Оплачено до" },
  { key: "Promo until", en: "Promo until", ru: "Промо до", uk: "Промо до" },
  { key: "Not active", en: "Not active", ru: "Не активно", uk: "Не активно" },
  { key: "Manage subscription", en: "Manage subscription", ru: "Управлять подпиской", uk: "Керувати підпискою" },
  {
    key: "Log in to unlock saved sessions and promo.",
    en: "Log in to unlock saved sessions and promo.",
    ru: "Войдите, чтобы открыть сохраненные сессии и промо.",
    uk: "Увійдіть, щоб відкрити збережені сесії та промо.",
  },
  { key: "History", en: "History", ru: "История", uk: "Історія" },
  { key: "Saved sessions", en: "Saved sessions", ru: "Сохраненные сессии", uk: "Збережені сесії" },
  { key: "Log in to see history.", en: "Log in to see history.", ru: "Войдите, чтобы увидеть историю.", uk: "Увійдіть, щоб побачити історію." },

  // SUBSCRIPTION
  { key: "Subscription", en: "Subscription", ru: "Подписка", uk: "Підписка" },
  { key: "Management", en: "Management", ru: "Управление", uk: "Управління" },
  { key: "Monthly subscription", en: "Monthly subscription", ru: "Ежемесячная подписка", uk: "Щомісячна підписка" },
  {
    key: "Please sign in to manage subscription.",
    en: "Please sign in to manage subscription.",
    ru: "Пожалуйста, войдите, чтобы управлять подпиской.",
    uk: "Будь ласка, увійдіть, щоб керувати підпискою.",
  },
  { key: "How it works", en: "How it works", ru: "Как это работает", uk: "Як це працює" },
  { key: "Auto-renew in production", en: "Auto-renew in production", ru: "Автосписание в продакшене", uk: "Автосписання в продакшені" },
  {
    key: "Start: first payment creates monthly auto-renew at WayForPay.",
    en: "Start: first payment creates monthly auto-renew at WayForPay.",
    ru: "Старт: первый платеж создаёт ежемесячное автосписание в WayForPay.",
    uk: "Старт: перший платіж створює щомісячне автосписання в WayForPay.",
  },
  {
    key: "Auto-renew: WayForPay charges monthly automatically.",
    en: "Auto-renew: WayForPay charges monthly automatically.",
    ru: "Автосписание: WayForPay списывает ежемесячно автоматически.",
    uk: "Автосписання: WayForPay списує щомісяця автоматично.",
  },
  {
    key: "Cancel: sends SUSPEND to WayForPay and disables future charges.",
    en: "Cancel: sends SUSPEND to WayForPay and disables future charges.",
    ru: "Отмена: отправляет SUSPEND в WayForPay и отключает будущие списания.",
    uk: "Скасування: відправляє SUSPEND у WayForPay і вимикає майбутні списання.",
  },
  {
    key: "Resume: sends RESUME to WayForPay and re-enables future charges.",
    en: "Resume: sends RESUME to WayForPay and re-enables future charges.",
    ru: "Возобновить: отправляет RESUME в WayForPay и включает будущие списания.",
    uk: "Відновити: відправляє RESUME у WayForPay і вмикає майбутні списання.",
  },

  // WIDGET
  { key: "Talk now", en: "Talk now", ru: "Поговорить сейчас", uk: "Поговорити зараз" },
  {
    key: "How would you like to start the conversation?",
    en: "How would you like to start the conversation?",
    ru: "Как Вам удобнее начать разговор?",
    uk: "Як Вам зручніше почати розмову?",
  },
]

function abs(p) {
  return path.join(ROOT, p)
}

function exists(p) {
  return fs.existsSync(abs(p))
}

function read(p) {
  return fs.readFileSync(abs(p), "utf8")
}

function write(p, s) {
  fs.writeFileSync(abs(p), s, "utf8")
}

function escReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function ensureUseClient(s) {
  if (/^["']use client["'];/m.test(s)) return s
  return `'use client'\n\n${s}`
}

function ensureImport(s, importLine) {
  if (s.includes(importLine)) return s

  const lines = s.split("\n")
  let i = 0

  // skip use client
  if (lines[i] && lines[i].includes("use client")) {
    i++
    while (lines[i] === "") i++
  }

  // find last import in header block
  let lastImport = -1
  for (let j = i; j < lines.length; j++) {
    if (lines[j].startsWith("import ")) {
      lastImport = j
      continue
    }
    if (lastImport !== -1 && lines[j].trim() === "") continue
    break
  }

  const insertAt = lastImport !== -1 ? lastImport + 1 : i
  lines.splice(insertAt, 0, importLine)
  return lines.join("\n")
}

function ensureUseLanguageHook(s) {
  // only if we will use t(...)
  if (!s.includes("t(")) return s

  s = ensureUseClient(s)
  s = ensureImport(s, `import { useLanguage } from "@/lib/i18n/language-context"`)

  // If t already defined
  if (s.includes("const { t } = useLanguage()")) return s

  // Insert inside first component function
  const fnRe = /export default function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{\s*/m
  if (fnRe.test(s)) {
    return s.replace(fnRe, (m) => `${m}\n  const { t } = useLanguage()\n`)
  }

  // If component is const X = () => {
  const constRe = /(const\s+[A-Za-z0-9_]+\s*=\s*\([^)]*\)\s*=>\s*\{\s*)/m
  if (constRe.test(s)) {
    return s.replace(constRe, (m) => `${m}\n  const { t } = useLanguage()\n`)
  }

  // Footer / named export function
  const namedFnRe = /export function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{\s*/m
  if (namedFnRe.test(s)) {
    return s.replace(namedFnRe, (m) => `${m}\n  const { t } = useLanguage()\n`)
  }

  return s
}

function applyReplacements(s, rules) {
  let out = s
  for (const r of rules) out = out.replace(r.re, r.to)
  return out
}

function patchTsxFile(p) {
  if (!exists(p)) return { changed: false, p, reason: "missing" }

  let s = read(p)
  const before = s

  // Pricing fixes
  const pricingRules = [
    { re: />\s*Щомісяця\s*</g, to: `>{t("Monthly")}<` },
    { re: />\s*Ваш профіль\s*</g, to: `>{t("Your profile")}<` },
    { re: />\s*Ваш профиль\s*</g, to: `>{t("Your profile")}<` },
    { re: />\s*Статус\s*</g, to: `>{t("Status")}<` },
    { re: />\s*Гость\s*</g, to: `>{t("Guest")}<` },
    { re: />\s*Гість\s*</g, to: `>{t("Guest")}<` },
    { re: />\s*Залишилось тріалу\s*</g, to: `>{t("Trial left")}<` },
    { re: />\s*Осталось триала\s*</g, to: `>{t("Trial left")}<` },
    { re: />\s*Відкрити профіль\s*</g, to: `>{t("Open profile")}<` },
    { re: />\s*Открыть профиль\s*</g, to: `>{t("Open profile")}<` },
    { re: />\s*Увійти\s*</g, to: `>{t("Sign in")}<` },
    { re: />\s*Войти\s*</g, to: `>{t("Sign in")}<` },
    { re: />\s*Промокод\s*</g, to: `>{t("Promo code")}<` },
    { re: />\s*Активувати промо\s*</g, to: `>{t("Activate promo")}<` },
    { re: />\s*Активировать промо\s*</g, to: `>{t("Activate promo")}<` },
    { re: />\s*Підписатися\s*</g, to: `>{t("Subscribe")}<` },
    { re: />\s*Подписаться\s*</g, to: `>{t("Subscribe")}<` },
    { re: /placeholder="\s*Промокод\s*"/g, to: `placeholder={t("Promo code")}` },
    { re: /placeholder="\s*Promo code\s*"/g, to: `placeholder={t("Promo code")}` },
    {
      re: />\s*12\s*місяців\s*безкоштовного\s*доступу\s*за\s*промокодом\s*</g,
      to: `>{t("12 months of free access with a promo code")}<`,
    },
    {
      re: />\s*12\s*месяцев\s*бесплатного\s*доступа\s*по\s*промокоду\s*</g,
      to: `>{t("12 months of free access with a promo code")}<`,
    },
    {
      re: />\s*Активація\s*промокоду\s*потребує\s*входу\.\s*</g,
      to: `>{t("Promo activation requires sign-in.")}<`,
    },
    {
      re: />\s*Активация\s*промокода\s*требует\s*входа\.\s*</g,
      to: `>{t("Promo activation requires sign-in.")}<`,
    },
    {
      re: />\s*Необмежений\s*доступ\s*до\s*чату,\s*голосу\s*та\s*відео\s*</g,
      to: `>{t("Unlimited access to chat, voice and video")}<`,
    },
    {
      re: />\s*Неограниченный\s*доступ\s*к\s*чату,\s*голосу\s*и\s*видео\s*</g,
      to: `>{t("Unlimited access to chat, voice and video")}<`,
    },
    { re: />\s*Необмежена\s*кількість\s*запитів\s*</g, to: `>{t("Unlimited requests")}<` },
    { re: />\s*Неограниченное\s*количество\s*запросов\s*</g, to: `>{t("Unlimited requests")}<` },
    { re: />\s*Чат,\s*голос\s*і\s*відео\s*</g, to: `>{t("Chat, voice and video")}<` },
    { re: />\s*Чат,\s*голос\s*и\s*видео\s*</g, to: `>{t("Chat, voice and video")}<` },
    {
      re: />\s*Історія\s*зберігається\s*у\s*профілі\s*</g,
      to: `>{t("History is saved in your profile")}<`,
    },
    {
      re: />\s*История\s*сохраняется\s*в\s*профиле\s*</g,
      to: `>{t("History is saved in your profile")}<`,
    },
    {
      re: />\s*Оплата\s*можлива\s*без\s*входу\.\s*Для\s*активації\s*промокоду\s*та\s*збереження\s*історії\s*рекомендуємо\s*увійти\.\s*</g,
      to: `>{t("Payment is available without signing in. To activate a promo code and save history we recommend signing in.")}<`,
    },
    {
      re: />\s*Оплата\s*возможна\s*без\s*входа\.\s*Для\s*активации\s*промокода\s*и\s*сохранения\s*истории\s*рекомендуем\s*войти\.\s*</g,
      to: `>{t("Payment is available without signing in. To activate a promo code and save history we recommend signing in.")}<`,
    },
    {
      re: />\s*Перевіряйте\s*баланс\s*тріалу\s*та\s*історію\s*</g,
      to: `>{t("Check your trial balance and history")}<`,
    },
    {
      re: />\s*Проверяйте\s*баланс\s*триала\s*и\s*историю\s*</g,
      to: `>{t("Check your trial balance and history")}<`,
    },
  ]

  // Profile fixes
  const profileRules = [
    { re: />\s*Profile\s*</g, to: `>{t("Profile")}<` },
    { re: />\s*Account\s*</g, to: `>{t("Account")}<` },
    { re: />\s*Login status and access\s*</g, to: `>{t("Login status and access")}<` },
    { re: />\s*History\s*</g, to: `>{t("History")}<` },
    { re: />\s*Saved sessions\s*</g, to: `>{t("Saved sessions")}<` },
    { re: />\s*Login to see history\.\s*</g, to: `>{t("Log in to see history.")}<` },
    { re: />\s*Manage subscription\s*</g, to: `>{t("Manage subscription")}<` },
    { re: />\s*Log in to unlock saved sessions and promo\.\s*</g, to: `>{t("Log in to unlock saved sessions and promo.")}<` },
    { re: /Paid until:\s*Not active/g, to: `${'${t("Paid until")}: '}${'${t("Not active")}'}`
      },
  ]

  // Subscription fixes
  const subscriptionRules = [
    { re: />\s*Подписка\s*</g, to: `>{t("Subscription")}<` },
    { re: />\s*Управление\s*</g, to: `>{t("Management")}<` },
    { re: />\s*Ежемесячная подписка\s*</g, to: `>{t("Monthly subscription")}<` },
    { re: />\s*Please sign in to manage subscription\.\s*</g, to: `>{t("Please sign in to manage subscription.")}<` },
    { re: />\s*How it works\s*</g, to: `>{t("How it works")}<` },
    { re: />\s*Автосписание в продакшене\s*</g, to: `>{t("Auto-renew in production")}<` },
    { re: />\s*Auto-renew in production\s*</g, to: `>{t("Auto-renew in production")}<` },
    { re: />\s*Start:\s*first payment creates monthly auto-renew at WayForPay\.\s*</g, to: `>{t("Start: first payment creates monthly auto-renew at WayForPay.")}<` },
    { re: />\s*Auto-renew:\s*WayForPay charges monthly automatically\.\s*</g, to: `>{t("Auto-renew: WayForPay charges monthly automatically.")}<` },
    { re: />\s*Cancel:\s*sends SUSPEND to WayForPay and disables future charges\.\s*</g, to: `>{t("Cancel: sends SUSPEND to WayForPay and disables future charges.")}<` },
    { re: />\s*Resume:\s*sends RESUME to WayForPay and re-enables future charges\.\s*</g, to: `>{t("Resume: sends RESUME to WayForPay and re-enables future charges.")}<` },
  ]

  // Widget fixes
  const widgetRules = [
    { re: />\s*Поговорити зараз\s*</g, to: `>{t("Talk now")}<` },
    { re: />\s*Поговорить сейчас\s*</g, to: `>{t("Talk now")}<` },
    { re: />\s*Talk now\s*</g, to: `>{t("Talk now")}<` },
    { re: />\s*Як\s*тобі\s*зараз\s*зручніше\s*почати\s*розмову\?\s*</g, to: `>{t("How would you like to start the conversation?")}<` },
  ]

  // Footer fixes (quick links match header)
  const footerRules = [
    { re: />\s*О нас\s*</g, to: `>{t("About the service")}<` },
  ]

  const isPricing = p.includes("/pricing/")
  const isProfile = p.includes("/profile/")
  const isSubscription = p.includes("/subscription/")
  const isWidget = p.includes("assistant-fab") || p.includes("ai-chat-dialog")
  const isFooter = p.includes("footer.tsx")

  let usedT = false

  if (isPricing) {
    s = applyReplacements(s, pricingRules)
    usedT = usedT || s.includes('t("Monthly")') || s.includes("t(")
  }

  if (isProfile) {
    // Minimal replacements; actual file may vary
    s = applyReplacements(s, profileRules)
    usedT = usedT || s.includes("t(")
  }

  if (isSubscription) {
    s = applyReplacements(s, subscriptionRules)
    usedT = usedT || s.includes("t(")
  }

  if (isWidget) {
    s = applyReplacements(s, widgetRules)
    usedT = usedT || s.includes("t(")
  }

  if (isFooter) {
    // We add About the service key anyway; if footer already correct it will do nothing
    s = applyReplacements(s, footerRules)
    usedT = usedT || s.includes("t(")
  }

  // If we introduced t(...) – ensure useLanguage + use client
  if (s !== before && s.includes("t(")) {
    s = ensureUseLanguageHook(s)
  }

  const changed = s !== before
  if (changed) write(p, s)

  return { changed, p, reason: changed ? "patched" : "no-changes" }
}

function upsertTranslations(filePath, langKey) {
  if (!exists(filePath)) return { changed: false, filePath, reason: "missing" }

  let s = read(filePath)
  const before = s

  for (const row of PACK) {
    const key = row.key
    const value = row[langKey]

    const keyRe = new RegExp(`["']${escReg(key)}["']\\s*:`)
    if (keyRe.test(s)) {
      // update value if different
      const valRe = new RegExp(`(["']${escReg(key)}["']\\s*:\\s*)["'][^"']*["']`)
      s = s.replace(valRe, `$1${JSON.stringify(value)}`)
      continue
    }

    // insert new key before end of object
    const asConstIdx = s.search(/\}\s*as\s*const/)
    if (asConstIdx !== -1) {
      const insertPos = s.lastIndexOf("}", asConstIdx)
      s =
        s.slice(0, insertPos) +
        `  ${JSON.stringify(key)}: ${JSON.stringify(value)},\n` +
        s.slice(insertPos)
      continue
    }

    // fallback: before last }
    const lastBrace = s.lastIndexOf("}")
    if (lastBrace !== -1) {
      s =
        s.slice(0, lastBrace) +
        `  ${JSON.stringify(key)}: ${JSON.stringify(value)},\n` +
        s.slice(lastBrace)
    }
  }

  const changed = s !== before
  if (changed) write(filePath, s)

  return { changed, filePath, reason: changed ? "patched" : "no-changes" }
}

console.log("=== i18n patch: profile/subscription/pricing/widget/footer ===")

const fileResults = []
for (const f of FILES) {
  const r = patchTsxFile(f)
  fileResults.push(r)
  if (r.reason === "patched") console.log("OK patched ->", f)
  else if (r.reason === "missing") console.log("SKIP missing ->", f)
}

const trResults = []
trResults.push(upsertTranslations(TFILES.en, "en"))
trResults.push(upsertTranslations(TFILES.ru, "ru"))
trResults.push(upsertTranslations(TFILES.uk, "uk"))

for (const r of trResults) {
  if (r.reason === "patched") console.log("OK translations patched ->", r.filePath)
  else if (r.reason === "missing") console.log("SKIP translations missing ->", r.filePath)
}

console.log("DONE")
