import fs from "node:fs"

const file = "components/video-call-dialog.tsx"
let s = fs.readFileSync(file, "utf8")

const tagStart = s.indexOf("<DialogContent")
if (tagStart === -1) {
  console.error("DialogContent not found")
  process.exit(1)
}
const tagEnd = s.indexOf(">", tagStart)
if (tagEnd === -1) {
  console.error("DialogContent tag end not found")
  process.exit(1)
}

const tag = s.slice(tagStart, tagEnd + 1)
if (tag.includes("turbota-assistant-dialog")) {
  console.log("OK already has turbota-assistant-dialog:", file)
  process.exit(0)
}

let patchedTag = tag

if (patchedTag.includes('className="')) {
  patchedTag = patchedTag.replace('className="', 'className="turbota-assistant-dialog ')
} else if (patchedTag.includes('className={cn("')) {
  patchedTag = patchedTag.replace('className={cn("', 'className={cn("turbota-assistant-dialog ')
} else {
  patchedTag = patchedTag.replace(">", ' className="turbota-assistant-dialog">')
}

s = s.slice(0, tagStart) + patchedTag + s.slice(tagEnd + 1)
fs.writeFileSync(file, s)
console.log("OK patched:", file)
