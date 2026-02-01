"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"

type Summary = {
  isLoggedIn?: boolean
  email?: string | null
  access?: string | null
  subscription_status?: string | null
  auto_renew?: boolean | null
  paid_until?: string | null
  promo_until?: string | null
  trial_questions_left?: number | null
}

function isActiveDate(v: any) {
  if (!v) return false
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() > Date.now()
}

function fmtDate(v: any) {
  if (!v) return "—"
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("uk-UA")
}

function laterIso(a: any, b: any): string | null {
  const da = a ? new Date(String(a)) : null
  const db = b ? new Date(String(b)) : null
  const ta = da && !Number.isNaN(da.getTime()) ? da.getTime() : null
  const tb = db && !Number.isNaN(db.getTime()) ? db.getTime() : null
  if (ta == null && tb == null) return null
  if (ta != null && tb == null) return da!.toISOString()
  if (ta == null && tb != null) return db!.toISOString()
  return (ta! >= tb! ? da! : db!).toISOString()
}

export default function ProfilePage() {
  const router = useRouter()
  const { currentLanguage } = useLanguage()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const lang = useMemo(() => {
    const code = String(currentLanguage?.code || "uk").toLowerCase()
    return code.startsWith("ru") ? "ru" : code.startsWith("en") ? "en" : "uk"
  }, [currentLanguage?.code])

  const copy = useMemo(() => {
    const c = {
      uk: {
        profile: "Профіль",
        profileDesc: "Доступ, підписка, промокод",
        loading: "Завантаження...",
        email: "Email:",
        access: "Доступ:",
        paidUntil: "Оплачено до:",
        promoUntil: "Промо до:",
        accessUntil: "Доступ активний до:",
        subStatus: "Статус підписки:",
        autoRenew: "Автопродовження:",
        enabled: "Увімкнено",
        disabled: "Вимкнено",
        processing: "Обробка...",
        disableAutoRenew: "Вимкнути автопродовження",
        enableAutoRenew: "Увімкнути автопродовження",
        autoAfterPay: "Автопродовження доступне після оплати",
        cancelPromo: "Скасувати промокод",
        tip: "Порада: щоб не втратити доступ при очищенні cookie, увійдіть або зареєструйтесь і привʼяжіть доступ до аккаунта.",
        history: "Історія",
        savedSessions: "Збережені сесії",
        historyShown: "Історія відображається для увійшовших користувачів",
        loginToSeeHistory: "Увійдіть, щоб бачити історію.",
        subActive: "Підписка активна",
        promoAccess: "Промо доступ",
        limited: "Обмежено",
        cancelledActive: "Скасована (діє до кінця періоду)",
        active: "Активна",
        promo: "Промо",
        promoCancelled: "Промокод скасовано",
        promoCancelFail: "Не вдалося скасувати промокод",
        autoRenewOff: "Автопродовження вимкнено",
        autoRenewOffFail: "Не вдалося вимкнути автопродовження",
        autoRenewOn: "Автопродовження увімкнено",
        autoRenewOnFail: "Не вдалося увімкнути автопродовження",
      },
      ru: {
        profile: "Профиль",
        profileDesc: "Доступ, подписка, промокод",
        loading: "Загрузка...",
        email: "Email:",
        access: "Доступ:",
        paidUntil: "Оплачено до:",
        promoUntil: "Промо до:",
        accessUntil: "Доступ активен до:",
        subStatus: "Статус подписки:",
        autoRenew: "Автопродление:",
        enabled: "Включено",
        disabled: "Выключено",
        processing: "Обработка...",
        disableAutoRenew: "Выключить автопродление",
        enableAutoRenew: "Включить автопродление",
        autoAfterPay: "Автопродление доступно после оплаты",
        cancelPromo: "Отменить промокод",
        tip: "Совет: чтобы не потерять доступ при очистке cookie, войдите или зарегистрируйтесь и привяжите доступ к аккаунту.",
        history: "История",
        savedSessions: "Сохранённые сессии",
        historyShown: "История отображается для вошедших пользователей",
        loginToSeeHistory: "Войдите, чтобы видеть историю.",
        subActive: "Подписка активна",
        promoAccess: "Промо доступ",
        limited: "Ограничено",
        cancelledActive: "Отменена (действует до конца периода)",
        active: "Активна",
        promo: "Промо",
        promoCancelled: "Промокод отменён",
        promoCancelFail: "Не удалось отменить промокод",
        autoRenewOff: "Автопродление выключено",
        autoRenewOffFail: "Не удалось выключить автопродление",
        autoRenewOn: "Автопродление включено",
        autoRenewOnFail: "Не удалось включить автопродление",
      },
      en: {
        profile: "Profile",
        profileDesc: "Access, subscription, promo code",
        loading: "Loading...",
        email: "Email:",
        access: "Access:",
        paidUntil: "Paid until:",
        promoUntil: "Promo until:",
        accessUntil: "Access active until:",
        subStatus: "Subscription status:",
        autoRenew: "Auto-renew:",
        enabled: "Enabled",
        disabled: "Disabled",
        processing: "Processing...",
        disableAutoRenew: "Disable auto-renew",
        enableAutoRenew: "Enable auto-renew",
        autoAfterPay: "Auto-renew available after payment",
        cancelPromo: "Cancel promo code",
        tip: "Tip: to keep access when clearing cookies, sign in or register and link access to your account.",
        history: "History",
        savedSessions: "Saved sessions",
        historyShown: "History is shown for signed-in users",
        loginToSeeHistory: "Sign in to see history.",
        subActive: "Subscription active",
        promoAccess: "Promo access",
        limited: "Limited",
        cancelledActive: "Cancelled (active until end of period)",
        active: "Active",
        promo: "Promo",
        promoCancelled: "Promo code cancelled",
        promoCancelFail: "Failed to cancel promo code",
        autoRenewOff: "Auto-renew disabled",
        autoRenewOffFail: "Failed to disable auto-renew",
        autoRenewOn: "Auto-renew enabled",
        autoRenewOnFail: "Failed to enable auto-renew",
      },
    }
    return c[lang as "uk" | "ru" | "en"]
  }, [lang])

  const paidActive = isActiveDate(summary?.paid_until)
  const promoActive = isActiveDate(summary?.promo_until)
  const accessUntil = useMemo(() => laterIso(summary?.paid_until ?? null, summary?.promo_until ?? null), [summary?.paid_until, summary?.promo_until])

  const refresh = async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/account/summary", { cache: "no-store" })
      const j = await r.json().catch(() => ({} as any))
      setSummary(j as any)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const cancelPromo = async () => {
    setBusy("promo")
    setMsg(null)
    try {
      await fetch("/api/billing/promo/cancel", { method: "POST", cache: "no-store" })
      await refresh()
      setMsg(copy.promoCancelled)
    } catch {
      setMsg(copy.promoCancelFail)
    } finally {
      setBusy(null)
    }
  }

  const cancelAutoRenew = async () => {
    setBusy("sub")
    setMsg(null)
    try {
      await fetch("/api/billing/subscription/cancel", { method: "POST", cache: "no-store" })
      await refresh()
      setMsg(copy.autoRenewOff)
    } catch {
      setMsg(copy.autoRenewOffFail)
    } finally {
      setBusy(null)
    }
  }

  const resumeAutoRenew = async () => {
    setBusy("sub")
    setMsg(null)
    try {
      await fetch("/api/billing/subscription/resume", { method: "POST", cache: "no-store" })
      await refresh()
      setMsg(copy.autoRenewOn)
    } catch {
      setMsg(copy.autoRenewOnFail)
    } finally {
      setBusy(null)
    }
  }

  const isLoggedIn = Boolean(summary?.isLoggedIn)
  const email = summary?.email || null

  const accessLabel = paidActive
    ? copy.subActive
    : promoActive
    ? copy.promoAccess
    : copy.limited

  const subLabel = (() => {
    const s = String(summary?.subscription_status || "").toLowerCase()
    if (paidActive) {
      if (s === "canceled" || s === "cancelled") return copy.cancelledActive
      return copy.active
    }
    if (promoActive) return copy.promo
    return "—"
  })()

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-6">
            <div className="text-xl font-semibold">{copy.profile}</div>
            <div className="text-sm text-gray-500">{copy.profileDesc}</div>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">{copy.loading}</div>
          ) : (
            <>
              <div className="space-y-3 text-sm">
                {isLoggedIn && email ? (
                  <div className="flex items-center justify-between">
                    <div className="text-gray-500">{copy.email}</div>
                    <div className="font-medium">{email}</div>
                  </div>
                ) : null}

                <div className="flex items-center justify-between">
                  <div className="text-gray-500">{copy.access}</div>
                  <div className="font-medium">{accessLabel}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-gray-500">{copy.paidUntil}</div>
                  <div className="font-medium">{fmtDate(summary?.paid_until)}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-gray-500">{copy.promoUntil}</div>
                  <div className="font-medium">{fmtDate(summary?.promo_until)}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-gray-500">{copy.accessUntil}</div>
                  <div className="font-medium">{fmtDate(accessUntil)}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-gray-500">{copy.subStatus}</div>
                  <div className="font-medium">{subLabel}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-gray-500">{copy.autoRenew}</div>
                  <div className="font-medium">{summary?.auto_renew ? copy.enabled : copy.disabled}</div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {paidActive ? (
                  summary?.auto_renew ? (
                    <button
                      className="w-full rounded-xl border border-black bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-50"
                      disabled={busy === "sub"}
                      onClick={cancelAutoRenew}
                    >
                      {busy === "sub" ? copy.processing : copy.disableAutoRenew}
                    </button>
                  ) : (
                    <button
                      className="w-full rounded-xl border border-black bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-50"
                      disabled={busy === "sub"}
                      onClick={resumeAutoRenew}
                    >
                      {busy === "sub" ? copy.processing : copy.enableAutoRenew}
                    </button>
                  )
                ) : (
                  <button
                    className="w-full rounded-xl border px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
                    disabled
                    onClick={() => router.push("/pricing")}
                  >
                    {copy.autoAfterPay}
                  </button>
                )}

                {promoActive ? (
                  <button
                    className="w-full rounded-xl border border-black bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-50"
                    disabled={busy === "promo"}
                    onClick={cancelPromo}
                  >
                    {busy === "promo" ? copy.processing : copy.cancelPromo}
                  </button>
                ) : (
                  <button
                    className="w-full rounded-xl border px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
                    disabled
                  >
                    {copy.cancelPromo}
                  </button>
                )}

                {msg ? <div className="text-sm text-gray-500">{msg}</div> : null}
              </div>

              {!isLoggedIn ? (
                <div className="mt-6 text-xs text-gray-500">
                  {copy.tip}
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-2 text-xl font-semibold">{copy.history}</div>
          <div className="text-sm text-gray-500">{copy.savedSessions}</div>

          {isLoggedIn ? (
            <div className="mt-4 text-sm text-gray-500">{copy.historyShown}</div>
          ) : (
            <div className="mt-4 text-sm text-gray-500">{copy.loginToSeeHistory}</div>
          )}
        </div>
      </div>
    </div>
  )
}
