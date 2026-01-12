import crypto from "crypto"
import { NextRequest } from "next/server"

export function conversationCookieName(mode: string) {
  const m = (mode || "chat").toLowerCase()
  return `turbota_cid_${m}`
}

export function getOrCreateConversationId(req: NextRequest, mode: string) {
  const name = conversationCookieName(mode)
  const existing = req.cookies.get(name)?.value?.trim()
  if (existing) return { id: existing, setCookie: null as any }
  const id = crypto.randomUUID()
  return { id, setCookie: { name, value: id, maxAge: 60 * 60 * 24 * 30 } } // 30 дней
}
