import fs from "fs"

const file = "lib/i18n/translations/ru.ts"
if (!fs.existsSync(file)) {
  console.log("ERR missing:", file)
  process.exit(1)
}

let s = fs.readFileSync(file, "utf8")

const re = /"Unlimited"\s*:\s*"[^"]*"\s*,?/g
const matches = [...s.matchAll(re)]

if (matches.length <= 1) {
  console.log("OK no duplicate Unlimited:", matches.length)
  process.exit(0)
}

// берём последнюю версию значения
const last = matches[matches.length - 1][0].replace(/,\s*$/, "")

// удаляем ВСЕ Unlimited
s = s.replace(re, "")

// чистим мусорные запятые после удаления
s = s.replace(/,\s*,/g, ",")
s = s.replace(/\{\s*,/g, "{")
s = s.replace(/,\s*\}/g, "}")

// вставляем обратно одну Unlimited перед закрывающей скобкой
s = s.replace(/(\n[ \t]*)\}\s*as const/m, (m, indent) => {
  return `${indent}  ${last},${indent}} as const`
})

fs.writeFileSync(file, s)
console.log("OK fixed Unlimited duplicates:", matches.length - 1)
