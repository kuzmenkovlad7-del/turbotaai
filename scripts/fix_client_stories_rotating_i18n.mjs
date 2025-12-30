import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()

const pagePath = path.join(ROOT, "app/client-stories/page.tsx")
const enPath = path.join(ROOT, "lib/i18n/translations/en.ts")
const ruPath = path.join(ROOT, "lib/i18n/translations/ru.ts")
const ukPath = path.join(ROOT, "lib/i18n/translations/uk.ts")

function mustExist(p) {
  if (!fs.existsSync(p)) throw new Error(`File not found: ${p}`)
}

function read(p) {
  return fs.readFileSync(p, "utf-8")
}

function write(p, s) {
  fs.writeFileSync(p, s, "utf-8")
}

function escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function escapeForTsString(s) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
}

function findProp(text, key) {
  const k = escapeForRegex(escapeForTsString(key))
  const re = new RegExp(
    `(^\\s*)"${k}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"(\\s*,?)`,
    "m",
  )
  const m = text.match(re)
  if (!m) return null
  return { indent: m[1], valueEscaped: m[2], comma: m[3] }
}

function setProp(text, key, value) {
  const keyEsc = escapeForTsString(key)
  const valEsc = escapeForTsString(value)

  const k = escapeForRegex(keyEsc)
  const re = new RegExp(
    `(^\\s*)"${k}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"(\\s*,?)`,
    "m",
  )

  if (re.test(text)) {
    return text.replace(re, (_all, indent, _old, comma) => {
      return `${indent}"${keyEsc}": "${valEsc}"${comma}`
    })
  }

  // insert before final "}" of the exported object
  const endMatch = text.match(/}\s*$/)
  if (!endMatch || endMatch.index == null) {
    throw new Error("Could not find end of translations object (missing trailing '}')") 
  }
  const insertPos = endMatch.index

  let before = text.slice(0, insertPos)
  const after = text.slice(insertPos)

  // ensure there's a comma before we add a new property (unless object is empty)
  const beforeTrim = before.replace(/\s*$/, "")
  const lastNonWs = beforeTrim[beforeTrim.length - 1]
  if (lastNonWs && lastNonWs !== "," && lastNonWs !== "{") {
    before = beforeTrim + ",\n"
  } else {
    before = beforeTrim + "\n"
  }

  const line = `  "${keyEsc}": "${valEsc}",\n`
  return before + line + after
}

function extractRotatingTestimonialsKeys(pageSource) {
  const idx = pageSource.indexOf("const rotatingTestimonials")
  if (idx === -1) throw new Error("Could not find `const rotatingTestimonials` in app/client-stories/page.tsx")

  const open = pageSource.indexOf("[", idx)
  if (open === -1) throw new Error("Could not find '[' after `const rotatingTestimonials`")

  let depth = 0
  let close = -1
  for (let i = open; i < pageSource.length; i++) {
    const ch = pageSource[i]
    if (ch === "[") depth++
    else if (ch === "]") {
      depth--
      if (depth === 0) {
        close = i
        break
      }
    }
  }
  if (close === -1) throw new Error("Could not find matching closing ']' for rotatingTestimonials array")

  const block = pageSource.slice(open, close + 1)

  // extract t("...") and t('...') calls
  const keys = []
  const re = /t\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')\s*\)/g
  let m
  while ((m = re.exec(block))) {
    const s = m[1] ?? m[2]
    if (s != null) keys.push(s)
  }

  // unique, keep order
  const seen = new Set()
  const out = []
  for (const k of keys) {
    if (!seen.has(k)) {
      seen.add(k)
      out.push(k)
    }
  }
  return out
}

