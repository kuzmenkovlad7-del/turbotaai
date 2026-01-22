import fs from "fs"

function read(file) {
  return fs.readFileSync(file, "utf8")
}
function write(file, s) {
  fs.writeFileSync(file, s)
}
function exists(file) {
  return fs.existsSync(file)
}

function patchFile(file, fn) {
  if (!exists(file)) {
    console.log("SKIP missing:", file)
    return
  }
  const before = read(file)
  const after = fn(before)
  if (after !== before) {
    write(file, after)
    console.log("OK patched:", file)
  } else {
    console.log("OK no-change:", file)
  }
}

/* =========================
   1) FIX EN duplicate Unlimited (inline)
   ========================= */
patchFile("lib/i18n/translations/en.ts", (s) => {
  // убираем именно встроенный Unlimited внутри строки Auto-renew in production
  return s.replace(
    /("Auto-renew in production"\s*:\s*"Auto-renew in production"\s*,)\s*"Unlimited"\s*:\s*"Unlimited"\s*,/g,
    "$1"
  )
})

/* =========================
   2) Header badge: нормальные переводы + без trial в RU/UK
   ========================= */
patchFile("components/header.tsx", (s) => {
  // badgeText блок полностью заменяем на нормальный вариант
  s = s.replace(
    /\/\/ badge text:[\s\S]*?const badgeText\s*=\s*[\s\S]*?:\s*null\s*/m,
`// badge text: правильный приоритет (и перевод)
  const badgeText =
    trialText
      ? \`\${t("Access")}: \${t(trialText)}\`
      : typeof trialLeft === "number"
      ? \`\${t("Trial left")}: \${trialLeft}\`
      : hasAccess
      ? \`\${t("Access")}: \${t("Active")}\`
      : null
`
  )

  // Paywall кнопки в баннере переводим
  s = s.replace(
    /<RainbowButton([\s\S]*?)>\s*Subscribe\s*<\/RainbowButton>/m,
    `<RainbowButton$1>{t("Subscribe")}</RainbowButton>`
  )
  s = s.replace(
    /<Button([^>]*?)>\s*Later\s*<\/Button>/m,
    `<Button$1>{t("Later")}</Button>`
  )

  return s
})

/* =========================
   3) Pricing page: остатки перевода
   ========================= */
patchFile("app/pricing/page.tsx", (s) => {
  s = s.replace(
    /loadingSummary\s*\?\s*"Loading\.\.\."\s*:\s*isLoggedIn\s*\?\s*"Logged in"\s*:\s*"Guest"/g,
    `loadingSummary ? t("Loading...") : isLoggedIn ? t("Logged in") : t("Guest")`
  )

  // иногда встречается без троеточий — на всякий
  s = s.replace(/"Loading\.\.\."/g, `t("Loading...")`)
  s = s.replace(/"Logged in"/g, `t("Logged in")`)
  s = s.replace(/"Guest"/g, `t("Guest")`)

  return s
})

/* =========================
   4) Footer quick links: добавить Pricing
   ========================= */
patchFile("components/footer.tsx", (s) => {
  if (s.includes('href: "/pricing"')) return s
  return s.replace(
    /const mainLinks: FooterLink\[\] = \[\s*([\s\S]*?)\s*\]\s*/m,
    (m, inside) => {
      // вставляем pricing последним пунктом
      const trimmed = inside.trim().replace(/,\s*$/, "")
      return `const mainLinks: FooterLink[] = [
  ${trimmed},
  { href: "/pricing", labelKey: "nav.pricing" },
]`
    }
  )
})

/* =========================
   5) Profile labels: Access / Trial left / Paid until / Promo until перевод
   ========================= */
patchFile("app/profile/page.tsx", (s) => {
  s = s.replace(
    /<span className="text-slate-500">Access:<\/span>/g,
    `<span className="text-slate-500">{t("Access")}:</span>`
  )
  s = s.replace(
    /<span className="text-slate-500">Trial left:<\/span>/g,
    `<span className="text-slate-500">{t("Trial left")}:</span>`
  )
  s = s.replace(
    /<span className="text-slate-500">Paid until:<\/span>/g,
    `<span className="text-slate-500">{t("Paid until")}:</span>`
  )
  s = s.replace(
    /<span className="text-slate-500">Promo until:<\/span>/g,
    `<span className="text-slate-500">{t("Promo until")}:</span>`
  )
  return s
})

/* =========================
   6) Paywall toast: переводы (если есть)
   ========================= */
