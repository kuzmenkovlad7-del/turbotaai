import fs from "fs"

const file = "components/assistant-fab.tsx"
if (!fs.existsSync(file)) {
  console.log("SKIP missing:", file)
  process.exit(0)
}

let s = fs.readFileSync(file, "utf8")
const before = s

// Частые варианты: z-[70], z-[60], z-50 — опускаем сильно ниже модалок
s = s.replace(/z-\[\s*70\s*\]/g, "z-[10]")
s = s.replace(/z-\[\s*60\s*\]/g, "z-[10]")
s = s.replace(/\bz-50\b/g, "z-[10]")

if (s !== before) {
  fs.writeFileSync(file, s)
  console.log("OK patched:", file)
} else {
  console.log("OK no-match (maybe already fixed):", file)
}
