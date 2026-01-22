"use client"

import {
  MERCHANT_LEGAL_NAME,
  MERCHANT_IPN,
  MERCHANT_LEGAL_ADDRESS,
  MERCHANT_ACTUAL_ADDRESS,
  MERCHANT_PHONE,
  MERCHANT_EMAIL,
} from "@/lib/merchant-address"
import { useLanguage } from "@/lib/i18n/language-context"

function Val({ v }: { v: string | null | undefined }) {
  return <span className="text-slate-900">{v && v.trim() ? v : "—"}</span>
}

export default function MerchantDetails() {
  const { t } = useLanguage()

  const rows = [
    { label: t("merchant.fullName"), value: MERCHANT_LEGAL_NAME },
    { label: t("merchant.ipn"), value: MERCHANT_IPN },
    { label: t("merchant.legalAddress"), value: MERCHANT_LEGAL_ADDRESS },
    { label: t("merchant.actualAddress"), value: MERCHANT_ACTUAL_ADDRESS },
    { label: t("merchant.phone"), value: MERCHANT_PHONE },
    { label: t("merchant.email"), value: MERCHANT_EMAIL },
  ]

  return (
    <div className="rounded-[28px] bg-white/95 backdrop-blur-xl border border-slate-200/80 p-6 md:p-8">
      <h1 className="text-lg md:text-xl font-semibold text-slate-900">
        {t("merchant.title")}
      </h1>

      <div className="mt-4 divide-y divide-slate-200">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-2 gap-4 py-4">
            <div className="text-slate-500">{r.label}</div>
            <div className="text-right">
              <Val v={r.value} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
