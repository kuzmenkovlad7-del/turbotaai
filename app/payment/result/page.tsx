"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

type SyncResp = {
  ok?: boolean
  final?: boolean
  state?: string
  txStatus?: string
  orderReference?: string
  paidUntil?: string | null
  message?: string
  error?: string
  details?: string
}

type UiState = "checking" | "pending" | "ok" | "fail" | "stopped"

export default function PaymentResultPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const orderReference = sp.get("orderReference") || ""

  const [ui, setUi] = useState<UiState>("checking")
  const [attempt, setAttempt] = useState(0)
  const [msg, setMsg] = useState("Перевіряємо оплату…")
  const [lastState, setLastState] = useState<string>("unknown")

  const maxAttempts = 10

  const canPoll = useMemo(() => Boolean(orderReference), [orderReference])

  useEffect(() => {
    if (!canPoll) {
      setUi("fail")
      setMsg("Невірний чек-код. Поверніться до тарифів і спробуйте оплату ще раз.")
      return
    }

    let alive = true
    let timer: any = null

    const sleepMs = (i: number) => {
      if (i <= 2) return 1200
      if (i <= 5) return 1800
      return 2500
    }

    async function syncOnce(i: number) {
      const url = `/api/billing/wayforpay/sync?orderReference=${encodeURIComponent(orderReference)}`
      try {
        const r = await fetch(url, { method: "POST", cache: "no-store" })
        const j = (await r.json().catch(() => ({}))) as SyncResp

        if (!alive) return

        const st = String(j?.state || "unknown")
        setLastState(st)

        if (j?.ok && st === "paid") {
          setUi("ok")
          setMsg("Оплату підтверджено. Доступ активовано.")
          timer = setTimeout(() => router.replace("/profile?paid=1"), 700)
          return
        }

        if (j?.final && st !== "paid") {
          setUi("fail")
          setMsg(
            j?.message ||
              (st === "failed"
                ? "Оплата не пройшла. Спробуйте іншу картку або повторіть оплату."
                : st === "refunded"
                  ? "Оплату було повернено платіжною системою."
                  : "Оплату не підтверджено.")
          )
          return
        }

        setUi(st === "pending" ? "pending" : "checking")
        setMsg(j?.message || (st === "pending" ? "Платіж обробляється…" : "Перевіряємо оплату…"))

        if (i >= maxAttempts) {
          setUi("stopped")
          setMsg(
            st === "pending"
              ? "Платіж ще обробляється. Натисніть Перевірити знову через 1–2 хвилини."
              : "Не вдалося підтвердити оплату автоматично. Натисніть Перевірити знову."
          )
          return
        }

        timer = setTimeout(() => syncOnce(i + 1), sleepMs(i))
      } catch {
        if (!alive) return
        if (i >= maxAttempts) {
          setUi("stopped")
          setMsg("Не вдалося перевірити оплату. Натисніть Перевірити знову.")
          return
        }
        timer = setTimeout(() => syncOnce(i + 1), sleepMs(i))
      }
    }

    setUi("checking")
    setMsg("Перевіряємо оплату…")
    setAttempt(1)
    syncOnce(1)

    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [canPoll, orderReference, router])

  const showRetry = ui === "fail" || ui === "stopped"
  const showAttempt = ui === "checking" || ui === "pending"

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Результат оплати</h1>

        <div className="mt-2 text-sm text-gray-600">
          Чек-код: <span className="font-mono text-gray-900">{orderReference || "—"}</span>
        </div>

        <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-800">
          {msg}
          {showAttempt ? (
            <div className="mt-2 text-xs text-gray-500">
              Стан: {lastState} · Спроба: {attempt}/{maxAttempts}
            </div>
          ) : null}
        </div>

        {showRetry ? (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => location.reload()}
              className="flex-1 rounded-xl bg-black px-4 py-2 text-white"
            >
              Перевірити знову
            </button>
            <button
              onClick={() => router.replace("/pricing")}
              className="flex-1 rounded-xl border px-4 py-2"
            >
              Тарифи
            </button>
          </div>
        ) : null}

        {ui === "ok" ? (
          <button
            onClick={() => router.replace("/profile?paid=1")}
            className="mt-4 w-full rounded-xl bg-black px-4 py-2 text-white"
          >
            Перейти в профіль
          </button>
        ) : null}
      </div>
    </div>
  )
}
