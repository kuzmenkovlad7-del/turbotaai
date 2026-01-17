import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"

function stripQuotes(v) {
  if (!v) return v
  v = String(v).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1)
  return v
}

function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(p)) throw new Error("NO_.env.local")
  const raw = fs.readFileSync(p, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const s = line.trim()
    if (!s || s.startsWith("#")) continue
    const i = s.indexOf("=")
    if (i <= 0) continue
    const k = s.slice(0, i).trim()
    const v = stripQuotes(s.slice(i + 1).trim())
    if (!process.env[k]) process.env[k] = v
  }
}

async function tableCount(sb, table) {
  const { count, error } = await sb.from(table).select("*", { count: "exact", head: true })
  if (error) throw new Error(`${table}: ${error.message}`)
  return count ?? 0
}

async function pickFilterColumn(sb, table) {
  const { data, error } = await sb.from(table).select("*").limit(1)
  if (error) throw new Error(`${table}: ${error.message}`)
  const cols = data?.[0] ? Object.keys(data[0]) : []

  const preferred = ["id", "uuid", "created_at", "updated_at", "user_id", "device_hash", "email"]
  const col = preferred.find((c) => cols.includes(c)) || cols[0] || null
  return col
}

async function wipeTable(sb, table) {
  const cnt = await tableCount(sb, table)
  if (cnt === 0) return { table, deleted: 0, skipped: true }

  const col = await pickFilterColumn(sb, table)
  if (!col) return { table, deleted: 0, skipped: true }

  // PostgREST требует фильтр -> удаляем всё через "col is not null"
  const { error } = await sb.from(table).delete().not(col, "is", null)
  if (error) throw new Error(`${table}: ${error.message}`)

  return { table, deleted: "ALL", used_filter: `${col} IS NOT NULL`, before_count: cnt }
}

async function main() {
  const scope = (process.argv[2] || "grants").toLowerCase()

  loadEnvLocal()

  const url = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const serviceKey = stripQuotes(process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (!url || !serviceKey) {
    console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } })

  const tables =
    scope === "grants"
      ? ["access_grants"]
      : scope === "all"
      ? ["access_grants", "messages", "conversations", "billing_orders"]
      : null

  if (!tables) {
    console.error("Unknown scope. Use: grants | all")
    process.exit(1)
  }

  const results = []
  for (const t of tables) results.push(await wipeTable(sb, t))

  console.log(JSON.stringify({ ok: true, scope, results }, null, 2))
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e?.message || e) }, null, 2))
  process.exit(1)
})
