"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/lib/i18n/language-context"

type Lang = "uk" | "ru" | "en"

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
  if (!v) return "—"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}

export default function SubscriptionClient() {
  const { t } = useLanguage()
  const router = useRouter()

  const [lang, setLang] = useState<Lang>("uk")

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SubSummary | null>(null)
  const [busy, setBusy] = useState<null | "pay" | "cancel" | "resume" | "promo">(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState("")

  useEffect(() => {
    const raw = (document.documentElement.lang || "uk").toLowerCase()
    const v: Lang = raw.startsWith("ru") ? "ru" : raw.startsWith("en") ? "en" : "uk"
    setLang(v)
  }, [])

  const copy = useMemo(() => {
    const c = {
      uk: {
        title: "Підписка",
        manageTitle: "Керування",
        manageDesc: "Щомісячна підписка",
        howTitle: "Як це працює",
        howDesc: "Автосписання в продакшені",
        signIn: "Будь ласка, увійдіть, щоб керувати підпискою.",
        signInBtn: "Увійти",
        status: "Статус",
        access: "Доступ",
        accessActive: "Активний",
        accessInactive: "Неактивний",
        until: "До",
        autoRenew: "Автосписання",
        autoRenewOn: "Увімкнено",
        autoRenewOff: "Вимкнено",
        pay: "Оформити підписку",
        cancel: "Скасувати автосписання",
        resume: "Відновити автосписання",
        promo: "Промокод",
        apply: "Застосувати",
      },
      ru: {
        title: "Подписка",
        manageTitle: "Управление",
        manageDesc: "Ежемесячная подписка",
        howTitle: "Как это работает",
        howDesc: "Автосписание в продакшене",
        signIn: "Пожалуйста, войдите, чтобы управлять подпиской.",
        signInBtn: "Войти",
        status: "Статус",
        access: "Доступ",
        accessActive: "Активен",
        accessInactive: "Неактивен",
        until: "До",
        autoRenew: "Автосписание",
        autoRenewOn: "Включено",
        autoRenewOff: "Выключено",
        pay: "Оформить подписку",
        cancel: "Отменить автосписание",
        resume: "Возобновить автосписание",
        promo: "Промокод",
        apply: "Применить",
      },
      en: {
        title: "Subscription",
        manageTitle: "Manage",
        manageDesc: "Monthly subscription",
        howTitle: "How it works",
        howDesc: "Auto-renew in production",
        signIn: "Please sign in to manage your subscription.",
        signInBtn: "Sign in",
        status: "Status",
        access: "Access",
        accessActive: "Active",
        accessInactive: "Inactive",
        until: "Until",
        autoRenew: "Auto-renew",
        autoRenewOn: "Enabled",
        autoRenewOff: "Disabled",
        pay: "Start subscription",
        cancel: "Cancel auto-renew",
        resume: "Resume auto-renew",
        promo: "Promo code",
        apply: "Apply",
      },
    }
    return c[lang]
  }, [lang])

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
      setMsg(lang === "ru" ? "Автосписание отменено" : lang === "en" ? "Auto-renew canceled" : "Автосписання скасовано")
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
      setMsg(lang === "ru" ? "Автосписание возобновлено" : lang === "en" ? "Auto-renew resumed" : "Автосписання відновлено")
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
      setMsg(lang === "ru" ? "Промокод применён" : lang === "en" ? "Promo applied" : "Промокод застосовано")
      await load()
    } finally {
      setBusy(null)
    }
  }

  const ok = !!data?.ok
  const hasAccess = !!data?.hasAccess
  const autoRenew = !!data?.autoRenew

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-semibold tracking-tight">{copy.title}</h1>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-2xl">{copy.manageTitle}</CardTitle>
            <CardDescription>{copy.manageDesc}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {!ok && (
              <div className="text-sm text-slate-600">
                {copy.signIn}
                <div className="mt-4">
                  <Button onClick={() => router.push("/login")}>{copy.signInBtn}</Button>
                </div>
              </div>
            )}

            {ok && (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{copy.access}</span>
                      <span className="font-medium">{hasAccess ? copy.accessActive : copy.accessInactive}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{copy.until}</span>
                      <span className="font-medium">{fmt(data?.accessUntil ?? null)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{copy.autoRenew}</span>
                      <span className="font-medium">{autoRenew ? copy.autoRenewOn : copy.autoRenewOff}</span>
                    </div>
                  </div>
                </div>

                {msg && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    {msg}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {!hasAccess && (
                    <Button onClick={payMonthly} disabled={busy === "pay"}>
                      {copy.pay}
                    </Button>
                  )}

                  {hasAccess && autoRenew && (
                    <Button variant="outline" onClick={cancelAutoRenew} disabled={busy === "cancel"}>
                      {copy.cancel}
                    </Button>
                  )}

                  {hasAccess && !autoRenew && (
                    <Button variant="outline" onClick={resumeAutoRenew} disabled={busy === "resume"}>
                      {copy.resume}
                    </Button>
                  )}
                </div>

                <div className="pt-2">
                  <div className="text-sm text-slate-500">{copy.promo}</div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      placeholder={lang === "ru" ? "Введите промокод" : lang === "en" ? "Enter promo code" : "Введіть промокод"}
                    />
                    <Button onClick={redeemPromo} disabled={busy === "promo"}>
                      {copy.apply}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {loading && (
              <div className="text-sm text-slate-500">
                {lang === "ru" ? "Загрузка..." : lang === "en" ? "Loading..." : "Завантаження..."}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-2xl">{copy.howTitle}</CardTitle>
            <CardDescription>{copy.howDesc}</CardDescription>
          </CardHeader>

          <CardContent>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              <li>{t("subscription.how.start")}</li>
              <li>{t("subscription.how.renew")}</li>
              <li>{t("subscription.how.cancel")}</li>
              <li>{t("subscription.how.resume")}</li>
              <li className="pt-2 text-xs text-slate-500">{t("subscription.how.note")}</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
