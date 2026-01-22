import fs from "fs"

const files = {
  en: "lib/i18n/translations/en.ts",
  ru: "lib/i18n/translations/ru.ts",
  uk: "lib/i18n/translations/uk.ts",
}

const PACK = {
  "Access": { en: "Access", ru: "Доступ", uk: "Доступ" },
  "Trial left": { en: "Trial left", ru: "Осталось триала", uk: "Залишилось тріалу" },
  "Active": { en: "Active", ru: "Активен", uk: "Активний" },

  "Unlimited": { en: "Unlimited", ru: "Безлимит", uk: "Безліміт" },
  "Promo code": { en: "Promo code", ru: "Промокод", uk: "Промокод" },

  "Free trial is over": { en: "Free trial is over", ru: "Пробный период закончился", uk: "Пробний період завершився" },
  "Subscribe to continue using the assistant.": {
    en: "Subscribe to continue using the assistant.",
    ru: "Оформите подписку, чтобы продолжить пользоваться ассистентом.",
    uk: "Оформіть підписку, щоб продовжити користуватися асистентом.",
  },
  "Subscribe": { en: "Subscribe", ru: "Подписаться", uk: "Підписатися" },
  "Later": { en: "Later", ru: "Позже", uk: "Пізніше" },

  "nav.pricing": { en: "Pricing", ru: "Тарифы", uk: "Тарифи" },
}

const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')

function upsert(filePath, lang) {
  if (!fs.existsSync(filePath)) {
    console.log("WARN missing:", filePath)
    return 0
  }

  let s = fs.readFileSync(filePath, "utf8")
  let changed = 0

  for (const [key, v] of Object.entries(PACK)) {
    const value = v[lang] ?? v.en
    const rx = new RegExp(`\\n\\s*"${key.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"\\s*:`, "m")
    if (rx.test(s)) continue

    const idx = s.lastIndexOf("\n}")
    if (idx === -1) continue

    const insert = `\n  "${esc(key)}": "${esc(value)}",`
    s = s.slice(0, idx) + insert + s.slice(idx)
    changed++
  }

  if (changed) fs.writeFileSync(filePath, s)
  return changed
}

console.log("DONE i18n upsert:", {
  en: upsert(files.en, "en"),
  ru: upsert(files.ru, "ru"),
  uk: upsert(files.uk, "uk"),
})
