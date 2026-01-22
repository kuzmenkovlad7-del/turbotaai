import fs from "node:fs"

function read(file) {
  return fs.readFileSync(file, "utf8")
}
function write(file, s) {
  fs.writeFileSync(file, s)
}

function patchSubscriptionCopy(file) {
  let s = read(file)
  let changed = false

  // remove dev "How it works" block (Start/Auto-renew/SUSPEND/RESUME)
  const devBlockRe =
    /<div className="space-y-3 text-sm text-slate-600">[\s\S]*?<span className="font-medium">Start:<\/span>[\s\S]*?<span className="font-medium">Resume:<\/span>[\s\S]*?<\/div>/m

  if (devBlockRe.test(s)) {
    s = s.replace(
      devBlockRe,
      `<ul className="mt-2 space-y-2 text-sm text-slate-600">
                <li>{t("subscription.how.start")}</li>
                <li>{t("subscription.how.renew")}</li>
                <li>{t("subscription.how.cancel")}</li>
                <li>{t("subscription.how.resume")}</li>
                <li className="text-xs text-slate-500">{t("subscription.how.note")}</li>
              </ul>`
    )
    changed = true
  }

  // remove any extra dev note about paidUntil/promoUntil if present
  const paidPromoNoteRe =
    /<p className="text-xs text-slate-500">[\s\S]*?paidUntil[\s\S]*?<\/p>/m
  if (paidPromoNoteRe.test(s)) {
    s = s.replace(paidPromoNoteRe, "")
    changed = true
  }

  // remove debug Paid/Promo raw fields if present in UI
  const debugPaidPromoRe =
    /\s*Paid:\s*\{fmt\(data\?\.\s*paidUntil[\s\S]*?\}\s*<br \/>\s*Promo:\s*\{fmt\(data\?\.\s*promoUntil[\s\S]*?\}\s*/m
  if (debugPaidPromoRe.test(s)) {
    s = s.replace(debugPaidPromoRe, "")
    changed = true
  }

  if (changed) write(file, s)
  return { file, ok: changed, reason: changed ? "patched" : "no-change" }
}

function insertKeysIntoTranslations(file, entries) {
  let s = read(file)
  let changed = false

  for (const [k] of entries) {
    if (s.includes(`"${k}"`)) continue

    // insert before last } of exported object
    const lastBrace = s.lastIndexOf("}")
    if (lastBrace === -1) throw new Error(`No closing brace in ${file}`)

    // find last non-space before brace
    let i = lastBrace - 1
    while (i >= 0 && /\s/.test(s[i])) i--

    const needsComma = s[i] !== "," && s[i] !== "{"
    const insert =
      (needsComma ? "," : "") +
      "\n" +
      entries.map(([kk, vv]) => `  "${kk}": "${vv}"`).join(",\n") +
      "\n"

    s = s.slice(0, lastBrace) + insert + s.slice(lastBrace)
    changed = true
    break
  }

  if (changed) write(file, s)
  return { file, ok: changed, reason: changed ? "patched" : "no-change" }
}

function ensureDialogClass(file) {
  let s = read(file)
  let changed = false

  // pattern: className="..."
  const re1 = /(<DialogContent[^>]*className=")([^"]*)(")/m
  if (re1.test(s)) {
    s = s.replace(re1, (m, p1, cls, p3) => {
      if (cls.includes("turbota-assistant-dialog")) return m
      changed = true
      return `${p1}${cls} turbota-assistant-dialog${p3}`
    })
  }

  // pattern: className={cn("...")}
  const re2 = /(className=\{cn\(\s*")([^"]*)("\s*[,\)])/m
  if (!changed && re2.test(s)) {
    s = s.replace(re2, (m, p1, cls, p3) => {
      if (cls.includes("turbota-assistant-dialog")) return m
      changed = true
      return `${p1}${cls} turbota-assistant-dialog${p3}`
    })
  }

  if (changed) write(file, s)
  return { file, ok: changed, reason: changed ? "patched" : "no-change" }
}

function appendGlobalCss() {
  const file = "app/globals.css"
  if (!fs.existsSync(file)) return { file, ok: false, reason: "missing" }

  let s = read(file)

  const marker = "/* TURBOTAAI_ASSISTANT_DIALOG_SIZING */"
  if (s.includes(marker)) return { file, ok: false, reason: "no-change" }

  s += `

${marker}
.turbota-assistant-dialog{
  width: min(420px, calc(100vw - 24px));
  height: min(720px, calc(100vh - 24px));
  max-height: calc(100vh - 24px);
  max-width: calc(100vw - 24px);
}
@media (max-width: 640px){
  .turbota-assistant-dialog{
    width: calc(100vw - 16px);
    height: calc(100vh - 16px);
    max-height: calc(100vh - 16px);
    max-width: calc(100vw - 16px);
  }
}

/* floating CTA should always be above page content */
.turbota-fab{
  position: fixed;
  z-index: 80;
}
`
  write(file, s)
  return { file, ok: true, reason: "patched" }
}

const results = []

// 1) /subscription text fix
results.push(patchSubscriptionCopy("app/subscription/subscription-client.tsx"))

// 2) translations for merchant + subscription copy
const enEntries = [
  ["merchant.title", "Company contact information"],
  ["merchant.fullName", "Legal name"],
  ["merchant.ipn", "Tax ID"],
  ["merchant.legalAddress", "Legal address"],
  ["merchant.actualAddress", "Actual address"],
  ["merchant.phone", "Phone"],
  ["merchant.email", "Email"],

  ["subscription.how.start", "Your subscription starts after the first successful payment."],
  ["subscription.how.renew", "It automatically renews monthly until you cancel it."],
  ["subscription.how.cancel", "You can cancel anytime. Access stays active until the end of the paid period."],
  ["subscription.how.resume", "If needed, you can resume your subscription later."],
  ["subscription.how.note", "Payments are processed by WayForPay."],
]
const ruEntries = [
  ["merchant.title", "Контактная информация компании"],
  ["merchant.fullName", "Полное наименование"],
  ["merchant.ipn", "ИНН"],
  ["merchant.legalAddress", "Юридический адрес"],
  ["merchant.actualAddress", "Фактический адрес"],
  ["merchant.phone", "Телефон"],
  ["merchant.email", "Email"],

  ["subscription.how.start", "Подписка активируется после первой успешной оплаты."],
  ["subscription.how.renew", "Далее она автоматически продлевается каждый месяц, пока вы не отмените её."],
  ["subscription.how.cancel", "Отменить можно в любой момент. Доступ сохранится до конца оплаченного периода."],
  ["subscription.how.resume", "При необходимости подписку можно возобновить позже."],
  ["subscription.how.note", "Оплата обрабатывается через WayForPay."],
]
const ukEntries = [
  ["merchant.title", "Контактна інформація компанії"],
  ["merchant.fullName", "Повне найменування"],
  ["merchant.ipn", "ІПН"],
  ["merchant.legalAddress", "Юридична адреса"],
  ["merchant.actualAddress", "Фактична адреса"],
  ["merchant.phone", "Телефон"],
  ["merchant.email", "Email"],

  ["subscription.how.start", "Підписка активується після першої успішної оплати."],
  ["subscription.how.renew", "Далі вона автоматично продовжується щомісяця, поки ви її не скасуєте."],
  ["subscription.how.cancel", "Скасувати можна будь-коли. Доступ збережеться до кінця оплаченого періоду."],
  ["subscription.how.resume", "За потреби підписку можна відновити пізніше."],
  ["subscription.how.note", "Оплата обробляється через WayForPay."],
]

results.push(insertKeysIntoTranslations("lib/i18n/translations/en.ts", enEntries))
results.push(insertKeysIntoTranslations("lib/i18n/translations/ru.ts", ruEntries))
results.push(insertKeysIntoTranslations("lib/i18n/translations/uk.ts", ukEntries))

// 3) chat + video dialog class to force sizing (same as voice)
results.push(ensureDialogClass("components/ai-chat-dialog.tsx"))
results.push(ensureDialogClass("components/video-call-dialog.tsx"))

// 4) global CSS for sizing + z-index helper class
results.push(appendGlobalCss())

console.log("HOTFIX jan22 UI")
for (const r of results) console.log(r)
