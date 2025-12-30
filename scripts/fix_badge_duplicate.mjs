import fs from "node:fs"

function esc(s) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/"/g, '\\"')
}

function fixFile(filePath, desiredValue) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/)
  const key = `"Real experiences from beta users":`

  const idxs = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(key)) idxs.push(i)
  }

  if (idxs.length === 0) {
    console.log(`[warn] ${filePath}: key not found`)
    return
  }

  // 1) Обновляем ПЕРВОЕ вхождение
  const i0 = idxs[0]
  const v = esc(desiredValue)

  // стараемся заменить значение в этой же строке аккуратно
  // формат обычно: "key": "value",
  lines[i0] = lines[i0].replace(
    /"Real experiences from beta users"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*,?/,
    `"Real experiences from beta users": "${v}",`
  )

  // 2) Удаляем все последующие дубли (с конца, чтобы индексы не съехали)
  for (let k = idxs.length - 1; k >= 1; k--) {
    lines.splice(idxs[k], 1)
  }

  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8")
  console.log(`[ok] ${filePath}: kept 1, removed ${idxs.length - 1}, set value`)
}

fixFile("lib/i18n/translations/en.ts", "Real experiences from users")
fixFile("lib/i18n/translations/ru.ts", "Реальный опыт пользователей")
fixFile("lib/i18n/translations/uk.ts", "Реальний досвід користувачів")
