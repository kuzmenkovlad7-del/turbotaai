let unlocked = false
let ctx: AudioContext | null = null

export async function ensureAudioUnlocked() {
  if (unlocked) return
  if (typeof window === "undefined") return

  try {
    const AC: any =
      (window as any).AudioContext || (window as any).webkitAudioContext
    if (AC) {
      if (!ctx) ctx = new AC()
      if (ctx.state === "suspended") await ctx.resume()

      // 1-sample silent buffer: часто достаточно для iOS Safari
      const buffer = ctx.createBuffer(1, 1, 22050)
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.connect(ctx.destination)
      src.start(0)
    }
  } catch {}

  // Подстраховка через HTMLAudioElement (на некоторых сборках Safari помогает)
  try {
    const a = new Audio()
    a.src =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA="
    ;(a as any).playsInline = true
    await a.play().catch(() => {})
    a.pause()
  } catch {}

  unlocked = true
}

export function resetAudioUnlock() {
  unlocked = false
  ctx = null
}