async function openaiTranslateBatch(strings, targetLang) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set (needed to translate missing strings)")

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini"

  const prompt =
    `Translate each string from English to ${targetLang}.\n` +
    `Return ONLY valid JSON object mapping the original string to the translation.\n` +
    `Rules:\n` +
    `- Preserve punctuation, dashes, and quotes.\n` +
    `- Transliterate names naturally for ${targetLang} when appropriate.\n` +
    `- Do not add any extra commentary.\n\n` +
    `Strings:\n` +
    strings.map((s, i) => `${i + 1}. ${s}`).join("\n")

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are a precise translation engine. Output only JSON." },
        { role: "user", content: prompt },
      ],
    }),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => "")
    throw new Error(`OpenAI error ${res.status}: ${t}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error("OpenAI returned empty content")

  let jsonText = content
  if (!jsonText.startsWith("{")) {
    const a = jsonText.indexOf("{")
    const b = jsonText.lastIndexOf("}")
    if (a !== -1 && b !== -1 && b > a) jsonText = jsonText.slice(a, b + 1)
  }

  const obj = JSON.parse(jsonText)
  return obj && typeof obj === "object" ? obj : {}
}

async function translateAndPatch(langName, filePath, text, keys) {
  const need = []
  for (const k of keys) {
    const prop = findProp(text, k)
    if (!prop) {
      need.push(k)
      continue
    }
    // untranslated fallback (value === key)
    if (prop.valueEscaped === escapeForTsString(k)) {
      need.push(k)
    }
  }

  if (need.length === 0) {
    console.log(`[noop] ${langName}: nothing to translate`)
    return { nextText: text, translated: 0, inserted: 0 }
  }

  console.log(`[translate] ${langName}: ${need.length} strings (missing or fallback)`)

  const chunkSize = 20
  let outText = text
  let translated = 0
  let inserted = 0

  for (let i = 0; i < need.length; i += chunkSize) {
    const chunk = need.slice(i, i + chunkSize)
    const dict = await openaiTranslateBatch(chunk, langName)

    for (const k of chunk) {
      const v = dict[k]
      if (typeof v === "string" && v.trim().length > 0) {
        const existed = !!findProp(outText, k)
        outText = setProp(outText, k, v)
        translated++
        if (!existed) inserted++
      } else {
        // keep as-is, but report
        console.log(`[warn] ${langName}: missing translation for: ${k}`)
      }
    }
  }

  return { nextText: outText, translated, inserted }
}

async function main() {
  mustExist(pagePath)
  mustExist(enPath)
  mustExist(ruPath)
  mustExist(ukPath)

  const pageSrc = read(pagePath)
  const keys = extractRotatingTestimonialsKeys(pageSrc)

  if (keys.length === 0) {
    console.log("[noop] no t(...) keys found in rotatingTestimonials")
    return
  }

  let enText = read(enPath)
  let ruText = read(ruPath)
  let ukText = read(ukPath)

  // ensure EN contains all keys (identity)
  let enAdded = 0
  for (const k of keys) {
    if (!findProp(enText, k)) {
      enText = setProp(enText, k, k)
      enAdded++
    }
  }
  if (enAdded) console.log(`[write] en.ts: added ${enAdded}`)

  // re-translate only missing/fallback in RU/UK
  const ruRes = await translateAndPatch("Russian", ruPath, ruText, keys)
  const ukRes = await translateAndPatch("Ukrainian", ukPath, ukText, keys)

  // optional: normalize badge label value if present
  const badgeKey = "Real experiences from beta users"
  enText = setProp(enText, badgeKey, "Real experiences from users")
  ruRes.nextText = setProp(ruRes.nextText, badgeKey, "Реальный опыт пользователей")
  ukRes.nextText = setProp(ukRes.nextText, badgeKey, "Реальний досвід користувачів")

  // write files
  write(enPath, enText)
  write(ruPath, ruRes.nextText)
  write(ukPath, ukRes.nextText)

  console.log(`[done] i18n fixed: EN add=${enAdded}, RU translated=${ruRes.translated} (inserted=${ruRes.inserted}), UK translated=${ukRes.translated} (inserted=${ukRes.inserted})`)
}

main().catch((e) => {
  console.error(e?.stack || String(e))
  process.exit(1)
})
