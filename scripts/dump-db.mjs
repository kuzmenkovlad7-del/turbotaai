import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"

function stripQuotes(v) {
  if (!v) return ""
  const s = String(v).trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1)
  return s
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

async function countTable(sb, table) {
  const { count, error } = await sb.from(table).select("*", { count: "exact", head: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true, count: count ?? 0 }
}

async function lastRows(sb, table, limit = 10) {
  // пытаемся order по created_at, если нет - просто limit
  const tryOrder = async (col) => {
    const { data, error } = await sb.from(table).select("*").order(col, { ascending: false }).limit(limit)
    if (error) return null
    return data ?? []
  }

  let data = await tryOrder("created_at")
  if (!data) data = await tryOrder("updated_at")
  if (!data) {
    const { data: raw, error } = await sb.from(table).select("*").limit(limit)
    if (error) return { ok: false, error: error.message }
    data = raw ?? []
  }

  return { ok: true, rows: data }
}

async function main() {
  loadEnvLocal()

  const url = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const serviceKey = stripQuotes(process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (!url || !serviceKey) {
    console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } })

  const tables = ["access_grants", "profiles", "conversations", "messages", "billing_orders"]

  const out = []
  for (const t of tables) {
    const c = await countTable(sb, t)
    const r = await lastRows(sb, t, 10)
    out.push({ table: t, count: c.ok ? c.count : null, count_error: c.ok ? null : c.error, sample: r.ok ? r.rows : [], sample_error: r.ok ? null : r.error })
  }

  console.log(JSON.stringify({ ok: true, tables: out }, null, 2))
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e?.message || e) }, null, 2))
  process.exit(1)
})
