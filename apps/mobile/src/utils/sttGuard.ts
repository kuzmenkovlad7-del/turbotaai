/**
 * sttGuard — shared STT transcript validation for voice/video sessions.
 *
 * Ported from the web voice-call-dialog.tsx (isMostlyGarbage) to give mobile
 * parity.  Filters two categories of bad transcripts before they reach the
 * agent:
 *
 *  1. Low-signal audio — silence, background noise, or mic hiss that Whisper
 *     transcribes as a short or punctuation-heavy string.
 *  2. Whisper hallucinations — well-known phantom phrases the model produces
 *     when fed near-silence, music, or TV audio in Russian/Ukrainian/English.
 */

/** Common Whisper hallucination phrases — produced from silence or ambient noise */
const JUNK_PHRASES_SUB: readonly string[] = [
  // Russian/Ukrainian hallucinations from silence
  "продолжение следует",
  "подпишитесь на канал",
  "спасибо за просмотр",
  "поставьте лайк",
  "бесплатная подписка",
  "нажмите на колокольчик",
  "переходите по ссылке",
  "зверніть увагу",
  "дивіться на екран",
  // English hallucinations
  "like and subscribe",
  "subscribe to the channel",
  "thanks for watching",
  "click the bell",
]

/**
 * Returns true when the STT transcript should be discarded without sending
 * to the agent.  Mirrors the web isMostlyGarbage() logic.
 */
export function isMostlyGarbage(text: string): boolean {
  const t = (text || "").trim()
  if (!t) return true

  // Normalise: lowercase + strip common punctuation
  const norm = t
    .toLowerCase()
    .replace(/[.,!?;:«»"""''…\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (norm.length < 3) return true

  // Low letter ratio → likely noise / punctuation garbage
  const letters = (t.match(/[A-Za-zА-Яа-яЇїІіЄєҐґ]/g) || []).length
  if (t.length > 0 && letters / t.length < 0.45) return true

  // Known Whisper hallucination phrases
  for (const phrase of JUNK_PHRASES_SUB) {
    if (norm.includes(phrase)) return true
  }

  return false
}
