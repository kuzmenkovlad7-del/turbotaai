"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

type Summary = {
  email: string | null
  access: string
  questionsLeft: number
  unlimited: boolean
  paid_until: string | null
  promo_until: string | null
  subscription_status: "active" | "inactive"
  auto_renew: boolean
}

function isActive(until: string | null) {
  if (!until) return false
  const t = new Date(until).getTime()
  return Number.isFinite(t) && t > Date.now()
}

function fmtDate(until: string | null) {
  if (!until) return "Не активно"
  try {
    const d = new Date(until)
    if (!Number.isFinite(d.getTime())) return "Не активно"
    return d.toLocaleDateString("uk-UA")
  } catch {
    return "Не активно"
  }
}

async function loadSummary(): Promise<Summary> {
  const r = await fetch("/api/account/summary", { cache: "no-store" })
  const j = await r.json().catch(() => ({} as any))

  const paidUntil = (j?.paidUntil ?? j?.paid_until ?? null) as string | null
  const promoUntil = (j?.promoUntil ?? j?.promo_until ?? null) as string | null
  const unlimited = Boolean(j?.unlimited ?? false)

  const questionsLeft =
    typeof j?.questionsLeft === "number"
      ? j.questionsLeft
      : typeof j?.trial_questions_left === "number"
        ? j.trial_questions_left
        : 0

  const accessFromApi = String(j?.access || "").trim()

  const hasPaid = isActive(paidUntil)
  const hasPromo = isActive(promoUntil)

  const access =
    accessFromApi ||
    (hasPaid ? "Оплачено" : hasPromo ? "Промо" : questionsLeft > 0 ? "Бесплатно" : "Нет доступа")

  return {
    email: (j?.user?.email ?? j?.email ?? null) as string | null,
    access,
    questionsLeft,
    unlimited,
    paid_until: paidUntil,
    promo_until: promoUntil,
    subscription_status: (j?.subscription_status ?? (hasPaid || hasPromo ? "active" : "inactive")) as "active" | "inactive",
    auto_renew: Boolean(j?.auto_renew ?? false),
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paidParam = useMemo(() => searchParams.get("paid"), [searchParams])

  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary>({
    email: null,
    access: "Бесплатно",
    questionsLeft: 0,
    unlimited: false,
    paid_until: null,
    promo_until: null,
    subscription_status: "inactive",
    auto_renew: false,
  })

  const refresh = useCallback(async () => {
    setErr(null)
    setLoading(true)
    try {
      const s = await loadSummary()
      setSummary(s)
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (paidParam !== "1") return

    let alive = true
    ;(async () => {
      setSyncing(true)
      try {
        await fetch("/api/billing/wayforpay/sync", { method: "POST", cache: "no-store" })
      } catch {
      } finally {
        if (alive) setSyncing(false)
      }
      if (alive) await refresh()
    })()

    return () => {
      alive = false
    }
  }, [paidParam, refresh])

  const questionsLabel = summary.unlimited ? "∞" : String(summary.questionsLeft)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold">Профиль</h1>
        <p className="mt-2 text-gray-500">Управление доступом и история</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-6">
            <div className="text-xl font-semibold">Аккаунт</div>
            <div className="text-sm text-gray-500">Статус входа и доступ</div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="text-gray-500">Email:</div>
              <div className="font-medium">{summary.email ? summary.email : "Гость"}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-500">Доступ:</div>
              <div className="font-medium">{summary.access}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-500">Осталось вопросов:</div>
              <div className="font-medium">{questionsLabel}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-500">Оплачено до:</div>
              <div className="font-medium">{fmtDate(summary.paid_until)}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-500">Промо до:</div>
              <div className="font-medium">{fmtDate(summary.promo_until)}</div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              className="w-full rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
              onClick={refresh}
              disabled={loading || syncing}
            >
              {loading ? "Обновление..." : syncing ? "Проверка оплаты..." : "Обновить"}
            </button>

            <button
              className="w-full rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              onClick={() => router.push("/pricing")}
            >
              Тарифы
            </button>
          </div>

          {err ? <div className="mt-4 text-sm text-red-600">{err}</div> : null}
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-6">
            <div className="text-xl font-semibold">Управление доступом</div>
            <div className="text-sm text-gray-500">Подписка и промокод</div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="text-gray-500">Статус подписки:</div>
              <div className="font-medium">{summary.subscription_status}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-500">Автопродление:</div>
              <div className="font-medium">{summary.auto_renew ? "Включено" : "Выключено"}</div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button className="w-full rounded-xl border px-4 py-2 text-sm font-medium text-gray-400" disabled>
              Отменить автопродление
            </button>

            <button className="w-full rounded-xl border px-4 py-2 text-sm font-medium text-gray-400" disabled>
              Отменить промокод
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-2 text-xl font-semibold">История</div>
        <div className="text-sm text-gray-500">Сохранённые сессии</div>

        <div className="mt-4 text-sm text-gray-500">Войдите, чтобы видеть историю.</div>
      </div>
    </div>
  )
}