patchFile("components/paywall-toast.tsx", (s) => {
  if (!s.includes("useLanguage")) {
    // если компонента без i18n — аккуратно добавим
    if (s.includes('from "@/lib/i18n/language-context"') === false) {
      s = s.replace(
        /from "react"/,
        `from "react"\nimport { useLanguage } from "@/lib/i18n/language-context"`
      )
    }
  }

  // заменяем строки если они захардкожены
  s = s.replace(/Free trial is over/g, `{t("Free trial is over")}`)
  s = s.replace(/Subscribe to continue using the assistant\./g, `{t("Subscribe to continue using the assistant.")}`)

  // если есть длинная строка про 5 вопросов — заменяем на ключ
  s = s.replace(
    /You used all 5 free questions\. Subscribe to continue using chat, voice and video sessions\./g,
    `{t("You used all free questions. Subscribe to continue.")}`
  )

  // гарантируем что t есть
  if (s.includes("{t(") && !s.includes("const { t } = useLanguage()")) {
    s = s.replace(
      /(export default function\s+\w+\(\)\s*\{\s*)/m,
      `$1\n  const { t } = useLanguage()\n`
    )
  }

  return s
})

/* =========================
   7) Video dialog: добавить turbota-assistant-dialog в DialogContent
   ========================= */
patchFile("components/video-call-dialog.tsx", (s) => {
  if (s.includes("turbota-assistant-dialog")) return s

  // className="..."
  let out = s.replace(
    /<DialogContent([\s\S]*?)className="([^"]*)"/m,
    (m, pre, cls) => `<DialogContent${pre}className="${cls} turbota-assistant-dialog"`
  )
  if (out !== s) return out

  // className={cn(...)}
  out = s.replace(
    /<DialogContent([\s\S]*?)className=\{cn\(/m,
    (m, pre) => `<DialogContent${pre}className={cn("turbota-assistant-dialog", `
  )
  if (out !== s) return out

  // вообще без className
  out = s.replace(
    /<DialogContent([^>]*)>/m,
    (m, rest) => `<DialogContent${rest} className="turbota-assistant-dialog">`
  )
  return out
})

/* =========================
   8) FAB z-index ниже модалок (чтобы не перекрывал)
   ========================= */
patchFile("components/assistant-fab.tsx", (s) => {
  // опускаем максимально безопасно
  s = s.replace(/z-\[\s*10\s*\]/g, "z-[1]")
  s = s.replace(/\bz-10\b/g, "z-[1]")
  s = s.replace(/z-\[\s*30\s*\]/g, "z-[1]")
  s = s.replace(/\bz-30\b/g, "z-[1]")
  s = s.replace(/\bz-50\b/g, "z-[1]")
  return s
})

/* =========================
   9) RU/UK переводы: убрать "trial" как слово, сделать нормально
   ========================= */
function upsertKV(file, map) {
  patchFile(file, (s) => {
    // вставка перед } as const
    const insertAt = s.lastIndexOf("} as const")
    if (insertAt === -1) return s

    let block = ""
    for (const [k, v] of Object.entries(map)) {
      const needle = `"${k}":`
      if (!s.includes(needle)) {
        block += `  "${k}": "${v}",\n`
      }
    }
    if (!block) return s
    return s.slice(0, insertAt) + block + s.slice(insertAt)
  })
}

upsertKV("lib/i18n/translations/en.ts", {
  "Trial left": "Trial left",
  "Access": "Access",
  "Active": "Active",
  "Subscribe": "Subscribe",
  "Later": "Later",
  "Loading...": "Loading...",
  "Logged in": "Logged in",
  "Paid until": "Paid until",
  "Promo until": "Promo until",
  "You used all free questions. Subscribe to continue.": "You used all free questions. Subscribe to continue.",
  "nav.pricing": "Pricing",
})

upsertKV("lib/i18n/translations/ru.ts", {
  "Trial": "Пробный доступ",
  "Limited": "Ограниченный доступ",
  "Unlimited": "Без ограничений",
  "Promo code": "Промокод",
  "Trial left": "Осталось вопросов",
  "Access": "Доступ",
  "Active": "Активен",
  "Subscribe": "Подписаться",
  "Later": "Позже",
  "Loading...": "Загрузка...",
  "Logged in": "Вход выполнен",
  "Paid until": "Оплачено до",
  "Promo until": "Промо до",
  "You used all free questions. Subscribe to continue.": "Вы использовали все бесплатные вопросы. Подпишитесь, чтобы продолжить.",
  "nav.pricing": "Тарифы",
  "Actual address": "Фактический адрес",
})

upsertKV("lib/i18n/translations/uk.ts", {
  "Trial": "Пробний доступ",
  "Limited": "Обмежений доступ",
  "Unlimited": "Без обмежень",
  "Promo code": "Промокод",
  "Trial left": "Залишилось питань",
  "Access": "Доступ",
  "Active": "Активний",
  "Subscribe": "Підписатися",
  "Later": "Пізніше",
  "Loading...": "Завантаження...",
  "Logged in": "Увійшли",
  "Paid until": "Оплачено до",
  "Promo until": "Промо до",
  "You used all free questions. Subscribe to continue.": "Ви використали всі безкоштовні питання. Підпишіться, щоб продовжити.",
  "nav.pricing": "Тарифи",
  "Actual address": "Фактична адреса",
})

console.log("DONE final fix")
