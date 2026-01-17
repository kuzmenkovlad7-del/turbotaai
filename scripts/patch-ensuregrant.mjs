import fs from "fs"

const files = [
  "app/api/turbotaai-agent/route.ts",
  "app/api/account/summary/route.ts",
]

const NEW_FN = `
async function ensureGrant(sb: any, deviceHash: string, userId: string | null, trialDefault: number, nowIso: string) {
  const ACCOUNT_PREFIX = "account:"
  const clamp = (v: any) => {
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) return trialDefault
    if (n > trialDefault) return trialDefault
    return n
  }

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

  const byDevice = async (hash: string) => {
    const { data, error } = await sb
      .from("access_grants")
      .select("*")
      .eq("device_hash", hash)
      .order("created_at", { ascending: false })
      .limit(1)
    if (error) throw new Error(error.message)
    return data?.[0] ?? null
  }

  const byUser = async (uid: string) => {
    const { data, error } = await sb
      .from("access_grants")
      .select("*")
      .eq("user_id", uid)
      .order("updated_at", { ascending: false })
      .limit(1)
    if (error) throw new Error(error.message)
    return data?.[0] ?? null
  }

  const insertGrant = async (payload: any) => {
    const { data, error } = await sb.from("access_grants").insert(payload).select("*").single()
    if (error) throw new Error(error.message)
    return data
  }

  const updateGrant = async (id: string, patch: any) => {
    const { data, error } = await sb.from("access_grants").update(patch).eq("id", id).select("*").single()
    if (error) throw new Error(error.message)
    return data
  }

  // guest grant (device uuid cookie)
  let guestGrant = await byDevice(deviceHash)
  if (!guestGrant) {
    guestGrant = await insertGrant({
      user_id: null,
      device_hash: deviceHash,
      trial_questions_left: trialDefault,
      paid_until: null,
      promo_until: null,
      created_at: nowIso,
      updated_at: nowIso,
    })
  }

  // account grant (stable key)
  let accountGrant: any = null
  if (userId) {
    const accountKey = ACCOUNT_PREFIX + userId

    accountGrant = await byDevice(accountKey)

    // legacy: any row by user_id -> migrate to stable key
    if (!accountGrant) {
      const legacy = await byUser(userId)
      if (legacy) {
        accountGrant = await updateGrant(legacy.id, { device_hash: accountKey, updated_at: nowIso })
      }
    }

    if (!accountGrant) {
      accountGrant = await insertGrant({
        user_id: userId,
        device_hash: accountKey,
        trial_questions_left: trialDefault,
        paid_until: null,
        promo_until: null,
        created_at: nowIso,
        updated_at: nowIso,
      })
    }

    // NEVER allow trial to increase after login => MIN(guest, account)
    const gLeft = clamp(guestGrant.trial_questions_left)
    const aLeft = clamp(accountGrant.trial_questions_left)
    const eff = Math.min(gLeft, aLeft)

    if (gLeft !== eff) guestGrant = await updateGrant(guestGrant.id, { trial_questions_left: eff, updated_at: nowIso })
    if (aLeft !== eff) accountGrant = await updateGrant(accountGrant.id, { trial_questions_left: eff, updated_at: nowIso })
  }

  const scope = userId ? "account" : "guest"
  const active = scope === "account" ? accountGrant : guestGrant

  // paid/promo take later from both
  const paidUntil = laterDate(guestGrant?.paid_until ?? null, accountGrant?.paid_until ?? null)
  const promoUntil = laterDate(guestGrant?.promo_until ?? null, accountGrant?.promo_until ?? null)

  const grant = active ? { ...active, paid_until: paidUntil, promo_until: promoUntil } : null

  return { grant, scope, guestGrant }
}
`

function replaceEnsureGrant(file) {
  const src = fs.readFileSync(file, "utf8")
  const idx = src.indexOf("async function ensureGrant(")
  if (idx < 0) {
    console.log(`[SKIP] ensureGrant not found in ${file}`)
    return
  }

  const braceStart = src.indexOf("{", idx)
  if (braceStart < 0) throw new Error(`Cannot find function body in ${file}`)

  let depth = 0
  let end = -1
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i]
    if (ch === "{") depth++
    if (ch === "}") {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end < 0) throw new Error(`Cannot match braces in ${file}`)

  const before = src.slice(0, idx)
  const after = src.slice(end + 1)
  const out = before + NEW_FN + after

  fs.writeFileSync(file, out, "utf8")
  console.log(`[OK] patched ensureGrant in ${file}`)
}

for (const f of files) replaceEnsureGrant(f)
