import fs from "fs"

const file = "components/merchant-details.tsx"
if (!fs.existsSync(file)) {
  console.log("WARN missing:", file)
  process.exit(0)
}

let s = fs.readFileSync(file, "utf8")
const before = s

// добавим поля в info, если есть объект info = { ... }
if (!s.includes("NEXT_PUBLIC_MERCHANT_LEGAL_ADDRESS")) {
  s = s.replace(
    /legalAddress:\s*[^,\n]+/m,
    'legalAddress: (process.env.NEXT_PUBLIC_MERCHANT_LEGAL_ADDRESS || "").trim()'
  )
}

if (!s.includes("NEXT_PUBLIC_MERCHANT_ACTUAL_ADDRESS")) {
  s = s.replace(
    /actualAddress:\s*[^,\n]+/m,
    'actualAddress: (process.env.NEXT_PUBLIC_MERCHANT_ACTUAL_ADDRESS || "").trim()'
  )
}

if (s === before) {
  console.log("WARN no-match, please open components/merchant-details.tsx and ensure info.legalAddress / info.actualAddress exist")
  process.exit(0)
}

fs.writeFileSync(file, s)
console.log("OK patched:", file)
