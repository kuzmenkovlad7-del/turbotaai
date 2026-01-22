import fs from "node:fs"

const files = [
  "components/ai-chat-dialog.tsx",
  "components/video-call-dialog.tsx",
  "components/voice-call-dialog.tsx",
]

function patchFile(file) {
  if (!fs.existsSync(file)) return { file, ok: false, reason: "missing" }

  let s = fs.readFileSync(file, "utf8")
  if (s.includes("turbota-assistant-dialog")) return { file, ok: true, reason: "already" }

  const before = s
  // className="...": добавляем в конец
  s = s.replace(
    /(<DialogContent\b[^>]*\bclassName=)(["'])([^"']*)(\2)/,
    (_m, p1, q, cls, p4) => `${p1}${q}${cls} turbota-assistant-dialog${p4}`
  )

  if (s === before) {
    return { file, ok: false, reason: "no-match" }
  }

  fs.writeFileSync(file, s)
  return { file, ok: true, reason: "patched" }
}

for (const f of files) {
  const r = patchFile(f)
  console.log(r.ok ? "OK" : "WARN", r)
}
