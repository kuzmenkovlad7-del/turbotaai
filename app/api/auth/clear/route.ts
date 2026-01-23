import { NextResponse } from "next/server"
import { cookies } from "next/headers"

/**
 * POST /api/auth/clear
 * - soft (default): does NOT clear cookies (prevents auto logout on 401)
 * - hard: clears auth cookies (real logout)
 *
 * Example:
 *  - POST /api/auth/clear?scope=hard  -> logout
 *  - POST /api/auth/clear            -> no-op (safe)
 */
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = (searchParams.get("scope") || "soft").toLowerCase()

    if (scope !== "hard") {
      return NextResponse.json({ ok: true, scope: "soft" })
    }

    const store = cookies()
    const all = store.getAll()

    // чистим ВСЕ supabase/auth cookies + наши возможные cookies
    for (const c of all) {
      const name = c.name

      const shouldClear =
        name === "sb-access-token" ||
        name === "sb-refresh-token" ||
        name.startsWith("sb-") ||
        name.includes("supabase") ||
        name.includes("auth-token") ||
        name.includes("access-token") ||
        name.includes("refresh-token") ||
        name.includes("turbotaai") ||
        name.includes("session")

      if (!shouldClear) continue

      try {
        store.set({
          name,
          value: "",
          path: "/",
          expires: new Date(0),
        })
      } catch {}
    }

    return NextResponse.json({ ok: true, scope: "hard" })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "clear failed" }, { status: 500 })
  }
}
