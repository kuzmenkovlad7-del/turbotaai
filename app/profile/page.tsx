"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

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
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

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
      setMsg("Промокод скасовано")
    } catch {
      setMsg("Не вдалося скасувати промокод")
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
      setMsg("Автопродовження вимкнено")
    } catch {
      setMsg("Не вдалося вимкнути автопродовження")
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
      setMsg("Автопродовження увімкнено")
    } catch {
      setMsg("Не вдалося увімкнути автопродовження")
    } finally {
      setBusy(null)
    }
  }

  const isLoggedIn = Boolean(summary?.isLoggedIn)
  const email = summary?.email || null

  // Differentiated access label
  const accessLabel = paidActive
    ? "Підписка активна"
    : promoActive
    ? "Промо доступ"
    : "Обмежено"

  // Subscription status label
  const subLabel = (() => {
    const s = String(summary?.subscription_status || "").toLowerCase()
    if (paidActive) {
      if (s === "canceled" || s === "cancelled") return "Скасована (діє до кінця періоду)"
      return "Активна"
    }
    if (promoActive) return "Промо"
    return "—"
  })()

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-6">
            <div className="text-xl font-semibold">Профіль</div>
            <div className="text-sm text-gray-500">Доступ, підписка, промокод</div>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">Завантаження...</div>
          ) : (
            <>
              <div className="space-y-3 text-sm">
                {isLoggedIn && email ? (
                  <div className="flex items-center justify-between">
                    <div className="text-gray-500">Email:</div>
                    <div className="font-medium">{email}</div>
                  </div>
                ) : null}

                <div className="flex items-center justify-between">
                  <div className="text-gray-500">Доступ:</div>
                  <div className="font-medium">{accessLabel}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-gray-500">Оплачено до:</div>
                  <div className="font-medium">{fmtDate(summary?.paid_until)}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-gray-500">Промо до:</div>
                  <div className="font-medium">{fmtDate(summary?.promo_until)}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-gray-500">Доступ активний до:</div>
                  <div className="font-medium">{fmtDate(accessUntil)}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-gray-500">Статус підписки:</div>
                  <div className="font-medium">{subLabel}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-gray-500">Автопродовження:</div>
                  <div className="font-medium">{summary?.auto_renew ? "Увімкнено" : "Вимкнено"}</div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {/* Subscription auto-renew button */}
                {paidActive ? (
                  summary?.auto_renew ? (
                    <button
                      className="w-full rounded-xl border border-black bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-50"
                      disabled={busy === "sub"}
                      onClick={cancelAutoRenew}
                    >
                      {busy === "sub" ? "Обробка..." : "Вимкнути автопродовження"}
                    </button>
                  ) : (
                    <button
                      className="w-full rounded-xl border border-black bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-50"
                      disabled={busy === "sub"}
                      onClick={resumeAutoRenew}
                    >
                      {busy === "sub" ? "Обробка..." : "Увімкнути автопродовження"}
                    </button>
                  )
                ) : (
                  <button
                    className="w-full rounded-xl border px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
                    disabled
                    onClick={() => router.push("/pricing")}
                  >
                    Автопродовження доступне після оплати
                  </button>
                )}

                {/* Cancel promo button */}
                {promoActive ? (
                  <button
                    className="w-full rounded-xl border border-black bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-50"
                    disabled={busy === "promo"}
                    onClick={cancelPromo}
                  >
                    {busy === "promo" ? "Обробка..." : "Скасувати промокод"}
                  </button>
                ) : (
                  <button
                    className="w-full rounded-xl border px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
                    disabled
                  >
                    Скасувати промокод
                  </button>
                )}

                {msg ? <div className="text-sm text-gray-500">{msg}</div> : null}
              </div>

              {!isLoggedIn ? (
                <div className="mt-6 text-xs text-gray-500">
                  Порада: щоб не втратити доступ при очищенні cookie, увійдіть або зареєструйтесь і привʼяжіть доступ до аккаунта.
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-2 text-xl font-semibold">Історія</div>
          <div className="text-sm text-gray-500">Збережені сесії</div>

          {isLoggedIn ? (
            <div className="mt-4 text-sm text-gray-500">Історія відображається для увійшовших користувачів</div>
          ) : (
            <div className="mt-4 text-sm text-gray-500">Увійдіть, щоб бачити історію.</div>
          )}
        </div>
      </div>
    </div>
  )
}
