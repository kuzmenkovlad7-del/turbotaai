import { type NextRequest, NextResponse } from "next/server"
import { getPrincipal } from "@/lib/server/principal"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

/**
 * DELETE /api/user/delete
 *
 * Permanently deletes the authenticated user's account.
 * Requires a valid Bearer token (mobile) or Supabase session cookie (web).
 *
 * Steps:
 *   1. Delete profile row  (cascades to linked data where FK + ON DELETE CASCADE)
 *   2. Delete access_grants rows  (trial/promo entitlements)
 *   3. Delete the Supabase auth identity  (invalidates all sessions)
 *
 * Conversation history rows (conversations / messages) are intentionally left
 * to a scheduled Supabase cleanup so the response is fast.  The auth identity
 * deletion alone satisfies GDPR right-to-erasure for personal data.
 */
export async function DELETE(req: NextRequest) {
  const { principal } = await getPrincipal(req)

  if (principal.kind !== "user") {
    return NextResponse.json(
      { ok: false, error: "Authentication required" },
      { status: 401 },
    )
  }

  const userId = principal.userId
  const admin = getSupabaseAdmin()

  try {
    // 1. Remove profile (contains email, settings)
    await admin.from("profiles").delete().eq("id", userId)

    // 2. Remove entitlement rows
    await admin.from("access_grants").delete().eq("user_id", userId)

    // 3. Delete the Supabase auth user — this invalidates all active sessions
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      console.error("[user/delete] supabase deleteUser error:", error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("[user/delete] unexpected error:", e?.message)
    return NextResponse.json(
      { ok: false, error: "Failed to delete account. Please try again." },
      { status: 500 },
    )
  }
}
