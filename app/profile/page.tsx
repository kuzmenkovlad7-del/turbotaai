"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

type AnyObj = Record<string, any>

type Summary = {
  email: string | null
  accessRaw: string
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

function safePath(p: string | null, fallback = "/profile") {
  const v = String(p || "").trim()
  if (!v) return fallback
  return v.startsWith("/") ? v : fallback
}

async function loadCombinedSummary(): Promise<AnyObj> {
  const r1 = await fetch("/api/account/summary", { cache: "no-store", credentials: "include" })
  const d1 = (await r1.json().catch(() => ({}))) as AnyObj

  let d2: AnyObj = {}
  try {
    const r2 = await fetch("/api/billing/subscription/status", { cache: "no-store", credentials: "include" })
    d2 = (await r2.json().catch(() => ({}))) as AnyObj
  } catch {}

  return { ...d1, ...d2 }
}

function normalizeSummary(j: AnyObj): Summary {
  const paidUntil = (j?.paidUntil ?? j?.paid_until ?? null) as string | null
  const promoUntil = (j?.promoUntil ?? j?.promo_until ?? null) as string | null
  const questionsLeft = typeof j?.questionsLeft === "number" ? j.questionsLeft : Number(j?.trial_questions_left ?? 0) || 0

  const accessRaw = String(j?.access ?? "").toLowerCase()

  const subRaw = String(j?.subscription_status ?? "").toLowerCase()
  const subscription_status =
    (subRaw === "active" || subRaw === "inactive"
      ? (subRaw as "active" | "inactive")
      : (isActive(paidUntil) || isActive(promoUntil) ? "active" : "inactive"))

  return {
    email: (j?.email ?? null) as string | null,
    accessRaw,
    questionsLeft,
    paid_until: paidUntil,
    promo_until: promoUntil,
    subscription_status,
    auto_renew: Boolean(j?.auto_renew ?? false),
  }
}

function accessLabel(s: Summary) {
  const hasPaid = isActive(s.paid_until) || s.accessRaw === "paid"
  const hasPromo = isActive(s.promo_until) || s.accessRaw === "promo"
  if (hasPaid) return "Оплачено"
  if (hasPromo) return "Промо"
  if (s.questionsLeft > 0) return "Бесплатно"
  return "Нет доступа"
}

function subscriptionLabel(v: "active" | "inactive") {
  return v === "active" ? "Активна" : "Неактивна"
}

export default function ProfilePage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const nextAfterLogout = useMemo(() => safePath(searchParams.get("next"), "/pricing"), [searchParams])

  const paidParam = useMemo(() => searchParams.get("paid"), [searchParams])

  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [acting, setActing] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [summary, setSummary] = useState<Summary>({
    email: null,
    accessRaw: "trial",
    questionsLeft: 0,
    paid_until: null,
    promo_until: null,
    subscription_status: "inactive",
    auto_renew: false,
  })

  const hasPaid = isActive(summary.paid_until) || summary.accessRaw === "paid"
  const hasPromo = isActive(summary.promo_until) || summary.accessRaw === "promo"
  const unlimited = hasPaid || hasPromo
  const questionsLabel = unlimited ? "Безлимит" : String(summary.questionsLeft)

  const refresh = useCallback(async () => {
    setErr(null)
    setMsg(null)
    setLoading(true)
    try {
      const raw = await loadCombinedSummary()
      const s = normalizeSummary(raw)
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
    const onRefresh = () => refresh()
    window.addEventListener("turbota:refresh", onRefresh)
    return () => window.removeEventListener("turbota:refresh", onRefresh)
  }, [refresh])

  useEffect(() => {
    if (paidParam !== "1") return

    let alive = true
    ;(async () => {
      setSyncing(true)
      try {
        await fetch("/api/billing/wayforpay/sync", { method: "POST", cache: "no-store", credentials: "include" })
      } catch {
      } finally {
        if (alive) setSyncing(false)
      }
      if (alive) {
        window.dispatchEvent(new Event("turbota:refresh"))
        await refresh()
      }
    })()

    return () => {
      alive = false
    }
  }, [paidParam, refresh])

  async function doLogout() {
    window.location.assign(`/api/auth/logout?next=${encodeURIComponent(nextAfterLogout)}`)
  }

  async function doSyncPayment() {
    setMsg(null)
    setErr(null)
    setSyncing(true)
    try {
      await fetch("/api/billing/wayforpay/sync", { method: "POST", cache: "no-store", credentials: "include" })
      setMsg("Статус оплаты обновлен")
      window.dispatchEvent(new Event("turbota:refresh"))
      await refresh()
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setSyncing(false)
    }
  }

  async function toggleAutoRenew() {
    setMsg(null)
    setErr(null)
    setActing(true)
    try {
      const url = summary.auto_renew ? "/api/billing/subscription/cancel" : "/api/billing/subscription/resume"
      const r = await fetch(url, { method: "POST", cache: "no-store", credentials: "include" })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(String(d?.error || d?.message || "Action failed"))
      setMsg(summary.auto_renew ? "Автопродление выключено" : "Автопродление включено")
      window.dispatchEvent(new Event("turbota:refresh"))
      await refresh()
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setActing(false)
    }
  }

  async function cancelPromo() {
    setMsg(null)
    setErr(null)
    setActing(true)
    try {
      const r = await fetch("/api/billing/promo/cancel", { method: "POST", cache: "no-store", credentials: "include" })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(String(d?.error || d?.message || "Action failed"))
      setMsg("Промо отключено")
      window.dispatchEvent(new Event("turbota:refresh"))
      await refresh()
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl font-semibold">Профиль</h1>
          <p className="mt-2 text-gray-500">Управление доступом и история</p>
        </div>
        <div className="flex gap-2">
          <Link href="/pricing">
            <button className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50">Тарифы</button>
          </Link>
          <button
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            onClick={doLogout}
          >
            Выйти
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-6">
            <div className="text-xl font-semibold">Аккаунт</div>
            <div className="text-sm text-gray-500">Статус входа и доступ</div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="text-gray-500">Email</div>
              <div className="font-medium">{summary.email ? summary.email : "Гость"}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-500">Доступ</div>
              <div className="font-medium">{accessLabel(summary)}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-500">Осталось вопросов</div>
              <div className="font-medium">{questionsLabel}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-500">Оплачено до</div>
              <div className="font-medium">{fmtDate(summary.paid_until)}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-500">Промо до</div>
              <div className="font-medium">{fmtDate(summary.promo_until)}</div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              className="w-full rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
              onClick={refresh}
              disabled={loading || syncing || acting}
            >
              {loading ? "Обновление..." : "Обновить"}
            </button>

            <button
              className="w-full rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
              onClick={doSyncPayment}
              disabled={syncing || acting}
            >
              {syncing ? "Проверка оплаты..." : "Проверить оплату"}
            </button>

            <button
              className="w-full rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              onClick={() => router.push("/pricing")}
            >
              Открыть тарифы
            </button>
          </div>

          {msg ? <div className="mt-4 text-sm text-emerald-700">{msg}</div> : null}
          {err ? <div className="mt-4 text-sm text-red-600">{err}</div> : null}
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-6">
            <div className="text-xl font-semibold">Управление доступом</div>
            <div className="text-sm text-gray-500">Подписка и промокод</div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="text-gray-500">Статус подписки</div>
              <div className="font-medium">{subscriptionLabel(summary.subscription_status)}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-500">Автопродление</div>
              <div className="font-medium">{summary.auto_renew ? "Включено" : "Выключено"}</div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              className="w-full rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
              onClick={toggleAutoRenew}
              disabled={acting}
            >
              {summary.auto_renew ? "Выключить автопродление" : "Включить автопродление"}
            </button>

            <button
              className="w-full rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
              onClick={cancelPromo}
              disabled={acting || !hasPromo}
              title={!hasPromo ? "Промо не активно" : ""}
            >
              Отключить промокод
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-2 text-xl font-semibold">История</div>
        <div className="text-sm text-gray-500">Сохранённые сессии</div>

        <div className="mt-4 text-sm text-gray-500">
          История отображается для вошедших пользователей. Если история не видна, проверьте логин и обновите страницу.
        </div>
      </div>
    </div>
  )
}
