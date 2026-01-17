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

async function headInfo(sb, table) {
  // count
  const { count, error: e1 } = await sb.from(table).select("*", { count: "exact", head: true })
  if (e1) return { table, ok: false, error: e1.message }
  if (!count || count === 0) return { table, ok: true, count: 0, columns: [] }

  // one row sample
  const { data, error: e2 } = await sb.from(table).select("*").limit(1)
  if (e2) return { table, ok: false, error: e2.message }

  const cols = data?.[0] ? Object.keys(data[0]) : []
  return { table, ok: true, count, columns: cols }
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

  const tables = ["access_grants", "messages", "conversations", "billing_orders", "profiles"]
  const out = []
  for (const t of tables) out.push(await headInfo(sb, t))

  console.log(JSON.stringify({ ok: true, tables: out }, null, 2))
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e?.message || e) }, null, 2))
  process.exit(1)
})
