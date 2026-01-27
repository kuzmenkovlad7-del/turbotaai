export function getClientDeviceHash(userId?: string | null) {
  if (typeof window === "undefined") return null

  const key = "ta_device_hash"

  // если юзер залогинен — фиксируем account:<userId>
  if (userId) {
    const v = `account:${userId}`
    try {
      localStorage.setItem(key, v)
    } catch {}
    try {
      document.cookie = `ta_device_hash=${encodeURIComponent(
        v
      )}; Path=/; Max-Age=31536000; SameSite=Lax`
    } catch {}
    return v
  }

  // гость — device:<uuid>
  let v: string | null = null
  try {
    v = localStorage.getItem(key)
  } catch {}

  if (!v) {
    const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now())
    v = `device:${uuid}`
    try {
      localStorage.setItem(key, v)
    } catch {}
  }

  try {
    document.cookie = `ta_device_hash=${encodeURIComponent(
      v
    )}; Path=/; Max-Age=31536000; SameSite=Lax`
  } catch {}

  return v
}
