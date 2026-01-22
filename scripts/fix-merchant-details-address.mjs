import fs from "fs"

const file = "components/merchant-details.tsx"
if (!fs.existsSync(file)) {
  console.log("SKIP missing:", file)
  process.exit(0)
}

let s = fs.readFileSync(file, "utf8")
const before = s

if (!s.includes("MERCHANT_LEGAL_ADDRESS")) {
  // вставляем импорт рядом с остальными импортами
  s = s.replace(
    /import[\s\S]*?\n\n/,
    (m) =>
      m +
      'import { MERCHANT_LEGAL_ADDRESS, MERCHANT_ACTUAL_ADDRESS } from "@/lib/merchant-address"\n\n'
  )
}

// Подменяем value=..., чтобы если пусто — показывало константу
s = s.replace(
  /value=\{info\.legalAddress\}/g,
  "value={info.legalAddress || MERCHANT_LEGAL_ADDRESS}"
)

s = s.replace(
  /value=\{info\.actualAddress\}/g,
  "value={info.actualAddress || MERCHANT_ACTUAL_ADDRESS}"
)

if (s !== before) {
  fs.writeFileSync(file, s)
  console.log("OK patched:", file)
} else {
  console.log("OK no changes:", file)
}
