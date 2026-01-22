import fs from "fs"

const file = "components/header.tsx"
if (!fs.existsSync(file)) {
  console.log("SKIP missing:", file)
  process.exit(0)
}

let s = fs.readFileSync(file, "utf8")
const before = s

s = s.replace(
  /`Trial left:\s*\$\{trialLeft\}`/g,
  "`${t(\"Trial left\")}: ${trialLeft}`"
)

if (s !== before) {
  fs.writeFileSync(file, s)
  console.log("OK patched:", file)
} else {
  console.log("OK no-change:", file)
}
