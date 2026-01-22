"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/lib/i18n/language-context"
import { MERCHANT_LEGAL_ADDRESS, MERCHANT_ACTUAL_ADDRESS } from "@/lib/merchant-address"


function getPublicMerchantInfo() {
  return {
    legalName: process.env.NEXT_PUBLIC_MERCHANT_LEGAL_NAME || "",
    ipn: process.env.NEXT_PUBLIC_MERCHANT_IPN || "",
    legalAddress: process.env.NEXT_PUBLIC_MERCHANT_LEGAL_ADDRESS || "",
    actualAddress: process.env.NEXT_PUBLIC_MERCHANT_ACTUAL_ADDRESS || "",
    phone: process.env.NEXT_PUBLIC_MERCHANT_PHONE || "",
    email: process.env.NEXT_PUBLIC_MERCHANT_EMAIL || "",
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border/60 py-2 last:border-b-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-right break-words max-w-[60%]">
        {value || "—"}
      </div>
    </div>
  )
}

export function MerchantDetailsCard() {
  const { t } = useLanguage()
  const info = getPublicMerchantInfo()

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("Company contact information")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-1">
          <Row label={t("Legal name")} value={info.legalName} />
          <Row label={t("Tax ID")} value={info.ipn} />
          <Row label={t("Legal address")} value={info.legalAddress || MERCHANT_LEGAL_ADDRESS} />
          <Row label={t("Actual address")} value={info.actualAddress || MERCHANT_ACTUAL_ADDRESS} />
          <Row label={t("Phone")} value={info.phone} />
          <Row label={t("Email")} value={info.email} />
        </div>
      </CardContent>
    </Card>
  )
}
