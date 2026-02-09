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
}): Promise<MessagePayload> {
  const deviceId = await ensureDeviceHash()
  const clientMessageId = generateUUID()
  const timestamp = new Date().toISOString()
  const user = params.userId ?? `guest:${params.sessionId}`

  return {
    query: params.query,
    language: params.language,
    mode: params.mode,
    userId: params.userId,
    sessionId: params.sessionId,
    deviceId,
    clientMessageId,
    timestamp,
    user,
    email: params.email,
  }
}
