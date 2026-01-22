import fs from "fs"

const file = "lib/i18n/translations/en.ts"
if (!fs.existsSync(file)) {
  console.log("SKIP missing:", file)
  process.exit(0)
}

const src = fs.readFileSync(file, "utf8")
const lines = src.split("\n")

// Находим диапазон главного объекта переводов: от первой "{", до строки с "} as const"
let start = -1
let end = -1

for (let i = 0; i < lines.length; i++) {
  if (start === -1 && lines[i].includes("=") && lines[i].includes("{")) start = i
  if (start !== -1 && lines[i].includes("} as const")) {
    end = i
    break
  }
}

if (start === -1 || end === -1 || end <= start) {
  console.log("WARN: cannot detect translations object range, fallback full-file dedupe")
  start = 0
  end = lines.length - 1
}

const beforeBlock = lines.slice(0, start + 1)
const block = lines.slice(start + 1, end)
const afterBlock = lines.slice(end)

const seen = new Set()
let removed = 0

// Идём снизу вверх по блоку, оставляем последнее значение каждого ключа
const outRev = []

for (let i = block.length - 1; i >= 0; i--) {
  const line = block[i]

  // 1) "Some key": "value",
  let m = line.match(/^\s*["']([^"']+)["']\s*:\s*/)
  // 2) Unlimited: "value",
  if (!m) m = line.match(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*/)

  if (m) {
    const key = m[1]
    if (seen.has(key)) {
      removed++
      continue
    }
    seen.add(key)
  }

  outRev.push(line)
}

const fixed = [...beforeBlock, ...outRev.reverse(), ...afterBlock].join("\n")
fs.writeFileSync(file, fixed)

console.log("OK fixed:", file)
console.log("Removed duplicate keys:", removed)
