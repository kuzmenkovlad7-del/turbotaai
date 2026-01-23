"use client"

import { useEffect, useMemo, useState } from "react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Summary = {
  ok?: boolean
  errorCode?: string
  isLoggedIn?: boolean
  userId?: string | null
  deviceHash?: string | null
  access?: "Paid" | "Promo" | "Limited" | string
  hasAccess?: boolean
  trial_questions_left?: number
  paid_until?: string | null
  promo_until?: string | null
}

function isActive(v: any) {
  if (!v) return false
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() > Date.now()
}

function formatDate(v: any) {
  if (!v) return "—"
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return "—"
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

export default function SubscriptionClient() {
  const { currentLanguage } = useLanguage()
  const { user } = useAuth()

  const lang = useMemo(() => {
    const code = String(currentLanguage?.code || "uk").toLowerCase()
    return code.startsWith("ru") ? "ru" : code.startsWith("en") ? "en" : "uk"
  }, [currentLanguage?.code])

  const copy = useMemo(() => {
    const c = {
      uk: {
        title: "Підписка",
        manage: "Управління",
        monthly: "Щомісячна підписка",
        how: "Як це працює",
        auto: "Автоматичне продовження",
        access: "Доступ",
        active: "Активний",
        inactive: "Неактивний",
        until: "До",
        autosub: "Автосписання",
        notApply: "Не застосовується",
        payBtn: "Оформити підписку",
        promoTitle: "Промокод",
        promoActive: "Промокод активний",
        promoPlaceholder: "Введіть промокод",
        apply: "Застосувати",
        cancelPromo: "Скасувати промокод",
        msgOkCancel: "Промокод скасовано",
        msgOkApply: "Промокод активовано",
        err_INVALID_PROMO: "Невірний промокод",
        err_EMPTY_CODE: "Введіть промокод",
        err_PAY_FAILED: "Не вдалося створити оплату. Спробуйте ще раз",
        err_AUTH_REQUIRED: "Увійдіть, щоб оформити підписку",
        err_GENERIC: "Сталася помилка. Спробуйте ще раз",
        howText:
          "Підписка активується після першої успішної оплати.\nДалі вона автоматично продовжується щомісяця, поки ви не скасуєте її.\nСкасувати можна у будь-який момент. Доступ збережеться до кінця оплаченого періоду.\nЗа потреби підписку можна відновити пізніше.\nОплата обробляється через WayForPay.",
      },
      ru: {
        title: "Подписка",
        manage: "Управление",
        monthly: "Ежемесячная подписка",
        how: "Как это работает",
        auto: "Автоматическое продление",
        access: "Доступ",
        active: "Активен",
        inactive: "Неактивен",
        until: "До",
        autosub: "Автосписание",
        notApply: "Не применяется",
        payBtn: "Оформить подписку",
        promoTitle: "Промокод",
        promoActive: "Промокод активен",
        promoPlaceholder: "Введите промокод",
        apply: "Применить",
        cancelPromo: "Отменить промокод",
        msgOkCancel: "Промокод отменён",
        msgOkApply: "Промокод активирован",
        err_INVALID_PROMO: "Неверный промокод",
        err_EMPTY_CODE: "Введите промокод",
        err_PAY_FAILED: "Не удалось создать оплату. Попробуйте ещё раз",
        err_AUTH_REQUIRED: "Войдите, чтобы оформить подписку",
        err_GENERIC: "Произошла ошибка. Попробуйте ещё раз",
        howText:
          "Подписка активируется после первой успешной оплаты.\nДалее она автоматически продлевается каждый месяц, пока вы не отмените её.\nОтменить можно в любой момент. Доступ сохранится до конца оплаченного периода.\nПри необходимости подписку можно возобновить позже.\nОплата обрабатывается через WayForPay.",
      },
      en: {
        title: "Subscription",
        manage: "Manage",
        monthly: "Monthly subscription",
        how: "How it works",
        auto: "Auto-renewal",
        access: "Access",
        active: "Active",
        inactive: "Inactive",
        until: "Until",
        autosub: "Auto charge",
        notApply: "Not applicable",
        payBtn: "Get subscription",
        promoTitle: "Promo code",
        promoActive: "Promo active",
        promoPlaceholder: "Enter promo code",
        apply: "Apply",
        cancelPromo: "Cancel promo",
        msgOkCancel: "Promo canceled",
        msgOkApply: "Promo activated",
        err_INVALID_PROMO: "Invalid promo code",
        err_EMPTY_CODE: "Enter a promo code",
        err_PAY_FAILED: "Failed to create payment. Try again",
        err_AUTH_REQUIRED: "Sign in to subscribe",
        err_GENERIC: "Something went wrong. Try again",
        howText:
          "Subscription becomes active after the first successful payment.\nThen it renews monthly until you cancel it.\nYou can cancel anytime. Access stays until the end of the paid period.\nYou can resume later.\nPayments are processed via WayForPay.",
      },
    }
    return c[lang as "uk" | "ru" | "en"]
  }, [lang])

  const [summary, setSummary] = useState<Summary | null>(null)
  const [promoCode, setPromoCode] = useState("")
  const [msg, setMsg] = useState<string>("")
  const [loading, setLoading] = useState(false)

  async function loadSummary() {
    const r = await fetch("/api/subscription/summary", {
      method: "GET",
      cache: "no-store",
      credentials: "include",
    })
    const data = await r.json().catch(() => ({} as any))
    setSummary(data || {})
  }

  useEffect(() => {
    loadSummary().catch(() => setSummary({ ok: false, errorCode: "SUMMARY_FAILED" }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const paidActive = isActive(summary?.paid_until)
  const promoActive = isActive(summary?.promo_until)

  const statusLabel = paidActive || promoActive ? copy.active : copy.inactive
  const untilLabel = paidActive
    ? formatDate(summary?.paid_until)
    : promoActive
    ? formatDate(summary?.promo_until)
    : "—"

  function errorText(code?: string) {
    if (!code) return ""
    const map: Record<string, string> = {
      INVALID_PROMO: copy.err_INVALID_PROMO,
      EMPTY_CODE: copy.err_EMPTY_CODE,
      AUTH_REQUIRED: copy.err_AUTH_REQUIRED,
    }
    return map[code] || copy.err_GENERIC
  }

  async function createInvoice() {
    setMsg("")
    setLoading(true)
    try {
      const r = await fetch("/api/billing/wayforpay/create-invoice", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "monthly" }),
      })

      if (r.status === 401) {
        setMsg(copy.err_AUTH_REQUIRED)
        window.location.assign("/login")
        return
      }

      const data = await r.json().catch(() => ({} as any))

      const url =
        data?.invoiceUrl ||
        data?.url ||
        data?.invoice_url ||
        data?.payment_url ||
        data?.paymentUrl ||
        data?.redirectUrl ||
        data?.redirect_url ||
        data?.data?.url

      if (url) {
        window.location.href = String(url)
        return
      }

      setMsg(copy.err_PAY_FAILED)
    } catch {
      setMsg(copy.err_PAY_FAILED)
    } finally {
      setLoading(false)
    }
  }

  async function applyPromo() {
    setMsg("")
    setLoading(true)
    try {
      const r = await fetch("/api/billing/promo/redeem", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode }),
      })

      const data = await r.json().catch(() => ({} as any))

      if (data?.ok) {
        setMsg(copy.msgOkApply)
        setPromoCode("")
        await loadSummary()
      } else {
        setMsg(errorText(data?.errorCode))
      }
    } catch {
      setMsg(copy.err_GENERIC)
    } finally {
      setLoading(false)
    }
  }

  async function cancelPromo() {
    setMsg("")
    setLoading(true)
    try {
      const r = await fetch("/api/billing/promo/cancel", {
        method: "POST",
        credentials: "include",
      })

      const data = await r.json().catch(() => ({} as any))

      if (data?.ok) {
        setMsg(copy.msgOkCancel)
        await loadSummary()
      } else {
        setMsg(errorText(data?.errorCode))
      }
    } catch {
      setMsg(copy.err_GENERIC)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-10 xl:px-16">
      <h1 className="mb-8 text-4xl font-semibold text-slate-900">{copy.title}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{copy.manage}</CardTitle>
            <CardDescription>{copy.monthly}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-sm text-slate-700">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{copy.access}</span>
                <span className="font-medium">{statusLabel}</span>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-slate-500">{copy.until}</span>
                <span className="font-medium">{untilLabel}</span>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-slate-500">{copy.autosub}</span>
                <span className="font-medium">{copy.notApply}</span>
              </div>
            </div>

            {msg ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                {msg}
              </div>
            ) : null}

            <Button
              variant="outline"
              className="w-full rounded-full border border-slate-200"
              onClick={createInvoice}
              disabled={loading}
            >
              {copy.payBtn}
            </Button>

            <div className="pt-2">
              <div className="mb-2 text-slate-500">{copy.promoTitle}</div>

              {promoActive ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    {copy.promoActive}
                  </div>

                  <Button
                    variant="outline"
                    className="w-full rounded-full border border-slate-200"
                    onClick={cancelPromo}
                    disabled={loading}
                  >
                    {copy.cancelPromo}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder={copy.promoPlaceholder}
                    className="h-11 w-full rounded-full border border-slate-200 bg-white px-4 text-sm outline-none"
                  />
                  <Button
                    variant="outline"
                    className="h-11 rounded-full border border-slate-200 px-6"
                    onClick={applyPromo}
                    disabled={loading}
                  >
                    {copy.apply}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{copy.how}</CardTitle>
            <CardDescription>{copy.auto}</CardDescription>
          </CardHeader>
          <CardContent className="whitespace-pre-line text-sm text-slate-700">
            {copy.howText}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
