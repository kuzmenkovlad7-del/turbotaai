import fs from "node:fs"

const file = "components/auto-translate.tsx"
let s = fs.readFileSync(file, "utf8")

if (s.includes("[currentLanguage.name]")) {
  console.log("OK: auto-translate deps already include currentLanguage.name")
  process.exit(0)
}

const before = s
s = s.replace(/\},\s*\[\s*\]\s*\)/, "}, [currentLanguage.name])")

if (s === before) {
  console.log("WARN: could not patch auto-translate deps automatically. Please open file and check useEffect deps.")
  process.exit(0)
}

fs.writeFileSync(file, s)
console.log("OK patched:", file)
