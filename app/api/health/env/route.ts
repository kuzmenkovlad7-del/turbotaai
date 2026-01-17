import { NextResponse } from "next/server"

function has(name: string) {
  const v = process.env[name]
  return Boolean(v && String(v).trim().length > 0)
}

export async function GET() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]

  const wayforpayRequired = [
    "WAYFORPAY_MERCHANT_ACCOUNT",
    "WAYFORPAY_SECRET_KEY",
  ]

  const optional = [
    "WAYFORPAY_MERCHANT_DOMAIN_NAME",
    "WAYFORPAY_MERCHANT_DOMAIN",
    "WAYFORPAY_WEBHOOK_URL",
    "WAYFORPAY_RETURN_URL",
    "WAYFORPAY_TEST_AMOUNT_UAH",
  ]

  const missingRequired = required.filter((x) => !has(x))
  const missingWayforpay = wayforpayRequired.filter((x) => !has(x))

  return NextResponse.json({
    ok: missingRequired.length === 0 && missingWayforpay.length === 0,
    required: required.map((x) => ({ name: x, ok: has(x) })),
    wayforpay: wayforpayRequired.map((x) => ({ name: x, ok: has(x) })),
    optional: optional.map((x) => ({ name: x, ok: has(x) })),
  })
}
