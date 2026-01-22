import fs from "node:fs"

const file = "app/subscription/subscription-client.tsx"
let s = fs.readFileSync(file, "utf8")

const re =
  /<div className="space-y-3 text-sm text-slate-600">[\s\S]*?<span className="font-medium">Start:<\/span>[\s\S]*?<span className="font-medium">Resume:<\/span>[\s\S]*?<\/div>/m

if (!re.test(s)) {
  console.log("NOT FOUND: dev block not matched. Trying loose match...")

  const re2 =
    /<div[^>]*>[\s\S]*?<span className="font-medium">Start:<\/span>[\s\S]*?<span className="font-medium">Resume:<\/span>[\s\S]*?<\/div>/m

  if (!re2.test(s)) {
    console.log("FAILED: could not find Start/Resume block. Stop.")
    process.exit(1)
  }

  s = s.replace(
    re2,
    `<ul className="mt-2 space-y-2 text-sm text-slate-600">
                <li>{t("subscription.how.start")}</li>
                <li>{t("subscription.how.renew")}</li>
                <li>{t("subscription.how.cancel")}</li>
                <li>{t("subscription.how.resume")}</li>
                <li className="text-xs text-slate-500">{t("subscription.how.note")}</li>
              </ul>`
  )
} else {
  s = s.replace(
    re,
    `<ul className="mt-2 space-y-2 text-sm text-slate-600">
                <li>{t("subscription.how.start")}</li>
                <li>{t("subscription.how.renew")}</li>
                <li>{t("subscription.how.cancel")}</li>
                <li>{t("subscription.how.resume")}</li>
                <li className="text-xs text-slate-500">{t("subscription.how.note")}</li>
              </ul>`
  )
}

fs.writeFileSync(file, s)
console.log("OK patched:", file)
