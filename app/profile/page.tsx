"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth/auth-context"

type Summary = {
  email?: string | null
  trialLeft?: any
  trial_left?: any
  trial_questions_left?: any
  access?: "Paid" | "Promo" | "Trial" | "Limited" | string | null
  paidUntil?: string | null
  paid_until?: string | null
  promoUntil?: string | null
  promo_until?: string | null
  isLoggedIn?: boolean
  autoRenew?: boolean
  auto_renew?: boolean
  subscriptionStatus?: string | null
}

function isActiveDate(v: any) {
  if (!v) return false
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() > Date.now()
}

function formatDateTime(v: any, locale: string) {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  const fmt = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
  return fmt.format(d)
}

export default function ProfilePage() {
  const { currentLanguage } = useLanguage()
  const { user } = useAuth()
  const router = useRouter()

  const lang = useMemo(() => {
    const code = String(currentLanguage?.code || "uk").toLowerCase()
    return code.startsWith("ru") ? "ru" : code.startsWith("en") ? "en" : "uk"
  }, [currentLanguage?.code])

  const locale = useMemo(() => {
    return lang === "ru" ? "ru-RU" : lang === "uk" ? "uk-UA" : "en-US"
  }, [lang])

  const copy = useMemo(() => {
    const c = {
      uk: {
        title: "Профіль",
        pricing: "Тарифи",
        signIn: "Увійти",
        logout: "Вийти",

        account: "Акаунт",
        accountDesc: "Статус входу та доступ",
        email: "Email",
        access: "Доступ",
        accessFree: "Безкоштовно",
        accessPromo: "Промокод",
        accessUnlimited: "Безліміт",
        questionsLeft: "Залишилось запитань",
        unlimited: "Безлімітно",

        paidUntil: "Оплачено до",
        promoUntil: "Промо до",
        notActive: "Не активно",

        manage: "Керування доступом",
        manageDesc: "Підписка та промокод",
        subStatus: "Статус підписки",
        autoRenew: "Автопродовження",
        enabled: "Увімкнено",
        disabled: "Вимкнено",
        active: "Активна",
        inactive: "Не активна",

        cancelSub: "Скасувати автопродовження",
        cancelPromo: "Скасувати промокод",
        cancelling: "Виконуємо...",
        refresh: "Оновити",

        needLogin: "Увійдіть, щоб керувати підпискою та промо.",
        okSubCanceled: "Автопродовження вимкнено",
        okPromoCanceled: "Промокод скасовано",

        history: "Історія",
        historyDesc: "Збережені сесії",
        historyNeedLogin: "Увійдіть, щоб бачити історію.",
        historyOpen: "Відкрийте сесію з історії.",
        guest: "Гість",
      },
      ru: {
        title: "Профиль",
        pricing: "Тарифы",
        signIn: "Войти",
        logout: "Выйти",

        account: "Аккаунт",
        accountDesc: "Статус входа и доступ",
        email: "Email",
        access: "Доступ",
        accessFree: "Бесплатно",
        accessPromo: "Промокод",
        accessUnlimited: "Безлимит",
        questionsLeft: "Осталось вопросов",
        unlimited: "Безлимитно",

        paidUntil: "Оплачено до",
        promoUntil: "Промо до",
        notActive: "Не активно",

        manage: "Управление доступом",
        manageDesc: "Подписка и промокод",
        subStatus: "Статус подписки",
        autoRenew: "Автопродление",
        enabled: "Включено",
        disabled: "Выключено",
        active: "Активна",
        inactive: "Не активна",

        cancelSub: "Отменить автопродление",
        cancelPromo: "Отменить промокод",
        cancelling: "Выполняем...",
        refresh: "Обновить",

        needLogin: "Войдите, чтобы управлять подпиской и промо.",
        okSubCanceled: "Автопродление выключено",
        okPromoCanceled: "Промокод отменён",

        history: "История",
        historyDesc: "Сохранённые сессии",
        historyNeedLogin: "Войдите, чтобы видеть историю.",
        historyOpen: "Откройте сессию из истории.",
        guest: "Гость",
      },
      en: {
        title: "Profile",
        pricing: "Pricing",
        signIn: "Sign In",
        logout: "Log out",

        account: "Account",
        accountDesc: "Login status and access",
        email: "Email",
        access: "Access",
        accessFree: "Free",
        accessPromo: "Promo code",
        accessUnlimited: "Unlimited",
        questionsLeft: "Questions left",
        unlimited: "Unlimited",

        paidUntil: "Paid until",
        promoUntil: "Promo until",
        notActive: "Not active",

        manage: "Access management",
        manageDesc: "Subscription and promo",
        subStatus: "Subscription status",
        autoRenew: "Auto renew",
        enabled: "Enabled",
        disabled: "Disabled",
        active: "Active",
        inactive: "Inactive",

        cancelSub: "Cancel auto-renew",
        cancelPromo: "Cancel promo",
        cancelling: "Working...",
        refresh: "Refresh",

        needLogin: "Sign in to manage subscription and promo.",
        okSubCanceled: "Auto-renew disabled",
        okPromoCanceled: "Promo cancelled",

        history: "History",
        historyDesc: "Saved sessions",
        historyNeedLogin: "Login to see history.",
        historyOpen: "Open a session from your history.",
        guest: "Guest",
      },
    }
    return c[lang as "uk" | "ru" | "en"]
  }, [lang])

  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<null | "refresh" | "cancelSub" | "cancelPromo">(null)
  const [msg, setMsg] = useState<string | null>(null)

  const loadSummary = async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/account/summary", { cache: "no-store", credentials: "include" })
      const d = await r.json().catch(() => ({}))
      setSummary(d || {})
    } catch {
      setSummary({})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [])

  const isLoggedIn = Boolean(user) || Boolean(summary?.isLoggedIn)
  const email = summary?.email ? String(summary.email) : copy.guest

  const trialLeftNum = Number(
    (summary as any)?.trialLeft ??
      (summary as any)?.trial_left ??
      (summary as any)?.trial_questions_left ??
      0
  )
  const trialLeft = Number.isFinite(trialLeftNum) ? trialLeftNum : 0

  const paidUntilRaw = (summary as any)?.paidUntil ?? (summary as any)?.paid_until ?? null
  const promoUntilRaw = (summary as any)?.promoUntil ?? (summary as any)?.promo_until ?? null

  const paidActive = summary?.access === "Paid" || isActiveDate(paidUntilRaw)
  const promoActive = summary?.access === "Promo" || isActiveDate(promoUntilRaw)

  const accessLabel = paidActive
    ? copy.accessUnlimited
    : promoActive
    ? copy.accessPromo
    : copy.accessFree

  const questionsLabel = paidActive || promoActive ? copy.unlimited : String(trialLeft)

  const paidUntil = formatDateTime(paidUntilRaw, locale)
  const promoUntil = formatDateTime(promoUntilRaw, locale)

  const autoRenew = Boolean((summary as any)?.autoRenew ?? (summary as any)?.auto_renew ?? false)
  const subscriptionStatus = String((summary as any)?.subscriptionStatus ?? "").trim()
  const subActive = paidActive || promoActive || subscriptionStatus.toLowerCase() === "active"

  async function doLogout() {
    await fetch("/api/auth/clear", { method: "POST", credentials: "include" }).catch(() => {})
    router.refresh()
    router.push("/pricing")
  }

  async function doCancelSub() {
    setMsg(null)
    if (!isLoggedIn) {
      setMsg(copy.needLogin)
      router.push("/login?next=/profile")
      return
    }

    setBusy("cancelSub")
    try {
      const r = await fetch("/api/billing/subscription/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.error || "Cancel failed")

      setMsg(copy.okSubCanceled)
      await loadSummary()
      try {
        window.dispatchEvent(new Event("turbota:refresh"))
      } catch {}
    } catch (e: any) {
      setMsg(e?.message || "Cancel failed")
    } finally {
      setBusy(null)
    }
  }

  async function doCancelPromo() {
    setMsg(null)
    if (!isLoggedIn) {
      setMsg(copy.needLogin)
      router.push("/login?next=/profile")
      return
    }

    setBusy("cancelPromo")
    try {
      const r = await fetch("/api/billing/promo/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.error || "Cancel failed")

      setMsg(copy.okPromoCanceled)
      await loadSummary()
      try {
        window.dispatchEvent(new Event("turbota:refresh"))
      } catch {}
    } catch (e: any) {
      setMsg(e?.message || "Cancel failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-10 xl:px-16">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900">{copy.title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/pricing">
            <Button variant="outline" className="rounded-full border border-slate-200">
              {copy.pricing}
            </Button>
          </Link>

          {isLoggedIn ? (
            <Button
              variant="outline"
              className="rounded-full border border-slate-200"
              onClick={doLogout}
            >
              {copy.logout}
            </Button>
          ) : (
            <Link href="/login?next=/profile">
              <Button variant="outline" className="rounded-full border border-slate-200">
                {copy.signIn}
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{copy.account}</CardTitle>
            <CardDescription>{copy.accountDesc}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{copy.email}:</span>
              <span className="font-medium">{loading ? "…" : email}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">{copy.access}:</span>
              <span className="font-medium">{loading ? "…" : accessLabel}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">{copy.questionsLeft}:</span>
              <span className="font-medium">{loading ? "…" : questionsLabel}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">{copy.paidUntil}:</span>
              <span className="font-medium">{loading ? "…" : paidUntil || copy.notActive}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">{copy.promoUntil}:</span>
              <span className="font-medium">{loading ? "…" : promoUntil || copy.notActive}</span>
            </div>

            <div className="pt-3 space-y-2">
              <Button
                variant="outline"
                className="w-full rounded-full border border-slate-200"
                disabled={busy === "refresh"}
                onClick={async () => {
                  setBusy("refresh")
                  setMsg(null)
                  await loadSummary()
                  setBusy(null)
                }}
              >
                {busy === "refresh" ? copy.cancelling : copy.refresh}
              </Button>

              <Link href="/pricing">
                <Button variant="outline" className="w-full rounded-full border border-slate-200">
                  {copy.pricing}
                </Button>
              </Link>

              {msg ? <p className="mt-2 text-xs text-slate-600">{msg}</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{copy.manage}</CardTitle>
            <CardDescription>{copy.manageDesc}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{copy.subStatus}:</span>
              <span className="font-medium">
                {loading ? "…" : subActive ? copy.active : copy.inactive}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">{copy.autoRenew}:</span>
              <span className="font-medium">
                {loading ? "…" : autoRenew ? copy.enabled : copy.disabled}
              </span>
            </div>

            {!isLoggedIn ? (
              <p className="text-xs text-slate-500">{copy.needLogin}</p>
            ) : null}

            <div className="grid gap-2 pt-2">
              <Button
                variant="outline"
                className="w-full rounded-full border border-slate-200"
                disabled={!isLoggedIn || busy === "cancelSub" || !autoRenew}
                onClick={doCancelSub}
              >
                {busy === "cancelSub" ? copy.cancelling : copy.cancelSub}
              </Button>

              <Button
                variant="outline"
                className="w-full rounded-full border border-slate-200"
                disabled={!isLoggedIn || busy === "cancelPromo" || !promoActive}
                onClick={doCancelPromo}
              >
                {busy === "cancelPromo" ? copy.cancelling : copy.cancelPromo}
              </Button>
            </div>

            {subscriptionStatus ? (
              <p className="pt-1 text-xs text-slate-500">status: {subscriptionStatus}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle>{copy.history}</CardTitle>
            <CardDescription>{copy.historyDesc}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-700">
            {isLoggedIn ? (
              <div className="text-slate-600">{copy.historyOpen}</div>
            ) : (
              <div className="text-slate-600">{copy.historyNeedLogin}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
