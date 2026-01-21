import fs from "fs"
import path from "path"
import vm from "vm"
import { createRequire } from "module"

const require = createRequire(import.meta.url)

function loadTsDict(filePath, langGuess) {
  let ts
  try {
    ts = require("typescript")
  } catch (e) {
    throw new Error("Missing dependency: typescript. Run: npm i -D typescript")
  }

  const input = fs.readFileSync(filePath, "utf8")
  const out = ts.transpileModule(input, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
  })

  const mod = { exports: {} }
  vm.runInNewContext(out.outputText, { module: mod, exports: mod.exports, require, process })

  const exp = mod.exports || {}
  const byLang =
    exp.default ||
    exp[langGuess] ||
    exp.translations ||
    exp[Object.keys(exp).find((k) => typeof exp[k] === "object")] ||
    null

  if (!byLang || typeof byLang !== "object") {
    throw new Error(`Cannot load dict from ${filePath}`)
  }
  return byLang
}

function detectExportName(filePath, fallback) {
  const txt = fs.readFileSync(filePath, "utf8")
  const m = txt.match(/export\s+const\s+([a-zA-Z0-9_]+)\s*=/)
  if (m && m[1]) return m[1]
  return fallback
}

function stringifyObj(obj) {
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b))
  const lines = []
  lines.push("{")
  for (const k of keys) {
    const v = obj[k]
    const kk = JSON.stringify(k)
    const vv = JSON.stringify(v)
    lines.push(`  ${kk}: ${vv},`)
  }
  lines.push("}")
  return lines.join("\n")
}

function writeTsDict(filePath, exportName, dict) {
  const body = stringifyObj(dict)
  const content =
`export const ${exportName} = ${body} as const

export default ${exportName}
`
  fs.writeFileSync(filePath, content, "utf8")
}

const ROOT = process.cwd()
const files = {
  en: path.join(ROOT, "lib/i18n/translations/en.ts"),
  ru: path.join(ROOT, "lib/i18n/translations/ru.ts"),
  uk: path.join(ROOT, "lib/i18n/translations/uk.ts"),
}

const en = loadTsDict(files.en, "en")
const ru = loadTsDict(files.ru, "ru")
const uk = loadTsDict(files.uk, "uk")

// === CRITICAL: keys missing in EN (from usage-check) ===
const mustExistInEN = {
  "AI Psychologist": "AI companion",
  "AI specialist Video Call": "AI companion Video Call",
  "Choose Your AI specialist": "Choose Your AI companion",
  "Choose an AI specialist and press “Start video call” to begin.": "Choose an AI companion and press “Start video call” to begin.",
  "Choose voice for this session": "Choose voice for this session",

  "AI assistant is temporarily unavailable. Please try again a bit later.": "AI assistant is temporarily unavailable. Please try again a bit later.",
  "Assistant is speaking. Please wait a moment.": "Assistant is speaking. Please wait a moment.",
  "Assistant is speaking...": "Assistant is speaking...",

  "About": "About",
  "Contacts": "Contacts",
  "Home": "Home",
  "Languages": "Languages",
  "Pricing": "Pricing",
  "Profile": "Profile",

  "Already have an account?": "Already have an account?",
  "Create account": "Create account",
  "Creating account...": "Creating account...",
  "Enter your credentials": "Enter your credentials",
  "Register to save your sessions and preferences.": "Register to save your sessions and preferences.",
  "Password": "Password",
  "Repeat password": "Repeat password",
  "Passwords do not match": "Passwords do not match",
  "Full name (optional)": "Full name (optional)",
  "Sign Out": "Sign Out",
  "Sign in to continue": "Sign in to continue",
  "Signing in...": "Signing in...",

  "Select": "Select",
  "Selected": "Selected",
  "Select Language": "Select Language",

  "Send": "Send",
  "Sending": "Sending",
  "Loading...": "Loading...",

  "Connecting": "Connecting",
  "Connecting...": "Connecting...",
  "Connection error. Please try again.": "Connection error. Please try again.",

  "Listening...": "Listening...",
  "Thinking...": "Thinking...",
  "Speaking...": "Speaking...",

  "Start with female voice": "Start with female voice",
  "Start with male voice": "Start with male voice",

  "Failed to start the call. Please check your microphone and camera permissions.": "Failed to start the call. Please check your microphone and camera permissions.",
  "Microphone is not available.": "Microphone is not available.",
  "Your browser does not support voice recording. Please use Chrome or another modern browser.": "Your browser does not support voice recording. Please use Chrome or another modern browser.",

  "Support for everyday conversations, powered by AI": "Support for everyday conversations, powered by AI",
  "Welcome Back": "Welcome Back",
}

