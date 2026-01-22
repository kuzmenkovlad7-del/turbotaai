"use client"

import { useEffect, useState } from "react"
import { useLanguage } from "@/lib/i18n/language-context"
import { usePathname, useSearchParams } from "next/navigation"

export function PaywallToast() {
  const { t } = useLanguage()

  const pathname = usePathname()
  const sp = useSearchParams()
  const paywall = sp?.get("paywall")

  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (pathname !== "/pricing") return

    let shouldOpen = false
    if (paywall === "trial") shouldOpen = true

    try {
      if (sessionStorage.getItem("turbota_paywall") === "trial") shouldOpen = true
    } catch {}

    if (shouldOpen) {
      setOpen(true)
      try {
        sessionStorage.removeItem("turbota_paywall")
      } catch {}
    }
  }, [pathname, paywall])

  if (!open) return null

  return (
    <div className="fixed right-4 top-4 z-[9999] w-[360px] rounded-2xl border bg-white p-4 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{t("Free trial is over")}</div>
          <div className="mt-1 text-sm text-slate-600">
            {t("You used all free questions. Subscribe to continue.")}
          </div>
        </div>
        <button
          className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          onClick={() => setOpen(false)}
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <a
          href="/pricing"
          className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white"
        >
          Open pricing
        </a>
        <button
          className="rounded-xl border px-3 py-2 text-sm font-semibold"
          onClick={() => setOpen(false)}
        >
          Later
        </button>
      </div>
    </div>
  )
}
