import fs from "fs"

const file = "lib/i18n/translations/en.ts"
if (!fs.existsSync(file)) {
  console.log("SKIP missing:", file)
  process.exit(0)
}

const lines = fs.readFileSync(file, "utf8").split("\n")

// идём снизу вверх: сохраняем последнюю версию ключа, а старые выкидываем
const seen = new Set()
const outRev = []

for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i]
  const m = line.match(/^\s*"([^"]+)"\s*:\s*/)
  if (m) {
    const key = m[1]
    if (seen.has(key)) continue
    seen.add(key)
  }
  outRev.push(line)
}

fs.writeFileSync(file, outRev.reverse().join("\n"))
console.log("OK deduped:", file)
