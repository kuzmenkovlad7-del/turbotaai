import fs from "fs"

const files = [
  "app/api/account/summary/route.ts",
  "app/api/turbotaai-agent/route.ts",
]

function patch(file) {
  let s = fs.readFileSync(file, "utf8")

  // 1) add LAST_USER_COOKIE const
  if (!s.includes('const LAST_USER_COOKIE = "turbotaai_last_user"')) {
    s = s.replace(
      'const DEVICE_COOKIE = "turbotaai_device"\n',
      'const DEVICE_COOKIE = "turbotaai_device"\nconst LAST_USER_COOKIE = "turbotaai_last_user"\n'
    )
  }

  // 2) ensureGrant destructure includes guestGrant (summary route)
  s = s.replace(
    /const\s*\{\s*grant\s*,\s*scope\s*\}\s*=\s*await ensureGrant\(/g,
    "const { grant, scope, guestGrant } = await ensureGrant("
  )

  // 3) set last user cookie when logged in
  // insert after isLoggedIn definition
  s = s.replace(
    /const isLoggedIn = Boolean\(user\?\.\id\)\n/g,
    `const isLoggedIn = Boolean(user?.id)\n\n  // remember last logged-in user (for trial sync after logout)\n  if (isLoggedIn && user?.id) {\n    extraCookies.push({\n      name: LAST_USER_COOKIE,\n      value: user.id,\n      options: { path: "/", sameSite: "lax", httpOnly: false, maxAge: 60 * 60 * 24 * 365 },\n    })\n  }\n`
  )

  // 4) sync guest trial with last account trial on guest view
  // replace first "const trialLeft =" to "let trialLeft =" and inject sync block once
  if (!s.includes("sync guest trial after logout")) {
    s = s.replace(
      /const trialLeft = clampTrial\(([^;]+)\);\n/g,
      `let trialLeft = clampTrial($1);\n\n  // sync guest trial after logout: guest = min(guest, last account)\n  if (!isLoggedIn && grant?.id) {\n    const lastUserId = cookieStore.get(LAST_USER_COOKIE)?.value ?? null\n    if (lastUserId) {\n      const accountKey = ACCOUNT_PREFIX + lastUserId\n      const lastAcc = await findGrantByDevice(sb, accountKey)\n      if (lastAcc) {\n        const aLeft = clampTrial(lastAcc.trial_questions_left ?? trialDefault, trialDefault)\n        const eff = Math.min(trialLeft, aLeft)\n        if (eff !== trialLeft) {\n          await updateGrant(sb, grant.id, { trial_questions_left: eff, updated_at: nowIso })\n          trialLeft = eff\n        }\n      }\n    }\n  }\n`
    )
  }

  fs.writeFileSync(file, s, "utf8")
  console.log("[OK] patched", file)
}

for (const f of files) patch(f)
