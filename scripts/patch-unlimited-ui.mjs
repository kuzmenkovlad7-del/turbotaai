import fs from "fs"
import path from "path"

function walk(dir, acc = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true })
  for (const it of items) {
    const p = path.join(dir, it.name)
    if (it.isDirectory()) {
      if (it.name === "node_modules" || it.name.startsWith(".")) continue
      walk(p, acc)
    } else if (it.isFile()) {
      if (p.endsWith(".tsx") || p.endsWith(".ts")) acc.push(p)
    }
  }
  return acc
}

function patchFile(file) {
  let s = fs.readFileSync(file, "utf8")
  if (!s.includes("Trial left")) return false

  // JSX: Trial left: {obj.trialLeft}
  const r1 = /Trial left:\s*\{([^}]*\b(\w+)\.(trialLeft|trial_left)\b[^}]*)\}/g
  let changed = false

  s = s.replace(r1, (_m, _expr, obj, prop) => {
    changed = true
    return `Trial left: {${obj}.access === "Trial" ? ${obj}.${prop} : "Unlimited"}`
  })

  // JSX: Trial left: {something?.trialLeft}
  const r2 = /Trial left:\s*\{([^}]*\b(\w+)\?\.(trialLeft|trial_left)\b[^}]*)\}/g
  s = s.replace(r2, (_m, _expr, obj, prop) => {
    changed = true
    return `Trial left: {${obj}?.access === "Trial" ? ${obj}?.${prop} : "Unlimited"}`
  })

  if (!changed) return false
  fs.writeFileSync(file, s, "utf8")
  return true
}

const roots = ["app", "components"]
let files = []
for (const r of roots) {
  if (fs.existsSync(r)) files = files.concat(walk(r))
}

let n = 0
for (const f of files) {
  try {
    if (patchFile(f)) {
      console.log("[OK] patched:", f)
      n++
    }
  } catch {}
}

console.log(JSON.stringify({ ok: true, patched_files: n }, null, 2))
