import fs from "fs"

const files = {
  en: "lib/i18n/translations/en.ts",
  ru: "lib/i18n/translations/ru.ts",
  uk: "lib/i18n/translations/uk.ts",
}

const PACK = {
  "Trial left": { en: "Trial left", ru: "Осталось триала", uk: "Залишилось тріалу" },
  "Access": { en: "Access", ru: "Доступ", uk: "Доступ" },
  "Active": { en: "Active", ru: "Активен", uk: "Активний" },
  "Unlimited": { en: "Unlimited", ru: "Безлимит", uk: "Безліміт" },
  "Promo code": { en: "Promo code", ru: "Промокод", uk: "Промокод" },
  "Free trial is over": { en: "Free trial is over", ru: "Пробный период завершён", uk: "Пробний період завершено" },
  "Subscribe to continue using the assistant.": {
    en: "Subscribe to continue using the assistant.",
    ru: "Оформите подписку, чтобы продолжить пользоваться ассистентом.",
    uk: "Оформіть підписку, щоб продовжити користуватися асистентом.",
  },
  "Subscribe": { en: "Subscribe", ru: "Подписаться", uk: "Підписатися" },
  "Later": { en: "Later", ru: "Позже", uk: "Пізніше" },
}

function upsert(filePath, lang) {
  let s = fs.readFileSync(filePath, "utf8")
  let changed = 0

  for (const [k, v] of Object.entries(PACK)) {
    if (s.includes(`"${k}":`)) continue
    const insert = `  "${k}": "${v[lang]}",\n`
    const idx = s.lastIndexOf("}\n")
    if (idx === -1) continue
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
