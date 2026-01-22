import fs from "fs"

const file = "components/merchant-details.tsx"
if (!fs.existsSync(file)) {
  console.log("SKIP missing:", file)
  process.exit(0)
}

let s = fs.readFileSync(file, "utf8")
const before = s

const importLine =
  'import { MERCHANT_LEGAL_ADDRESS, MERCHANT_ACTUAL_ADDRESS } from "@/lib/merchant-address"\n'

if (!s.includes('from "@/lib/merchant-address"')) {
  // вставим после последнего import ...
  const imports = [...s.matchAll(/^import .*$/gm)]
  if (imports.length) {
    const last = imports[imports.length - 1]
    const idx = last.index + last[0].length
    s = s.slice(0, idx) + "\n" + importLine + s.slice(idx)
  } else {
    // если вдруг нет import блоков - вставим в самое начало
    s = importLine + "\n" + s
  }
}

if (s === before) {
  console.log("OK no changes:", file)
  process.exit(0)
}

fs.writeFileSync(file, s)
console.log("OK import added:", file)
