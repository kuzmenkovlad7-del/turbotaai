import fs from "fs"

function read(p){ return fs.readFileSync(p,"utf8") }
function write(p,s){ fs.writeFileSync(p,s,"utf8") }
function die(m){ console.error("PATCH FAILED:", m); process.exit(1) }

function patchVoice() {
  const p = "components/voice-call-dialog.tsx"
  let s = read(p)

  // 1) УБИРАЕМ MediaRecorder.pause() блок (на Android часто ломает дальнейшую запись)
  s = s.replace(
    /\n\s*const rec = mediaRecorderRef\.current\s*\n\s*if\s*\(\s*rec\s*&&\s*rec\.state\s*===\s*"recording"\s*\)\s*\{\s*\n\s*try\s*\{\s*rec\.pause\(\)\s*\}\s*catch\s*\{\s*\}\s*\n\s*\}\s*\n/g,
    "\n"
  )

  // 2) УБИРАЕМ MediaRecorder.resume() блок
  s = s.replace(
    /\n\s*const rec = mediaRecorderRef\.current\s*\n\s*if\s*\(\s*rec\s*&&\s*rec\.state\s*===\s*"paused"[^\)]*\)\s*\{\s*\n\s*try\s*\{\s*rec\.resume\(\)\s*\}\s*catch\s*\{\s*\}\s*\n\s*\}\s*\n/g,
    "\n"
  )

  // 3) ЖЁСТКО отключаем auto-translate для контейнера сообщений:
  //    Добавим data-no-translate на корневой контейнер сообщений, если найдём messages.map
  if (s.includes("messages.map")) {
    // грубый, но безопасный патч: помечаем весь блок, где рендерятся сообщения
    // ищем первый div, внутри которого есть messages.map, и добавляем атрибут
    const idx = s.indexOf("messages.map")
    const divStart = s.lastIndexOf("<div", idx)
    if (divStart > 0) {
      const divTagEnd = s.indexOf(">", divStart)
      if (divTagEnd > divStart) {
        const tag = s.slice(divStart, divTagEnd+1)
        if (!tag.includes("data-no-translate")) {
          const patchedTag = tag.replace("<div", '<div data-no-translate="true" translate="no"')
          s = s.slice(0, divStart) + patchedTag + s.slice(divTagEnd+1)
        }
      }
    }
  }

  write(p,s)
  console.log("OK patched:", p)
}

function patchAutoTranslate() {
  const p = "components/auto-translate.tsx"
  if (!fs.existsSync(p)) {
    console.log("SKIP:", p, "(not found)")
    return
  }
  let s = read(p)

  // Вставляем универсальный guard: если элемент внутри [data-no-translate] или translate="no" — не трогаем
  // Пытаемся вставить в translateElementWithCurrentTranslations(...) или translateElement(...)
  const candidates = [
    "function translateElementWithCurrentTranslations",
    "function translateElement",
    "const translateElementWithCurrentTranslations",
    "const translateElement"
  ]

  let inserted = false
  for (const c of candidates) {
    const i = s.indexOf(c)
    if (i < 0) continue
    const brace = s.indexOf("{", i)
    if (brace < 0) continue
    const inject =
      `\n  // skip chat / protected blocks\n  try {\n    const anyEl = element as any\n    const closest = (anyEl?.closest?.bind(anyEl))\n    if (closest && (closest('[data-no-translate="true"]') || closest('[translate="no"]'))) {\n      return\n    }\n  } catch {}\n`
    if (s.slice(brace, brace+500).includes('data-no-translate')) {
      inserted = true
      break
    }
    s = s.slice(0, brace+1) + inject + s.slice(brace+1)
    inserted = true
    break
  }

  if (!inserted) {
    console.log("WARN: couldn't auto-insert guard into auto-translate.tsx")
  } else {
    console.log("OK patched:", p)
  }

  write(p,s)
}

patchVoice()
patchAutoTranslate()
console.log("DONE")
