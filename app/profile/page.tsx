"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

type Summary = {
  email: string | null
  access: string
  questionsLeft: number
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

function accessLabel(raw: any, hasPaid: boolean, hasPromo: boolean, questionsLeft: number) {
  // UI всегда приоритетно строим от фактов (paid_until / promo_until / questionsLeft)
  if (hasPaid) return "Оплачено"
  if (hasPromo) return "Промо"
  if (questionsLeft > 0) return "Бесплатно"
  const s = String(raw || "").toLowerCase()
  if (s === "paid") return "Оплачено"
  if (s === "promo") return "Промо"
  if (s === "trial") return "Бесплатно"
  return "Нет доступа"
}

function subscriptionLabel(v: "active" | "inactive") {
  return v === "active" ? "Активна" : "Неактивна"
}

async function loadSummary(): Promise<Summary> {
  const r = await fetch("/api/account/summary", { cache: "no-store" })
  const j = await r.json().catch(() => ({} as any))

  const paidUntil = (j?.paidUntil ?? j?.paid_until ?? null) as string | null
  const promoUntil = (j?.promoUntil ?? j?.promo_until ?? null) as string | null
  const questionsLeft = typeof j?.questionsLeft === "number" ? j.questionsLeft : 0

  const hasPaid = isActive(paidUntil)
  const hasPromo = isActive(promoUntil)

  const access = accessLabel(j?.access, hasPaid, hasPromo, questionsLeft)

  const subRaw = String(j?.subscription_status ?? "").toLowerCase()
  const subscription_status =
    (subRaw === "active" || subRaw === "inactive"
      ? (subRaw as "active" | "inactive")
      : (hasPaid || hasPromo ? "active" : "inactive"))

  return {
    email: (j?.email ?? null) as string | null,
    access,
    questionsLeft,
    paid_until: paidUntil,
    promo_until: promoUntil,
    subscription_status,
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

  const hasPaid = isActive(summary.paid_until)
  const hasPromo = isActive(summary.promo_until)

  const questionsLabel = hasPaid || hasPromo ? "Безлимит" : String(summary.questionsLeft)

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
              <div className="font-medium">{subscriptionLabel(summary.subscription_status)}</div>
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
