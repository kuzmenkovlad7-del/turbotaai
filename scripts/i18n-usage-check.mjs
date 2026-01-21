import fs from "fs"
import path from "path"

const ROOT = process.cwd()

const translationsFile = path.join(ROOT, "lib/i18n/translations/en.ts")

function read(file) {
  return fs.readFileSync(file, "utf8")
}

function extractDictKeys(tsText) {
  const keys = new Set()
  const re = /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g
  let m
  while ((m = re.exec(tsText))) keys.add(m[1])
  return keys
}

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue
      walk(p, out)
    } else {
      if (!/\.(ts|tsx|js|jsx)$/.test(e.name)) continue
      out.push(p)
    }
  }
  return out
}

function extractTKeys(text) {
  const keys = new Set()
  const re = /\bt\(\s*["'`]([^"'`]+)["'`]\s*\)/g
  let m
  while ((m = re.exec(text))) {
    const k = m[1]
    if (k && k.length < 200) keys.add(k)
  }
  return keys
}

const dict = extractDictKeys(read(translationsFile))

const targets = [
  path.join(ROOT, "app"),
  path.join(ROOT, "components"),
  path.join(ROOT, "lib"),
]

const codeFiles = targets.flatMap((p) => (fs.existsSync(p) ? walk(p) : []))

const used = new Set()
for (const f of codeFiles) {
  const txt = read(f)
  for (const k of extractTKeys(txt)) used.add(k)
}

const missing = []
for (const k of used) {
  if (!dict.has(k)) missing.push(k)
}
missing.sort()

if (!missing.length) {
  console.log("OK: all t(...) keys exist in EN translations")
  process.exit(0)
}

console.log("Missing translation keys in EN:")
for (const k of missing) console.log(" - " + k)
process.exit(1)
