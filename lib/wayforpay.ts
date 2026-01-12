import crypto from "crypto"

export function hmacMd5Hex(secret: string, message: string) {
  return crypto.createHmac("md5", secret).update(message, "utf8").digest("hex")
}

// Signature for CREATE_INVOICE:
// merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;productName...;productCount...;productPrice...
export function signCreateInvoice(args: {
  secret: string
  merchantAccount: string
  merchantDomainName: string
  orderReference: string
  orderDate: number
  amount: number
  currency: string
  productName: string[]
  productCount: number[]
  productPrice: number[]
}) {
  const s = [
    args.merchantAccount,
    args.merchantDomainName,
    args.orderReference,
    String(args.orderDate),
    String(args.amount),
    args.currency,
    ...args.productName,
    ...args.productCount.map(String),
    ...args.productPrice.map(String),
  ].join(";")
  return hmacMd5Hex(args.secret, s)
}

// Callback signature:
// merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode
export function verifyCallbackSignature(args: {
  secret: string
  merchantAccount: string
  orderReference: string
  amount: string
  currency: string
  authCode: string
  cardPan: string
  transactionStatus: string
  reasonCode: string
  merchantSignature: string
}) {
  const s = [
    args.merchantAccount,
    args.orderReference,
    args.amount,
    args.currency,
    args.authCode,
    args.cardPan,
    args.transactionStatus,
    args.reasonCode,
  ].join(";")
  const expected = hmacMd5Hex(args.secret, s)
  return expected === (args.merchantSignature || "")
}

// Accept response signature: orderReference;status;time
export function signAcceptResponse(args: { secret: string; orderReference: string; status: string; time: number }) {
  return hmacMd5Hex(args.secret, [args.orderReference, args.status, String(args.time)].join(";"))
}
