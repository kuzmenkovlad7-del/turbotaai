import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function stripQuotes(v: any) {
  if (!v) return v
  v = String(v).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1)
  return v
}

async function tableCount(sb: any, table: string) {
  const { count, error } = await sb.from(table).select("*", { count: "exact", head: true })
  if (error) throw new Error(`${table}: ${error.message}`)
  return count ?? 0
}

async function pickFilterColumn(sb: any, table: string) {
  const { data, error } = await sb.from(table).select("*").limit(1)
  if (error) throw new Error(`${table}: ${error.message}`)
  const cols = data?.[0] ? Object.keys(data[0]) : []
  const preferred = ["id", "uuid", "created_at", "updated_at", "user_id", "device_hash", "email"]
  return preferred.find((c) => cols.includes(c)) || cols[0] || null
}

async function wipeTable(sb: any, table: string) {
  const cnt = await tableCount(sb, table)
  if (cnt === 0) return { table, deleted: 0, skipped: true }

  const col = await pickFilterColumn(sb, table)
  if (!col) return { table, deleted: 0, skipped: true }

  // PostgREST требует фильтр -> удаляем всё через "col is not null"
  const { error } = await sb.from(table).delete().not(col, "is", null)
  if (error) throw new Error(`${table}: ${error.message}`)

  return { table, deleted: "ALL", used_filter: `${col} IS NOT NULL`, before_count: cnt }
}

/**
 * DEV ONLY
 * POST /api/dev/reset?key=DEV_RESET_KEY&scope=grants|all
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN_IN_PROD" }, { status: 403 })
  }

  const url = stripQuotes(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const serviceKey = stripQuotes(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const devKey = stripQuotes(process.env.DEV_RESET_KEY)

  if (!url || !serviceKey || !devKey) {
    return NextResponse.json(
      { ok: false, error: "Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DEV_RESET_KEY" },
      { status: 500 }
    )
  }

  const key = req.nextUrl.searchParams.get("key") || ""
  if (key !== devKey) {
    return NextResponse.json({ ok: false, error: "BAD_KEY" }, { status: 401 })
  }

  const scope = (req.nextUrl.searchParams.get("scope") || "grants").toLowerCase()

  const sb = createClient(url, serviceKey, { auth: { persistSession: false } })

  try {
    const tables =
      scope === "grants"
        ? ["access_grants"]
        : scope === "all"
        ? ["access_grants", "messages", "conversations", "billing_orders"]
        : null

    if (!tables) return NextResponse.json({ ok: false, error: "UNKNOWN_SCOPE", scope }, { status: 400 })

    const results: any[] = []
    for (const t of tables) results.push(await wipeTable(sb, t))

    return NextResponse.json({ ok: true, scope, results }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
