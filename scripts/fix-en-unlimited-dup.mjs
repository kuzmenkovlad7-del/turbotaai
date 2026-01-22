import fs from "fs"

const file = "lib/i18n/translations/en.ts"
if (!fs.existsSync(file)) {
  console.log("SKIP missing:", file)
  process.exit(0)
}

const lines = fs.readFileSync(file, "utf8").split("\n")

// находим все строки где ключ Unlimited
const idx = []
for (let i = 0; i < lines.length; i++) {
  if (/^\s*["']?Unlimited["']?\s*:/.test(lines[i])) idx.push(i)
}

if (idx.length <= 1) {
  console.log("OK no duplicate Unlimited found:", idx.length)
  process.exit(0)
}

// оставляем последнюю, удаляем все предыдущие
for (let k = 0; k < idx.length - 1; k++) {
  lines[idx[k]] = "__REMOVE_LINE__"
}

const fixed = lines.filter((l) => l !== "__REMOVE_LINE__").join("\n")
fs.writeFileSync(file, fixed)

console.log("OK removed Unlimited duplicates:", idx.length - 1)
