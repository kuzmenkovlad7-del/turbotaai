import { getSupabaseAdmin } from "@/lib/supabase/admin"

export async function upsertConversation(args: {
  conversationId: string
  mode: string
  userId?: string | null
  deviceHash?: string | null
}) {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  await supabase.from("conversations").upsert(
    {
      id: args.conversationId,
      mode: args.mode,
      user_id: args.userId ?? null,
      device_hash: args.deviceHash ?? null,
      updated_at: now,
    },
    { onConflict: "id" },
  )
}

export async function saveMessage(args: {
  conversationId: string
  role: "user" | "assistant" | "system"
  text: string
  userId?: string | null
}) {
  const supabase = getSupabaseAdmin()
  await supabase.from("messages").insert({
    conversation_id: args.conversationId,
    role: args.role,
    text: args.text,
    user_id: args.userId ?? null,
  })
}
