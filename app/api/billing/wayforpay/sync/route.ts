import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

function hmacMd5(str: string, secret: string) {
  return crypto.createHmac("md5", secret).update(str, "utf8").digest("hex")
}

export async function GET(req: NextRequest) {
  const orderReference = req.nextUrl.searchParams.get("orderReference")?.trim() || ""

  if (!orderReference) {
    return NextResponse.json({ ok: false, message: "orderReference is required" }, { status: 200 })
  }

  const merchantAccount =
    process.env.WAYFORPAY_MERCHANT_ACCOUNT ||
    process.env.WFP_MERCHANT_ACCOUNT ||
    process.env.WAYFORPAY_ACCOUNT

  const secretKey =
    process.env.WAYFORPAY_SECRET_KEY ||
    process.env.WFP_SECRET_KEY ||
    process.env.WAYFORPAY_SECRET

  if (!merchantAccount || !secretKey) {
    return NextResponse.json({ ok: false, message: "WayForPay env is missing" }, { status: 200 })
  }

  // CHECK_STATUS signature: merchantAccount;orderReference (HMAC_MD5)
  const signStr = [merchantAccount, orderReference].join(";")
  const merchantSignature = hmacMd5(signStr, secretKey)

  const body = {
    transactionType: "CHECK_STATUS",
    merchantAccount,
    orderReference,
    merchantSignature,
    apiVersion: 1,
  }

  const r = await fetch("https://api.wayforpay.com/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  }).catch(() => null)

  const json: any = await r?.json().catch(() => null)

  const status = String(json?.transactionStatus ?? json?.status ?? "")

  if (!status) {
    return NextResponse.json({ ok: false, message: "No status from WayForPay" }, { status: 200 })
  }

  if (status === "Approved") {
    return NextResponse.json({ ok: true, status }, { status: 200 })
  }

  return NextResponse.json({ ok: false, status, message: `Статус: ${status}` }, { status: 200 })
}
