import fs from "fs"
import path from "path"

const FILES = [
  "components/ai-chat-dialog.tsx",
  "components/video-call-dialog.tsx",
  "components/voice-call-dialog.tsx",
]

function patchDialogContent(file) {
  if (!fs.existsSync(file)) return { file, ok: false, reason: "missing" }

  let s = fs.readFileSync(file, "utf8")
  const before = s

  if (s.includes("turbota-assistant-dialog")) {
    return { file, ok: true, reason: "already" }
  }

  // 1) className="..."
  s = s.replace(
    /<DialogContent([^>]*?)className="([^"]*)"/m,
    (m, pre, cls) => `<DialogContent${pre}className="${cls} turbota-assistant-dialog"`
  )

  if (s !== before) {
    fs.writeFileSync(file, s)
    return { file, ok: true, reason: "patched-className-string" }
  }

  // 2) className={cn(...)}
  s = before.replace(
    /<DialogContent([^>]*?)className=\{cn\(/m,
    (m, pre) => `<DialogContent${pre}className={cn("turbota-assistant-dialog", `
  )

  if (s !== before) {
    fs.writeFileSync(file, s)
    return { file, ok: true, reason: "patched-cn" }
  }

  // 3) вообще без className
  s = before.replace(
    /<DialogContent([^>]*)>/m,
    (m, pre) => `<DialogContent${pre} className="turbota-assistant-dialog">`
  )

  if (s !== before) {
    fs.writeFileSync(file, s)
    return { file, ok: true, reason: "patched-added-className" }
  }

  return { file, ok: false, reason: "no-match" }
}

function walk(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

function patchFabZIndex() {
  const all = walk("components").filter((f) => f.endsWith(".tsx"))
  let touched = 0

  for (const f of all) {
    let s = fs.readFileSync(f, "utf8")
    const before = s

    // ищем именно фиксированный FAB с "Поговорить сейчас" / "Talk Now"
    if (!s.includes("fixed") || (!s.includes("Поговорить") && !s.includes("Talk"))) continue

    // самый частый кейс: z-[70]
    s = s.replace(/z-\[70\]/g, "z-[30]")

    // иногда z-50 тоже бывает слишком высоко для FAB
    s = s.replace(/z-50/g, "z-30")

    if (s !== before) {
      fs.writeFileSync(f, s)
      touched++
      console.log("OK fab z-index patched:", f)
    }
  }

  return touched
}

// --- run ---
for (const f of FILES) {
  const r = patchDialogContent(f)
  console.log(r.ok ? "OK" : "WARN", r)
}

const fabTouched = patchFabZIndex()
console.log("DONE fabTouched:", fabTouched)
