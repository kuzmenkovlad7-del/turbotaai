import { readFileSync, writeFileSync } from "node:fs"

const p = "components/voice-call-dialog.tsx"
let s = readFileSync(p, "utf8")
const before = s

let nEmpty = 0
let nSlice = 0

// 1) ...ChunksRef.current = []
s = s.replace(
  /(\b[A-Za-z_$][\w$]*ChunksRef)\.current\s*=\s*\[\s*\]\s*;?/g,
  (_, ref) => {
    nEmpty++
    return `${ref}.current.length = 0`
  }
)

// 2) ...ChunksRef.current = ...ChunksRef.current.slice(X)
// заменяем на splice(0, X) (только если X не отрицательный)
s = s.replace(
  /(\b[A-Za-z_$][\w$]*ChunksRef)\.current\s*=\s*\1\.current\.slice\(\s*([^)]+?)\s*\)\s*;?/g,
  (m, ref, arg) => {
    const a = String(arg).trim()
    if (a.startsWith("-")) return m // не трогаем отрицательный slice
    nSlice++
    return `${ref}.current.splice(0, (${a}))`
  }
)

if (s === before) {
  console.log("WARN: ничего не изменилось (не нашёл присваиваний для *ChunksRef.current).")
} else {
  writeFileSync(p, s, "utf8")
  console.log("OK patched:", p)
  console.log("Replaced empty assigns:", nEmpty)
  console.log("Replaced slice assigns:", nSlice)
}
