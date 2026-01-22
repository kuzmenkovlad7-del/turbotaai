'use client'

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/lib/i18n/language-context";

type SubSummary = {
  ok: boolean
  hasAccess: boolean
  accessUntil: string | null
  paidUntil: string | null
  promoUntil: string | null
  autoRenew: boolean
  subscriptionStatus: string | null
  wfpOrderReference: string | null
}

function fmt(v: string | null) {
  if (!v) return "Not active"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return "Not active"
  return d.toLocaleString()
}

export default function SubscriptionClient() {
  const { t } = useLanguage()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SubSummary | null>(null)
  const [busy, setBusy] = useState<null | "pay" | "cancel" | "resume" | "promo">(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState("")

  async function load() {
    setLoading(true)
    setMsg(null)
    try {
      const r = await fetch("/api/subscription/summary", { cache: "no-store", credentials: "include" })
      const d = await r.json().catch(() => ({} as any))
      setData(d)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function payMonthly() {
    setBusy("pay")
    setMsg(null)
    try {
      // этот URL вернёт HTML form auto-submit на WayForPay
      window.location.href = "/api/billing/wayforpay/purchase?planId=monthly"
    } finally {
      setBusy(null)
    }
  }

  async function cancelAutoRenew() {
    setBusy("cancel")
    setMsg(null)
    try {
      const r = await fetch("/api/billing/wayforpay/regular/suspend", {
        method: "POST",
        credentials: "include",
      })
      const d = await r.json().catch(() => ({} as any))
      if (!r.ok || d?.ok === false) {
        setMsg(d?.error || "Failed to cancel auto-renew")
        return
      }
      setMsg("Auto-renew canceled")
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function resumeAutoRenew() {
    setBusy("resume")
    setMsg(null)
    try {
      const r = await fetch("/api/billing/wayforpay/regular/resume", {
        method: "POST",
        credentials: "include",
      })
      const d = await r.json().catch(() => ({} as any))
      if (!r.ok || d?.ok === false) {
        setMsg(d?.error || "Failed to resume auto-renew")
        return
      }
      setMsg("Auto-renew resumed")
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function redeemPromo() {
    const code = promoCode.trim()
    if (!code) return
    setBusy("promo")
    setMsg(null)
    try {
      const r = await fetch("/api/billing/promo/redeem", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const d = await r.json().catch(() => ({} as any))
      if (!r.ok || d?.ok === false) {
        setMsg(d?.error || "Promo failed")
        return
      }
      setPromoCode("")
      setMsg("Promo applied")
      await load()
    } finally {
      setBusy(null)
    }
  }

  const ok = !!data?.ok
  const autoRenew = !!data?.autoRenew

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-4xl font-semibold">{t("Subscription")}</h1>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="rounded-full border border-slate-200"
            onClick={() => router.push("/profile")}
          >
            Profile
          </Button>
          <Button
            variant="outline"
            className="rounded-full border border-slate-200"
            onClick={() => router.push("/pricing")}
          >
            Pricing
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl">{t("Manage")}</CardTitle>
            <CardDescription>{t("Monthly recurring subscription")}</CardDescription>
          </CardHeader>

          <CardContent className="text-sm text-slate-700">
            {loading ? (
              <div className="text-slate-500">Loading...</div>
            ) : !ok ? (
              <div className="text-slate-500">{t("Please sign in to manage subscription.")}</div>
            ) : (
              <>
                <div className="grid gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">{t("Access until")}</div>
                    <div className="mt-1 text-base font-semibold">{fmt(data?.accessUntil ?? null)}</div>
                    <div className="mt-3 text-xs text-slate-500">{t("Paid until / Promo until")}</div>
                    <div className="mt-1 text-sm text-slate-700">
                      Paid: {fmt(data?.paidUntil ?? null)}<br />
                      Promo: {fmt(data?.promoUntil ?? null)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">{t("Auto-renew")}</div>
                    <div className="mt-1 text-sm">
                      {autoRenew ? "Enabled" : "Disabled"}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Order reference: {data?.wfpOrderReference || "Not set yet"}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  <Button
                    className="w-full rounded-full"
                    disabled={busy !== null}
                    onClick={payMonthly}
                  >
                    {busy === "pay" ? "Redirecting..." : (data?.hasAccess ? "Extend subscription" : "Start subscription")}
                  </Button>

                  {autoRenew ? (
                    <Button
                      variant="outline"
                      className="w-full rounded-full border border-slate-200"
                      disabled={busy !== null}
                      onClick={cancelAutoRenew}
                    >
                      {busy === "cancel" ? "Canceling..." : "Cancel auto-renew"}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full rounded-full border border-slate-200"
                      disabled={busy !== null}
                      onClick={resumeAutoRenew}
                    >
                      {busy === "resume" ? "Resuming..." : "Resume auto-renew"}
                    </Button>
                  )}
                </div>

                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-xs text-slate-500">Promo code</div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder={t("Enter promo code")}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                    />
                    <Button
                      variant="outline"
                      className="rounded-xl border border-slate-200"
                      disabled={busy !== null}
                      onClick={redeemPromo}
                    >
                      {busy === "promo" ? "Applying..." : "Apply"}
                    </Button>
                  </div>
                </div>

                {msg ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    {msg}
                  </div>
                ) : null}

                <div className="pt-3 text-xs text-slate-500">
                  Cancel auto-renew does not remove access immediately. It only stops future recurring charges.
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl">{t("Getting started")}</CardTitle>
            <CardDescription>{t("Production recurring flow")}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-2 text-sm text-slate-700">
            <div>
              <span className="font-medium">Start:</span> first payment creates monthly auto-renew at WayForPay.
            </div>
            <div>
              <span className="font-medium">Auto-renew:</span> WayForPay charges monthly automatically.
            </div>
            <div>
              <span className="font-medium">Cancel:</span> sends SUSPEND to WayForPay and disables future charges.
            </div>
            <div>
              <span className="font-medium">Resume:</span> sends RESUME to WayForPay and re-enables future charges.
            </div>
            <div className="pt-4 text-xs text-slate-500">
              {t("Access in the app is controlled by paidUntil and promoUntil in profiles.")}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
