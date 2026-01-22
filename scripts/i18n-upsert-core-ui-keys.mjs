import fs from "node:fs"

const files = {
  en: "lib/i18n/translations/en.ts",
  ru: "lib/i18n/translations/ru.ts",
  uk: "lib/i18n/translations/uk.ts",
}

const PACK = [
  { k: "Access", en: "Access", ru: "Доступ", uk: "Доступ" },
  { k: "Trial left", en: "Trial left", ru: "Осталось триала", uk: "Залишилось триалу" },
  { k: "Unlimited", en: "Unlimited", ru: "Безлимит", uk: "Безліміт" },
  { k: "Promo code", en: "Promo code", ru: "Промокод", uk: "Промокод" },
  { k: "Active", en: "Active", ru: "Активно", uk: "Активно" },
  { k: "Guest", en: "Guest", ru: "Гость", uk: "Гість" },
  { k: "Not active", en: "Not active", ru: "Не активно", uk: "Не активно" },

  { k: "Account", en: "Account", ru: "Аккаунт", uk: "Акаунт" },
  { k: "History", en: "History", ru: "История", uk: "Історія" },
  { k: "Email", en: "Email", ru: "Email", uk: "Email" },
  { k: "Paid until", en: "Paid until", ru: "Оплачено до", uk: "Оплачено до" },
  { k: "Promo until", en: "Promo until", ru: "Промо до", uk: "Промо до" },
  { k: "Manage subscription", en: "Manage subscription", ru: "Управлять подпиской", uk: "Керувати підпискою" },

  { k: "Login to see history.", en: "Login to see history.", ru: "Войдите, чтобы увидеть историю.", uk: "Увійдіть, щоб побачити історію." },
  { k: "Login to unlock saved sessions and promo.", en: "Login to unlock saved sessions and promo.", ru: "Войдите, чтобы открыть сохраненные сессии и промокод.", uk: "Увійдіть, щоб відкрити збережені сесії та промокод." },

  { k: "Free trial is over", en: "Free trial is over", ru: "Бесплатный пробный период закончился", uk: "Безкоштовний пробний період завершився" },
  { k: "Subscribe to continue using the assistant.", en: "Subscribe to continue using the assistant.", ru: "Подпишитесь, чтобы продолжить пользоваться ассистентом.", uk: "Підпишіться, щоб продовжити користуватися асистентом." },
  { k: "Subscribe", en: "Subscribe", ru: "Подписаться", uk: "Підписатися" },
  { k: "Later", en: "Later", ru: "Позже", uk: "Пізніше" },

  // Access labels used in profile mapping
  { k: "Trial", en: "Trial", ru: "Триал", uk: "Тріал" },
  { k: "Limited", en: "Limited", ru: "Ограничено", uk: "Обмежено" },

  // WayForPay addresses (если где-то понадобится)
  { k: "Actual address", en: "Actual address", ru: "Фактический адрес", uk: "Фактична адреса" },
  { k: "Login status and access", en: "Login status and access", ru: "Статус входа и доступ", uk: "Статус входу і доступ" },
]

function upsert(filePath, entries, lang) {
  let s = fs.readFileSync(filePath, "utf8")
  let changed = 0

  for (const e of entries) {
    const key = e.k
    const val = e[lang]
    const needle = `"${key}":`
    if (s.includes(needle)) continue

    // вставляем перед последней закрывающей скобкой объекта
    const idx = s.lastIndexOf("\n}")
    if (idx === -1) continue

    const insert = `  "${key}": ${JSON.stringify(val)},\n`
    s = s.slice(0, idx) + insert + s.slice(idx)
    changed++
  }

  if (changed) fs.writeFileSync(filePath, s)
  return changed
}

const c1 = upsert(files.en, PACK, "en")
const c2 = upsert(files.ru, PACK, "ru")
const c3 = upsert(files.uk, PACK, "uk")

console.log("DONE i18n upsert:", { en: c1, ru: c2, uk: c3 })
