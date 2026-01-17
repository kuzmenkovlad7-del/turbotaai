import fs from "fs"

const files = [
  "app/api/account/summary/route.ts",
  "app/api/turbotaai-agent/route.ts",
]

const NEW_BLOCK = `
/**
 * ЕДИНАЯ логика:
 * - guest: grant по device_hash = device uuid cookie
 * - account: grant по device_hash = account:<userId>
 * - при логине никогда не даем поднять trial: effective = min(guestLeft, accountLeft)
 * - paid/promo берем как max-date из обоих
 */
async function ensureGrant(sb: any, deviceHash: string, userId: string | null, trialDefault: number, nowIso: string) {
  const laterDate = (a: any, b: any) => {
    if (!a && !b) return null
    if (!a) return b
    if (!b) return a
    const ta = new Date(a).getTime()
    const tb = new Date(b).getTime()
    if (!Number.isFinite(ta)) return b
    if (!Number.isFinite(tb)) return a
    return ta >= tb ? a : b
  }

  // 1) guest grant
  let guestGrant = await findGrantByDevice(sb, deviceHash)
  if (!guestGrant) {
    const created = await createGrant(sb, { userId: null, deviceHash, trialLeft: trialDefault, nowIso })
    guestGrant = created ?? (await findGrantByDevice(sb, deviceHash))
  }
  if (!guestGrant) throw new Error("Failed to create guest grant")

  // guest only
  if (!userId) {
    return { grant: guestGrant, scope: "guest", guestGrant }
  }

  // 2) account grant by stable key
  const accountKey = ACCOUNT_PREFIX + userId
  let accountGrant = await findGrantByDevice(sb, accountKey)

  // legacy: if there is any row by user_id with wrong device_hash -> migrate to stable key
  if (!accountGrant) {
    const { data: legacy } = await sb
      .from("access_grants")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (legacy) {
      const migrated = await updateGrant(sb, legacy.id, { device_hash: accountKey, updated_at: nowIso })
      accountGrant = migrated ?? (await findGrantByDevice(sb, accountKey))
    }
  }

  if (!accountGrant) {
    const created = await createGrant(sb, { userId, deviceHash: accountKey, trialLeft: trialDefault, nowIso })
    accountGrant = created ?? (await findGrantByDevice(sb, accountKey))
  }
  if (!accountGrant) throw new Error("Failed to create account grant")

  // 3) never increase trial after login
  const gLeft = clampTrial(guestGrant.trial_questions_left ?? trialDefault, trialDefault)
  const aLeft = clampTrial(accountGrant.trial_questions_left ?? trialDefault, trialDefault)
  const eff = Math.min(gLeft, aLeft)

  if (gLeft !== eff) {
    guestGrant = (await updateGrant(sb, guestGrant.id, { trial_questions_left: eff, updated_at: nowIso })) ?? guestGrant
  }
  if (aLeft !== eff) {
    accountGrant = (await updateGrant(sb, accountGrant.id, { trial_questions_left: eff, updated_at: nowIso })) ?? accountGrant
  }

  // 4) merge paid/promo from both (take later)
  const paidUntil = laterDate(guestGrant?.paid_until ?? null, accountGrant?.paid_until ?? null)
  const promoUntil = laterDate(guestGrant?.promo_until ?? null, accountGrant?.promo_until ?? null)

  const grant = { ...accountGrant, paid_until: paidUntil, promo_until: promoUntil }

  return { grant, scope: "account", guestGrant }
}
`

function patchFile(file) {
  const src = fs.readFileSync(file, "utf8")
  const idx = src.indexOf("async function ensureGrant(")
  if (idx < 0) throw new Error(`ensureGrant not found in ${file}`)

  const idxExport = src.indexOf("\nexport async function", idx)
  if (idxExport < 0) throw new Error(`export async function not found after ensureGrant in ${file}`)

  const before = src.slice(0, idx)
  const after = src.slice(idxExport) // keep export handler and below

  const out = before + NEW_BLOCK + "\n" + after
  fs.writeFileSync(file, out, "utf8")
  console.log(`[OK] cleaned ensureGrant block in ${file}`)
}

for (const f of files) patchFile(f)
