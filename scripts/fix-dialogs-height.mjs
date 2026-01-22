import fs from "fs"

const FILES = [
  "components/ai-chat-dialog.tsx",
  "components/video-call-dialog.tsx",
  "components/voice-call-dialog.tsx",
]

function patchFile(file) {
  if (!fs.existsSync(file)) {
    console.log("SKIP missing:", file)
    return
  }

  let s = fs.readFileSync(file, "utf8")
  const before = s

  // 1) ЧИНИМ СЛОМАННЫЙ style в ai-chat-dialog после прошлого патча
  // Было: style={keyboardOffset  className="turbota-assistant-dialog"> 0 ? ...}
  s = s.replace(
    /style=\{keyboardOffset\s+className="turbota-assistant-dialog">\s*0\s*\?\s*\(\{\s*bottom:\s*keyboardOffset\s*\}\s*as\s*any\)\s*:\s*undefined\}/m,
    'style={keyboardOffset > 0 ? ({ bottom: keyboardOffset } as any) : undefined}'
  )

  // 2) Добавляем turbota-assistant-dialog в className DialogContent (только если ещё нет)
  // Важно: НЕ используем <DialogContent ...> по >, чтобы снова не поломать
  s = s.replace(
    /(<DialogContent[\s\S]*?className=")([^"]*)"/m,
    (m, p1, cls) => {
      if (cls.includes("turbota-assistant-dialog")) return m
      return `${p1}turbota-assistant-dialog ${cls}"`
    }
  )

  // 3) Если у DialogContent вообще нет className — добавим рядом (редкий кейс)
  if (!s.includes("turbota-assistant-dialog")) {
    s = s.replace(/<DialogContent([\s\S]*?)>/m, (m, rest) => {
      if (m.includes("className=")) return m
      return `<DialogContent${rest} className="turbota-assistant-dialog">`
    })
  }

  if (s !== before) {
    fs.writeFileSync(file, s)
    console.log("OK patched:", file)
  } else {
    console.log("OK no changes:", file)
  }
}

for (const f of FILES) patchFile(f)
