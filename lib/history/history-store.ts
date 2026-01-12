import { getSupabaseServerClient, isSupabaseServerConfigured } from "@/lib/supabase-server"

const WINDOW_MS = 30 * 60 * 1000

function toIsoNow() {
  return new Date().toISOString()
}

export async function getOrCreateConversationId(args: {
  deviceHash: string
  mode: string
  title?: string | null
  userEmail?: string | null
}): Promise<string | null> {
  if (!isSupabaseServerConfigured()) return null
  if (!args.deviceHash) return null

  const supabase = getSupabaseServerClient()

  const { data: last, error: lastErr } = await supabase
    .from("conversations")
    .select("id,created_at,updated_at")
    .eq("device_hash", args.deviceHash)
    .eq("mode", args.mode)
    .order("updated_at", { ascending: false })
    .limit(1)

  if (lastErr) throw lastErr

  const row = (last && last[0]) as any
  const ts = row?.updated_at || row?.created_at
  if (row?.id && ts) {
    const t = Date.parse(ts)
    if (Number.isFinite(t) && Date.now() - t <= WINDOW_MS) {
      await supabase
        .from("conversations")
        .update({ updated_at: toIsoNow() })
        .eq("id", row.id)
      return row.id as string
    }
  }

  const { data: created, error: insErr } = await supabase
    .from("conversations")
    .insert({
      device_hash: args.deviceHash,
      mode: args.mode,
      title: args.title ?? null,
      user_email: args.userEmail ?? null,
      updated_at: toIsoNow(),
    })
    .select("id")
    .single()

  if (insErr) throw insErr
  return (created as any)?.id ?? null
}

export async function appendMessage(args: {
  conversationId: string
  role: string
  text: string
}) {
  if (!isSupabaseServerConfigured()) return
  const supabase = getSupabaseServerClient()

  await supabase.from("messages").insert({
    conversation_id: args.conversationId,
    role: args.role,
    text: args.text,
  })

  await supabase
    .from("conversations")
    .update({ updated_at: toIsoNow() })
    .eq("id", args.conversationId)
}
