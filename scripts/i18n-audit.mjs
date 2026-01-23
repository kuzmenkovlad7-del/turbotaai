import fs from "fs"
import path from "path"

const ROOTS = ["app", "components", "lib"]
const TRANS = {
  en: "lib/i18n/translations/en.ts",
  ru: "lib/i18n/translations/ru.ts",
  uk: "lib/i18n/translations/uk.ts",
}

function walk(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next" || ent.name === ".git") continue
      out.push(...walk(p))
    } else out.push(p)
  }
  return out
}

function readKeys(file) {
  const s = fs.readFileSync(file, "utf8")
  const keys = new Set()
  const lines = s.split("\n")
  const multiProps = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // ключи в виде "Key": "Value",
    const m = line.match(/^\s*"([^"]+)"\s*:\s*/)
    if (m) keys.add(m[1])

    // ловим опасный кейс: два свойства на одной строке
    if (line.includes('":') && /"\s*:\s*"[^"]*"\s*,\s*"/.test(line)) {
      multiProps.push({ line: i + 1, text: line.trim() })
    }
  }
  return { keys, multiProps }
}

function extractUsedKeys(file) {
  const s = fs.readFileSync(file, "utf8")
  const used = new Set()

  // t("...") / t('...')
  const re = /\bt\(\s*["']([^"']+)["']\s*\)/g
  let m
  while ((m = re.exec(s))) used.add(m[1])

  return used
}

const transData = {}
for (const [lang, fp] of Object.entries(TRANS)) {
  if (!fs.existsSync(fp)) {
    console.log("ERR missing translations:", fp)
    process.exit(1)
  }
  transData[lang] = readKeys(fp)
}

const usedAll = new Set()
const files = ROOTS.flatMap(walk).filter((f) => /\.(tsx|ts)$/.test(f))
for (const f of files) {
  // не анализируем сами переводы и скрипты
  if (f.includes("lib/i18n/translations/")) continue
  if (f.startsWith("scripts/")) continue
  const used = extractUsedKeys(f)
  for (const k of used) usedAll.add(k)
}

// report missing per lang
function diff(a, b) {
  const out = []
  for (const x of a) if (!b.has(x)) out.push(x)
  return out.sort()
}

console.log("=== i18n audit ===")
console.log("Used t(...) keys:", usedAll.size)

for (const [lang, { keys, multiProps }] of Object.entries(transData)) {
  const missing = diff(usedAll, keys)
  console.log(`\n[${lang}] missing keys:`, missing.length)
  if (missing.length) {
    console.log(missing.slice(0, 80).map((x) => "  - " + x).join("\n"))
    if (missing.length > 80) console.log("  ...")
  }
  console.log(`[${lang}] suspicious multi-props lines:`, multiProps.length)
  if (multiProps.length) {
    for (const x of multiProps.slice(0, 20)) {
      console.log(`  ${lang}:${x.line} ${x.text}`)
    }
    if (multiProps.length > 20) console.log("  ...")
  }
}

console.log("\nDONE")
