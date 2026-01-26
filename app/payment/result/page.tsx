"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

type CheckResp = {
  ok?: boolean
  status?: string
  paid?: boolean
  error?: string
}

export default function PaymentResultPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const orderReference = sp.get("orderReference") || ""

  const [state, setState] = useState<"checking" | "ok" | "fail">("checking")
  const [msg, setMsg] = useState("Перевіряємо оплату…")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true

    async function syncAccess() {
      if (!orderReference) return
      const url = `/api/billing/wayforpay/sync?orderReference=${encodeURIComponent(orderReference)}`
      try {
        const r = await fetch(url, { method: "POST", cache: "no-store" })
        if (r.status === 405) {
          await fetch(url, { method: "GET", cache: "no-store" })
        }
      } catch {}
    }

    async function checkOnce() {
      if (!orderReference) {
        setState("fail")
        setMsg("Не знайдено чек-код замовлення.")
        return
      }

      try {
        const r = await fetch(
          `/api/billing/wayforpay/check?orderReference=${encodeURIComponent(orderReference)}`,
          { cache: "no-store" }
        )
        const j = (await r.json()) as CheckResp

        const paid =
          j?.paid === true ||
          String(j?.status || "").toLowerCase() === "paid" ||
          String(j?.status || "").toLowerCase() === "approved"

        if (paid) {
          await syncAccess()
          if (!alive) return
          setState("ok")
          setMsg("Оплату підтверджено. Доступ активовано ✅")
          setTimeout(() => router.replace("/profile?paid=1"), 500)
          return
        }

        if (!alive) return
        setMsg("Оплату поки не підтверджено. Якщо Ви оплатили, зачекайте або натисніть Перевірити знову.")
      } catch (e: any) {
        if (!alive) return
        setMsg("Помилка перевірки оплати. Натисніть Перевірити знову.")
      }
    }

    async function run() {
      setState("checking")
      setMsg("Перевіряємо оплату…")

      for (let i = 1; i <= 10; i++) {
        if (!alive) return
        setAttempt(i)
        await checkOnce()
        if (!alive) return
        if (state === "ok") return
        await new Promise((r) => setTimeout(r, 1500))
      }

      if (!alive) return
      setState("fail")
      setMsg("Оплату не підтверджено. Якщо Ви оплатили — натисніть Перевірити знову.")
    }

    run()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderReference])

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
        </div>

        {state === "fail" ? (
          <div className="mt-4 flex gap-2">
            <button onClick={() => location.reload()} className="flex-1 rounded-xl bg-black px-4 py-2 text-white">
              Перевірити знову
            </button>
            <button onClick={() => router.replace("/pricing")} className="flex-1 rounded-xl border px-4 py-2">
              Тарифи
            </button>
          </div>
        ) : null}

        {state === "ok" ? (
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
