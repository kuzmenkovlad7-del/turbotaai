import fs from "node:fs"

const file = "app/pricing/page.tsx"
let s = fs.readFileSync(file, "utf8")

// 1) Заголовок Тарифы -> t("Pricing")
s = s.replace(
  /<h1 className="text-4xl font-semibold">Тарифы<\/h1>/g,
  '<h1 className="text-4xl font-semibold">{t("Pricing")}</h1>'
)

// 2) Trial left / Access внутри JSX
s = s.replace(
  /<span>\{trialText \? "Access" : "Trial left"\}<\/span>/g,
  '<span>{trialText ? t("Access") : t("Trial left")}</span>'
)

fs.writeFileSync(file, s)
console.log("OK patched:", file)
