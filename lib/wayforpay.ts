import crypto from "crypto"

function hmacMd5(secret: string, s: string) {
  return crypto.createHmac("md5", secret).update(s, "utf8").digest("hex")
}

/**
 * Create Invoice signature:
 * merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;productName...;productCount...;productPrice...
 */
export function makeCreateInvoiceSignature(secret: string, params: {
  merchantAccount: string
  merchantDomainName: string
  orderReference: string
  orderDate: number
  amount: number | string
  currency: string
  productName: string[]
  productCount: Array<number | string>
  productPrice: Array<number | string>
}) {
  const parts = [
    params.merchantAccount,
    params.merchantDomainName,
    params.orderReference,
    params.orderDate,
    params.amount,
    params.currency,
    ...params.productName,
    ...params.productCount,
    ...params.productPrice,
  ].map(String)

  return hmacMd5(secret, parts.join(";"))
}

/**
 * serviceUrl webhook signature:
 * merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode
 */
export function makeServiceWebhookSignature(secret: string, payload: any) {
  const parts = [
    payload?.merchantAccount ?? "",
    payload?.orderReference ?? "",
    payload?.amount ?? "",
    payload?.currency ?? "",
    payload?.authCode ?? "",
    payload?.cardPan ?? "",
    payload?.transactionStatus ?? "",
    payload?.reasonCode ?? "",
  ].map(String)

  return hmacMd5(secret, parts.join(";"))
}

/**
 * Merchant response signature:
 * orderReference;status;time
 */
export function makeServiceResponseSignature(secret: string, orderReference: string, status: string, time: number) {
  return hmacMd5(secret, [orderReference, status, time].join(";"))
}
