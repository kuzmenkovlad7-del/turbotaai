import fs from "fs"

const patch = (file, pairs) => {
  if (!fs.existsSync(file)) {
    console.log("SKIP missing:", file)
    return
  }

  let s = fs.readFileSync(file, "utf8")
  const before = s

  for (const [key, val] of Object.entries(pairs)) {
    // заменяем именно значение по ключу
    const re = new RegExp(`"${key}"\\s*:\\s*"[^"]*",`, "g")
    s = s.replace(re, `"${key}": "${val}",`)
  }

  if (s !== before) {
    fs.writeFileSync(file, s)
    console.log("OK patched:", file)
  } else {
    console.log("OK no-change:", file)
  }
}

patch("lib/i18n/translations/ru.ts", {
  "Trial left": "Осталось вопросов",
  "Trial left:": "Осталось вопросов:",
  "Check trial balance and history": "Проверяйте баланс вопросов и историю",
  "Check your trial balance and history": "Проверяйте баланс вопросов и историю",
})

patch("lib/i18n/translations/uk.ts", {
  "Trial left": "Залишилось питань",
  "Trial left:": "Залишилось питань:",
  "Check trial balance and history": "Перевіряйте баланс питань та історію",
  "Check your trial balance and history": "Перевіряйте баланс питань та історію",
})
