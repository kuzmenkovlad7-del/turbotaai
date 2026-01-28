"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n/language-context"

type AnyObj = Record<string, any>

function isActiveDate(v: any) {
  if (!v) return false
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() > Date.now()
}

function fmtDateDMY(v: any) {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

export default function ProfilePage() {
  const { currentLanguage } = useLanguage()
  const router = useRouter()

  const lang = useMemo(() => {
    const code = String(currentLanguage?.code || "uk").toLowerCase()
    return code.startsWith("ru") ? "ru" : code.startsWith("en") ? "en" : "uk"
  }, [currentLanguage?.code])

  const copy = useMemo(() => {
    const c = {
      uk: {
        title: "Профіль",
        subtitle: "Управління доступом і історія",
        account: "Акаунт",
        accountDesc: "Статус входу і доступ",
        email: "Email",
        status: "Статус",
        access: "Доступ",
        questionsLeft: "Залишилось питань",
        paidUntil: "Оплачено до",
        promoUntil: "Промо до",
        guest: "Гість",
        loggedIn: "Вхід виконано",
        free: "Безкоштовно",
        paid: "Оплачено",
        promo: "Промо",
        unlimited: "Безліміт",
        refresh: "Оновити",
        pricing: "Тарифи",
        manage: "Управління доступом",
        manageDesc: "Підписка і промокод",
        subStatus: "Статус підписки",
        autoRenew: "Автопродовження",
        active: "Активна",
        inactive: "Неактивна",
        enabled: "Увімкнено",
        disabled: "Вимкнено",
        cancelAuto: "Скасувати автопродовження",
        cancelPromo: "Скасувати промокод",
        history: "Історія",
        historyDesc: "Збережені сесії",
        needLoginHistory: "Увійдіть, щоб бачити історію.",
        login: "Увійти",
      },
      ru: {
        title: "Профиль",
        subtitle: "Управление доступом и история",
        account: "Аккаунт",
        accountDesc: "Статус входа и доступ",
        email: "Email",
        status: "Статус",
        access: "Доступ",
        questionsLeft: "Осталось вопросов",
        paidUntil: "Оплачено до",
        promoUntil: "Промо до",
        guest: "Гость",
        loggedIn: "Вход выполнен",
        free: "Бесплатно",
        paid: "Оплачено",
        promo: "Промо",
        unlimited: "Безлимит",
        refresh: "Обновить",
        pricing: "Тарифы",
        manage: "Управление доступом",
        manageDesc: "Подписка и промокод",
        subStatus: "Статус подписки",
        autoRenew: "Автопродление",
        active: "Активна",
        inactive: "Неактивна",
        enabled: "Включено",
        disabled: "Выключено",
        cancelAuto: "Отменить автопродление",
        cancelPromo: "Отменить промокод",
        history: "История",
        historyDesc: "Сохранённые сессии",
        needLoginHistory: "Войдите, чтобы видеть историю.",
        login: "Войти",
      },
      en: {
        title: "Profile",
        subtitle: "Access management and history",
        account: "Account",
        accountDesc: "Sign-in and access status",
        email: "Email",
        status: "Status",
        access: "Access",
        questionsLeft: "Questions left",
        paidUntil: "Paid until",
        promoUntil: "Promo until",
        guest: "Guest",
        loggedIn: "Logged in",
        free: "Free",
        paid: "Paid",
        promo: "Promo",
        unlimited: "Unlimited",
        refresh: "Refresh",
        pricing: "Pricing",
        manage: "Manage access",
        manageDesc: "Subscription and promo",
        subStatus: "Subscription status",
        autoRenew: "Auto-renew",
        active: "Active",
        inactive: "Inactive",
        enabled: "Enabled",
        disabled: "Disabled",
        cancelAuto: "Cancel auto-renew",
        cancelPromo: "Cancel promo",
        history: "History",
        historyDesc: "Saved sessions",
        needLoginHistory: "Please sign in to see history.",
        login: "Sign in",
      },
    }
    return c[lang as "uk" | "ru" | "en"]
  }, [lang])

  const [summary, setSummary] = useState<AnyObj | null>(null)
  const [loading, setLoading] = useState(true)
  const claimedRef = useRef(false)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch("/api/account/summary", { cache: "no-store", credentials: "include" })
      const j = await r.json().catch(() => ({}))
      setSummary(j)
    } catch {
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const isLoggedIn = Boolean(summary?.isLoggedIn ?? summary?.loggedIn ?? summary?.user)

  // когда пользователь уже вошёл — делаем claim один раз, чтобы приклеить guest-доступ к user_id
  useEffect(() => {
    if (!isLoggedIn) return
    if (claimedRef.current) return
    claimedRef.current = true

    ;(async () => {
      try {
        await fetch("/api/account/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: "{}",
        })
      } catch {}
      finally {
        try {
          window.dispatchEvent(new Event("turbota:refresh"))
        } catch {}
        load()
      }
    })()
  }, [isLoggedIn])

  const accessRaw = String(summary?.access ?? "")
  const paidUntilRaw = summary?.paidUntil ?? summary?.paid_until ?? null
  const promoUntilRaw = summary?.promoUntil ?? summary?.promo_until ?? null

  const hasPaid = accessRaw === "paid" || accessRaw === "Paid" || isActiveDate(paidUntilRaw)
  const hasPromo = accessRaw === "promo" || accessRaw === "Promo" || isActiveDate(promoUntilRaw)
  const unlimited = Boolean(summary?.unlimited) || hasPaid || hasPromo

  const qNum = Number(summary?.questionsLeft ?? summary?.trialLeft ?? summary?.trial_questions_left ?? 0)
  const questionsLeft = Number.isFinite(qNum) ? qNum : 0

  const accessLabel = hasPaid ? copy.paid : hasPromo ? copy.promo : questionsLeft > 0 ? copy.free : copy.free
  const questionsLabel = unlimited ? copy.unlimited : String(questionsLeft)

  const paidUntilPretty = fmtDateDMY(paidUntilRaw) || null
  const promoUntilPretty = fmtDateDMY(promoUntilRaw) || null

  const subStatusRaw = String(summary?.subscription_status ?? summary?.subscriptionStatus ?? "")
  const subStatus = hasPaid ? copy.active : subStatusRaw === "active" ? copy.active : copy.inactive

  const autoRenewVal = Boolean(summary?.auto_renew ?? summary?.autoRenew ?? false)
  const autoRenew = hasPaid ? (autoRenewVal ? copy.enabled : copy.disabled) : copy.disabled

  async function cancelAutoRenew() {
    try {
      await fetch("/api/billing/subscription/cancel", { method: "POST", credentials: "include" })
    } catch {}
    finally {
      try { window.dispatchEvent(new Event("turbota:refresh")) } catch {}
      load()
    }
  }

  async function cancelPromo() {
    try {
      await fetch("/api/billing/promo/cancel", { method: "POST", credentials: "include" })
    } catch {}
    finally {
      try { window.dispatchEvent(new Event("turbota:refresh")) } catch {}
      load()
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-4xl font-bold tracking-tight">{copy.title}</h1>
      <p className="mt-2 text-gray-600">{copy.subtitle}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{copy.account}</CardTitle>
            <CardDescription>{copy.accountDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-gray-500">{copy.email}:</div>
              <div className="font-medium">{isLoggedIn ? String(summary?.email || summary?.user_email || "") || "-" : copy.guest}</div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-gray-500">{copy.status}:</div>
              <div className="font-medium">{isLoggedIn ? copy.loggedIn : copy.guest}</div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-gray-500">{copy.access}:</div>
              <div className="font-medium">{accessLabel}</div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-gray-500">{copy.questionsLeft}:</div>
              <div className="font-medium">{questionsLabel}</div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-gray-500">{copy.paidUntil}:</div>
              <div className="font-medium">{hasPaid ? (paidUntilPretty || "-") : "-"}</div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-gray-500">{copy.promoUntil}:</div>
              <div className="font-medium">{hasPromo ? (promoUntilPretty || "-") : "-"}</div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={load} disabled={loading}>{copy.refresh}</Button>
              <Button variant="outline" onClick={() => router.push("/pricing")}>{copy.pricing}</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.manage}</CardTitle>
            <CardDescription>{copy.manageDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-gray-500">{copy.subStatus}:</div>
              <div className="font-medium">{subStatus}</div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-gray-500">{copy.autoRenew}:</div>
              <div className="font-medium">{autoRenew}</div>
            </div>

            <div className="mt-4 grid gap-2">
              <Button
                variant="outline"
                onClick={cancelAutoRenew}
                disabled={!hasPaid || !autoRenewVal}
              >
                {copy.cancelAuto}
              </Button>

              <Button
                variant="outline"
                onClick={cancelPromo}
                disabled={!hasPromo}
              >
                {copy.cancelPromo}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>{copy.history}</CardTitle>
            <CardDescription>{copy.historyDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoggedIn ? (
              <div className="text-sm text-gray-600">Откройте раздел истории в меню или перейдите по ссылкам в приложении.</div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-gray-600">{copy.needLoginHistory}</div>
                <Button onClick={() => router.push("/login?next=/profile")}>{copy.login}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
