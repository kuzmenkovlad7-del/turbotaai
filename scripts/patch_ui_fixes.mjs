import fs from "node:fs"

function read(p) {
  return fs.readFileSync(p, "utf8")
}
function write(p, s) {
  fs.writeFileSync(p, s, "utf8")
  console.log(`[write] ${p}`)
}
function patchFile(p, fn) {
  if (!fs.existsSync(p)) {
    console.log(`[skip] ${p} (not found)`)
    return
  }
  const before = read(p)
  const after = fn(before)
  if (after === before) {
    console.log(`[noop] ${p}`)
    return
  }
  write(p, after)
}

function replaceAll(s, pairs) {
  let out = s
  for (const [re, rep] of pairs) out = out.replace(re, rep)
  return out
}

// 1) Контактная кнопка: синий -> фиолетовый (максимально безопасные замены)
function patchContactButton(s) {
  return replaceAll(s, [
    [/\bbg-blue-500\b/g, "bg-violet-600"],
    [/\bbg-blue-600\b/g, "bg-violet-600"],
    [/\bbg-blue-700\b/g, "bg-violet-700"],
    [/\bhover:bg-blue-500\b/g, "hover:bg-violet-700"],
    [/\bhover:bg-blue-600\b/g, "hover:bg-violet-700"],
    [/\bhover:bg-blue-700\b/g, "hover:bg-violet-700"],
    [/\bfocus-visible:ring-blue-500\b/g, "focus-visible:ring-violet-600"],
    [/\bfocus-visible:ring-blue-600\b/g, "focus-visible:ring-violet-600"],
    [/\bfocus:ring-blue-500\b/g, "focus:ring-violet-600"],
    [/\bfocus:ring-blue-600\b/g, "focus:ring-violet-600"],
  ])
}

// 2) Убрать “клеточку” (grid pattern): добавляем override на тот же селектор из блока
function patchGlobalsCss(s) {
  const marker = "Global soft grid background pattern"
  if (!s.includes(marker)) return s

  // находим селектор сразу после комментария
  const idx = s.indexOf(marker)
  const tail = s.slice(idx)
  const lines = tail.split(/\r?\n/)

  let selector = ""
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith("/*")) continue
    const m = line.match(/^([^{}]+)\s*\{/)
    if (m) {
      selector = m[1].trim()
      break
    }
  }
  if (!selector) return s

  const tag = "/* Disable soft grid background pattern */"
  if (s.includes(tag)) return s

  const isPseudo = selector.includes("::before") || selector.includes("::after")
  const extra =
    "\n\n" +
    tag +
    "\n" +
    selector +
    " {\n" +
    (isPseudo ? "  content: none !important;\n" : "") +
    "  background-image: none !important;\n" +
    "  opacity: 0 !important;\n" +
    "}\n"

  return s + extra
}

// 3) Бейджик на /client-stories: убрать “beta” (правим переводы, ключ оставляем)
function patchBadgeTranslation(s, lang) {
  const map = {
    en: "Real experiences from users",
    ru: "Реальный опыт пользователей",
    uk: "Реальний досвід користувачів",
  }
  const val = map[lang]
  if (!val) return s

  const re = /("Real experiences from beta users"\s*:\s*)"[^"]*"/
  if (!re.test(s)) return s

  return s.replace(re, `$1"${val}"`)
}

patchFile("components/contact-form.tsx", patchContactButton)
patchFile("components/contact-section.tsx", patchContactButton)
patchFile("app/globals.css", patchGlobalsCss)

patchFile("lib/i18n/translations/en.ts", (s) => patchBadgeTranslation(s, "en"))
patchFile("lib/i18n/translations/ru.ts", (s) => patchBadgeTranslation(s, "ru"))
patchFile("lib/i18n/translations/uk.ts", (s) => patchBadgeTranslation(s, "uk"))
