import { ensureDeviceHash, generateUUID } from "./storage"
import type { MessagePayload } from "./api"

/**
 * Shared payload builder for all mobile message sending.
 *
 * Used by ChatScreen, VoiceAssistantScreen, VideoAssistantScreen,
 * and any retry/regenerate handlers.
 *
 * Guarantees every message includes:
 *   query, language, mode, userId, sessionId, deviceId,
 *   clientMessageId, timestamp, user (compat)
 */
export async function buildMessagePayload(params: {
  query: string
  language: string
  mode: "chat" | "voice" | "video"
  userId: string | null
  sessionId: string
  email?: string
  gender?: string
  characterId?: string
  avatarSlug?: string
}): Promise<MessagePayload> {
  const deviceId = await ensureDeviceHash()
  const clientMessageId = generateUUID()
  const timestamp = new Date().toISOString()

  // Normalize: empty-string userId → null so n8n memory key falls to sessionId
  const userId = params.userId || null
  const user = userId ?? `guest:${params.sessionId}`

  return {
    query: params.query,
    language: params.language,
    mode: params.mode,
    userId,
    sessionId: params.sessionId,
    deviceId,
    clientMessageId,
    timestamp,
    user,
    email: params.email,
    gender: params.gender,
    characterId: params.characterId,
    avatarSlug: params.avatarSlug,
  }
}
