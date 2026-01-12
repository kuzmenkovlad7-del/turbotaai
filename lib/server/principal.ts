import crypto from "crypto"
import { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

export type Principal =
  | { kind: "user"; userId: string; email: string | null }
  | { kind: "device"; deviceHash: string }

export type PrincipalResult = {
  principal: Principal
  deviceId: string
  deviceHash: string
  setDeviceCookie?: { name: string; value: string; maxAge: number }
}

function sha256hex(s: string) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex")
}

function readBearer(req: NextRequest) {
  const h = req.headers.get("authorization") || ""
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m?.[1]?.trim() || ""
}

export async function getPrincipal(req: NextRequest): Promise<PrincipalResult> {
  const cookieDevice = req.cookies.get("turbota_did")?.value?.trim()
  const deviceId = cookieDevice || crypto.randomUUID()
  const deviceHash = sha256hex(deviceId)

  const token =
    readBearer(req) ||
    req.cookies.get("turbota_at")?.value?.trim() ||
    ""

  if (token) {
    try {
      const supabase = getSupabaseAdmin()
      const { data, error } = await supabase.auth.getUser(token)
      if (!error && data?.user?.id) {
        return {
          principal: {
            kind: "user",
            userId: data.user.id,
            email: data.user.email ?? null,
          },
          deviceId,
          deviceHash,
          setDeviceCookie: cookieDevice
            ? undefined
            : { name: "turbota_did", value: deviceId, maxAge: 60 * 60 * 24 * 365 * 2 },
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    principal: { kind: "device", deviceHash },
    deviceId,
    deviceHash,
    setDeviceCookie: cookieDevice
      ? undefined
      : { name: "turbota_did", value: deviceId, maxAge: 60 * 60 * 24 * 365 * 2 },
  }
}
