import fs from "fs"
import path from "path"

const ROOT = process.cwd()

const files = {
  en: path.join(ROOT, "lib/i18n/translations/en.ts"),
  ru: path.join(ROOT, "lib/i18n/translations/ru.ts"),
  uk: path.join(ROOT, "lib/i18n/translations/uk.ts"),
}

function read(file) {
  return fs.readFileSync(file, "utf8")
}

// Очень простой парсер ключей вида "KEY": ...
function extractKeys(tsText) {
  const keys = new Set()
  const re = /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g
  let m
  while ((m = re.exec(tsText))) {
    const k = m[1]
    if (!k) continue
    keys.add(k.replace(/\\"/g, '"'))
  }
  return keys
}

function diffKeys(base, target) {
  const missing = []
  const extra = []
  for (const k of base) if (!target.has(k)) missing.push(k)
  for (const k of target) if (!base.has(k)) extra.push(k)
  missing.sort()
  extra.sort()
  return { missing, extra }
}

const enText = read(files.en)
const ruText = read(files.ru)
const ukText = read(files.uk)

const enKeys = extractKeys(enText)
const ruKeys = extractKeys(ruText)
const ukKeys = extractKeys(ukText)

const ruDiff = diffKeys(enKeys, ruKeys)
const ukDiff = diffKeys(enKeys, ukKeys)

const extraInEnRU = diffKeys(ruKeys, enKeys)
const extraInEnUK = diffKeys(ukKeys, enKeys)

let ok = true

function printBlock(title, obj) {
  if (!obj.missing.length && !obj.extra.length) return
  console.log("\n" + title)
  if (obj.missing.length) {
    console.log("  Missing:")
    for (const k of obj.missing) console.log("   - " + k)
  }
  if (obj.extra.length) {
    console.log("  Extra:")
    for (const k of obj.extra) console.log("   + " + k)
  }
}

printBlock("RU vs EN", ruDiff)
printBlock("UK vs EN", ukDiff)

// Если EN что-то не содержит, но RU/UK содержат — тоже покажем
printBlock("EN is missing keys that exist in RU", extraInEnRU)
printBlock("EN is missing keys that exist in UK", extraInEnUK)

if (ruDiff.missing.length || ukDiff.missing.length) ok = false

console.log("\nKeys count:")
console.log("  EN:", enKeys.size)
console.log("  RU:", ruKeys.size)
console.log("  UK:", ukKeys.size)

process.exit(ok ? 0 : 1)
