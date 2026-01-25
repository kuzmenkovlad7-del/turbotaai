import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Этот роут оставляем только как совместимость, если где-то returnUrl ещё указывает сюда.
// Он НЕ должен чистить сессию и НЕ должен менять auth.
// Просто переводим на /payment/result.
export async function GET(req: NextRequest) {
  const src = new URL(req.url)
  const dst = new URL("/payment/result", src.origin)

  // перенесём самые важные поля
  const keys = ["orderReference", "status", "planId"]
  for (const k of keys) {
    const v = src.searchParams.get(k)
    if (v) dst.searchParams.set(k, v)
  }

  return NextResponse.redirect(dst.toString(), { status: 302 })
}

// Иногда платёжки возвращают POST на returnUrl. Мы тоже редиректим.
export async function POST(req: NextRequest) {
  const src = new URL(req.url)
  const dst = new URL("/payment/result", src.origin)
  return NextResponse.redirect(dst.toString(), { status: 302 })
}
