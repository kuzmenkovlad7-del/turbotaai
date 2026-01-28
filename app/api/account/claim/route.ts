import { NextRequest } from "next/server"
import { GET as getSummary } from "../summary/route"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  // claim должен вернуть актуальный summary без редиректов и без localhost
  return getSummary(req)
}
