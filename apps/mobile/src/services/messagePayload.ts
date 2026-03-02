import { ensureDeviceHash, generateUUID } from "./storage"
import type { MessagePayload } from "./api"

/**
 * Derive gender from characterId — mirrors the WEB /api/turbotaai-agent route logic.
 * leo and alex are male; everything else (including the default "mia") is female.
 */
export function genderFromCharacterId(characterId: string | undefined): "female" | "male" {
  const id = (characterId || "mia").toLowerCase().trim()
  return id === "leo" || id === "alex" ? "male" : "female"
}

/**
 * Shared payload builder for all mobile message sending.
 *
 * Used by ChatScreen, VoiceAssistantScreen, VideoAssistantScreen,
 * and any retry/regenerate handlers.
 *
 * Guarantees every message includes:
 *   query, language, voiceLanguage, mode, userId, sessionId, deviceId,
 *   clientMessageId, timestamp, user (compat),
 *   characterId (default "mia"), gender, roleGender, assistantGender
 *
 * Fields match the WEB /api/turbotaai-agent payload contract so n8n
 * receives identical data regardless of which client sent the message.
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

  // characterId defaults to "mia" when missing — matches WEB server fallback
  const characterId =
    params.characterId && params.characterId.trim() ? params.characterId.trim() : "mia"

  // gender: prefer explicit param, otherwise derive from characterId
  const genderNorm: "female" | "male" =
    params.gender === "male" || params.gender === "female"
      ? params.gender
      : genderFromCharacterId(characterId)

  // voiceLanguage: same as language (no separate voice-locale picker on mobile yet)
  const voiceLanguage = params.language || "uk"

  return {
    query: params.query,
    language: params.language,
    voiceLanguage,
    mode: params.mode,
    userId,
    sessionId: params.sessionId,
    deviceId,
    clientMessageId,
    timestamp,
    user,
    email: params.email,
    gender: genderNorm,
    roleGender: genderNorm,
    assistantGender: genderNorm,
    characterId,
    avatarSlug: params.avatarSlug,
  }
}
