"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useLanguage } from "@/lib/i18n/language-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Summary = {
  email?: string | null
  trialLeft?: number | null
  access?: "Paid" | "Promo" | "Limited" | string | null
  paidUntil?: string | null
  promoUntil?: string | null
  isLoggedIn?: boolean
}

function safeDate(v: any): string | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  // YYYY-MM-DD
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export default function ProfilePage() {
  const { t } = useLanguage()
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    let alive = true
    fetch("/api/account/summary", { cache: "no-store", credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        setSummary(d || {})
      })
      .catch(() => setSummary({}))
    return () => {
      alive = false
    }
  }, [])

  const email = summary?.email ? String(summary.email) : t("Guest")
  const trialLeft = typeof summary?.trialLeft === "number" ? summary!.trialLeft! : null

  const accessLabel = useMemo(() => {
    const a = summary?.access
    if (a === "Paid") return t("Unlimited")
    if (a === "Promo") return t("Promo code")
    if (trialLeft !== null) return t("Trial")
    return t("Limited")
  }, [summary?.access, trialLeft, t])

  const paidUntil = safeDate(summary?.paidUntil)
  const promoUntil = safeDate(summary?.promoUntil)

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-10 xl:px-16">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900">{t("Profile")}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/pricing">
            <Button variant="outline" className="rounded-full">
              {t("Pricing")}
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="rounded-full">
              {t("Sign In")}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{t("Account")}</CardTitle>
            <CardDescription>{t("Login status and access")}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t("Email")}:</span>
              <span className="font-medium">{email}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t("Access")}:</span>
              <span className="font-medium">{accessLabel}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t("Trial left")}:</span>
              <span className="font-medium">{trialLeft !== null ? String(trialLeft) : "—"}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t("Paid until")}:</span>
              <span className="font-medium">{paidUntil || t("Not active")}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t("Promo until")}:</span>
              <span className="font-medium">{promoUntil || t("Not active")}</span>
            </div>

            <div className="pt-4">
              <Link href="/subscription">
                <Button variant="outline" className="w-full rounded-full">
                  {t("Manage subscription")}
                </Button>
              </Link>
              <p className="mt-2 text-xs text-slate-500">{t("Login to unlock saved sessions and promo.")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{t("History")}</CardTitle>
            <CardDescription>{t("Saved sessions")}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-700">
            <div className="text-slate-600">{t("Login to see history.")}</div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
