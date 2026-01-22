import fs from "fs"

const targets = [
  { file: "lib/i18n/translations/ru.ts", map: {
      "Trial left:": "Запросов осталось:",
      "Trial left": "Запросов осталось",
      "Free trial is over": "Бесплатные запросы закончились",
    }
  },
  { file: "lib/i18n/translations/uk.ts", map: {
      "Trial left:": "Залишилось запитів:",
      "Trial left": "Залишилось запитів",
      "Free trial is over": "Безкоштовні запити закінчилися",
    }
  },
]

function patchOne(file, map) {
  if (!fs.existsSync(file)) return { file, ok: false, reason: "missing" }

  let s = fs.readFileSync(file, "utf8")
  const before = s

  for (const [k, v] of Object.entries(map)) {
    const re = new RegExp(`"${k}"\\s*:\\s*"[^"]*",`, "g")
    s = s.replace(re, `"${k}": "${v}",`)
  }

  if (s !== before) fs.writeFileSync(file, s)
  return { file, ok: s !== before, reason: s !== before ? "patched" : "no-change" }
}

for (const t of targets) {
  console.log(patchOne(t.file, t.map))
}
