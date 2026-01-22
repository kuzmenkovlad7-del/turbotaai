import fs from "node:fs"

const file = "components/video-call-dialog.tsx"
let s = fs.readFileSync(file, "utf8")

const re = /<Dialog(Content|Primitive\.Content)([\s\S]*?)>/m
const m = s.match(re)

if (!m) {
  console.error("DialogContent not found in:", file)
  process.exit(1)
}

const fullTag = m[0]
if (fullTag.includes("turbota-assistant-dialog")) {
  console.log("OK already patched:", file)
  process.exit(0)
}

let patched = fullTag

if (patched.includes('className="')) {
  patched = patched.replace('className="', 'className="turbota-assistant-dialog ')
} else if (patched.includes('className={cn("')) {
  patched = patched.replace('className={cn("', 'className={cn("turbota-assistant-dialog ')
} else {
  patched = patched.replace(">", ' className="turbota-assistant-dialog">')
}

s = s.replace(fullTag, patched)
fs.writeFileSync(file, s)

console.log("OK patched:", file)