for (const [k, v] of Object.entries(mustExistInEN)) en[k] = v

// === Remove doctor/psychology/therapy from VALUES (keys remain as-is) ===
function sanitizeEN(s) {
  return String(s)
    .replaceAll("psychologist", "companion")
    .replaceAll("psychiatrist", "professional")
    .replaceAll("doctor", "professional")
    .replaceAll("therapy", "support")
    .replaceAll("psychological", "emotional")
}

function sanitizeRU(s) {
  return String(s)
    .replaceAll("психолог", "співрозмовник")
    .replaceAll("психиатр", "фахівець")
    .replaceAll("доктор", "фахівець")
    .replaceAll("терапи", "підтримк")
}

function sanitizeUK(s) {
  return String(s)
    .replaceAll("психолог", "співрозмовник")
    .replaceAll("психіатр", "фахівець")
    .replaceAll("доктор", "фахівець")
    .replaceAll("терапі", "підтримц")
}

function applySanitize(dict, fn) {
  for (const k of Object.keys(dict)) dict[k] = fn(dict[k])
}

applySanitize(en, sanitizeEN)
applySanitize(ru, sanitizeRU)
applySanitize(uk, sanitizeUK)

// === Strong overrides for disclaimer keys (no doctors/psychology) ===
const disclaimerEN = {
  "TurbotaAI is not a replacement for a licensed psychologist or psychiatrist.": "TurbotaAI is not a replacement for professional help.",
  "• TurbotaAI is not a doctor and not a psychiatrist.": "• TurbotaAI is a supportive service, not medical care.",
  "• The assistant is a supportive tool that can live alongside individual or group therapy.": "• The assistant is a supportive tool that can complement your personal support.",
  "• Answers are based on selected psychological books and materials that were tested with a psychologist.": "• Answers are based on carefully selected well-being materials reviewed by experts.",
  "TurbotaAI is not an emergency service and does not replace consultations with a doctor, psychiatrist or other licensed healthcare professional. If you are in danger or may harm yourself or others, you must immediately contact emergency services or a human specialist.":
    "TurbotaAI is not an emergency service and does not replace professional help. If you are in danger or may harm yourself or others, contact local emergency services immediately.",
}

for (const [k, v] of Object.entries(disclaimerEN)) {
  en[k] = v
  ru[k] = ru[k] ?? v
  uk[k] = uk[k] ?? v
}

// === UNION keys across EN/RU/UK ===
const union = new Set([...Object.keys(en), ...Object.keys(ru), ...Object.keys(uk)])

function fillMissing(dict) {
  for (const k of union) {
    if (!(k in dict)) dict[k] = en[k] ?? k
  }
}

fillMissing(en)
fillMissing(ru)
fillMissing(uk)

// WRITE BACK
const enName = detectExportName(files.en, "en")
const ruName = detectExportName(files.ru, "ru")
const ukName = detectExportName(files.uk, "uk")

writeTsDict(files.en, enName, en)
writeTsDict(files.ru, ruName, ru)
writeTsDict(files.uk, ukName, uk)

console.log("OK: i18n synced EN/RU/UK, missing keys added, values sanitized")
