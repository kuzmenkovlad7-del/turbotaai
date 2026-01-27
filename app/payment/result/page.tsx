"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

type SyncResp = {
  ok?: boolean
  state?: "paid" | "pending" | "failed" | "refunded" | "unknown"
  orderReference?: string
  txStatus?: string
  reason?: string
  reasonCode?: any
  retryable?: boolean
  paid_until?: string | null
  error?: string
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export default function PaymentResultPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const orderReference = sp.get("orderReference") || ""

  const [runId, setRunId] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<"checking" | "paid" | "pending" | "failed" | "unknown">("checking")
  const [msg, setMsg] = useState("Перевіряємо оплату…")
  const [details, setDetails] = useState<string | null>(null)

  const canRun = useMemo(() => Boolean(orderReference), [orderReference])

  useEffect(() => {
    if (!canRun) {
      setState("unknown")
      setMsg("Немає коду платежу. Поверніться до тарифів і спробуйте ще раз.")
      return
    }

    let alive = true
    const MAX = 10

    async function syncOnce() {
      const url = `/api/billing/wayforpay/sync?orderReference=${encodeURIComponent(orderReference)}`
      const r = await fetch(url, { method: "POST", cache: "no-store" })
      const j = (await r.json().catch(() => ({}))) as SyncResp
      return j
    }

    async function run() {
      setAttempt(0)
      setDetails(null)
      setState("checking")
      setMsg("Перевіряємо оплату…")

      for (let i = 1; i <= MAX; i++) {
        if (!alive) return
        setAttempt(i)

        let j: SyncResp | null = null
        try {
          j = await syncOnce()
        } catch {
          j = { ok: false, state: "unknown", retryable: true }
        }

        if (!alive) return

        const st = j?.state || "unknown"
        const reason = (j?.reason || "").trim()
        const tx = (j?.txStatus || "").trim()

        if (reason || tx) {
          const s = [tx ? `Статус: ${tx}` : "", reason ? `Причина: ${reason}` : ""].filter(Boolean).join(" • ")
          setDetails(s || null)
        } else {
          setDetails(null)
        }

        if (st === "paid" && j?.ok) {
          setState("paid")
          setMsg("Оплату підтверджено. Доступ активовано.")
          setTimeout(() => router.replace("/profile?paid=1"), 600)
          return
        }

        if (st === "failed" || st === "refunded") {
          setState("failed")
          setMsg("Оплату не прийнято. Спробуйте іншу картку або повторіть оплату.")
          return
        }

        if (st === "pending") {
          setState("pending")
          setMsg("Оплата в обробці. Зазвичай це займає до кількох хвилин.")
        } else {
          setState("checking")
          setMsg("Оплату поки не підтверджено. Якщо Ви оплатили, зачекайте або натисніть Перевірити знову.")
        }

        await sleep(1500)
      }

      if (!alive) return

      if (state === "pending") {
        setState("pending")
        setMsg("Оплата все ще в обробці. Спробуйте перевірити пізніше або натисніть Перевірити знову.")
      } else {
        setState("unknown")
        setMsg("Не вдалося підтвердити оплату автоматично. Натисніть Перевірити знову.")
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [orderReference, router, runId])

  const showButtons = state === "failed" || state === "unknown" || state === "pending"

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Результат оплати</h1>

        <div className="mt-2 text-sm text-gray-600">
          Чек-код: <span className="font-mono text-gray-900">{orderReference || "—"}</span>
        </div>

        <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-800">
          {msg}
          {state === "checking" ? <div className="mt-2 text-xs text-gray-500">Спроба: {attempt}/10</div> : null}
          {details ? <div className="mt-2 text-xs text-gray-500">{details}</div> : null}
        </div>

        {showButtons ? (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setRunId((v) => v + 1)}
              className="flex-1 rounded-xl bg-black px-4 py-2 text-white"
            >
              Перевірити знову
            </button>
            <button onClick={() => router.replace("/pricing")} className="flex-1 rounded-xl border px-4 py-2">
              Тарифи
            </button>
          </div>
        ) : null}

        {state === "paid" ? (
          <button
            onClick={() => router.replace("/profile?paid=1")}
            className="mt-4 w-full rounded-xl bg-black px-4 py-2 text-white"
          >
            Перейти в профіль
          </button>
        ) : null}

        <div className="mt-4 text-xs text-gray-500">
          Порада: щоб не втратити доступ при очищенні cookie, увійдіть або зареєструйтесь і привʼяжіть доступ до акаунта.
        </div>
      </div>
    </div>
  )
}
