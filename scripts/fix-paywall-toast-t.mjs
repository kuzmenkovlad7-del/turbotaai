import fs from "fs"

const file = "components/paywall-toast.tsx"
if (!fs.existsSync(file)) {
  console.log("ERR missing:", file)
  process.exit(1)
}

let s = fs.readFileSync(file, "utf8")
const before = s

// 1) импорт useLanguage
if (!s.includes('useLanguage') || !s.includes('from "@/lib/i18n/language-context"')) {
  // вставим после последнего import
  const importLine = `import { useLanguage } from "@/lib/i18n/language-context"\n`
  const re = /(import[\s\S]*?\n)(\n|export|function)/m

  if (re.test(s)) {
    s = s.replace(re, (m, impBlock, next) => {
      if (impBlock.includes('from "@/lib/i18n/language-context"')) return m
      return impBlock + importLine + next
    })
  } else {
    // если вдруг импорты не найдены
    s = importLine + s
  }
}

// 2) const { t } = useLanguage() внутри компонента
if (!s.includes("const { t } = useLanguage()")) {
  const patterns = [
    /export default function PaywallToast\s*\([^)]*\)\s*\{/m,
    /export function PaywallToast\s*\([^)]*\)\s*\{/m,
    /function PaywallToast\s*\([^)]*\)\s*\{/m,
  ]

  let patched = false
  for (const p of patterns) {
    if (p.test(s)) {
      s = s.replace(p, (m) => `${m}\n  const { t } = useLanguage()\n`)
      patched = true
      break
    }
  }

  if (!patched) {
    console.log("ERR: could not find PaywallToast() function header to inject t()")
    process.exit(2)
  }
}

if (s === before) {
  console.log("OK no-change:", file)
  process.exit(0)
}

fs.writeFileSync(file, s)
console.log("OK patched:", file)
