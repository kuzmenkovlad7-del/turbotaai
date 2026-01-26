"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function readCookie(name: string) {
  if (typeof document === "undefined") return ""
  const m = document.cookie.match(
    new RegExp("(^| )" + name.replace(/[-[\]{}()*+?.,\^$|#\s]/g, "\\$&") + "=([^;]+)")
  )
  return m ? decodeURIComponent(m[2]) : ""
}

export default function PaymentResultPage() {
  const router = useRouter()
  const sp = useSearchParams()

  const [state, setState] = useState<"checking" | "ok" | "fail">("checking")
  const [msg, setMsg] = useState("Підтверджуємо оплату…")
  const [attempt, setAttempt] = useState(0)

  const orderReference = useMemo(() => {
    const q = String(sp.get("orderReference") || "").trim()
    if (q) return q
    const c = readCookie("ta_last_order")
    return String(c || "").trim()
  }, [sp])

  useEffect(() => {
    let alive = true

    async function run() {
      if (!orderReference) {
        setState("fail")
        setMsg("Не вдалося прочитати чек-код оплати. Спробуйте ще раз або поверніться в профіль.")
        return
      }

      for (let i = 1; i <= 10; i++) {
        if (!alive) return
        setAttempt(i)
        setState("checking")
        setMsg(i <= 2 ? "Підтверджуємо оплату…" : `Очікуємо підтвердження… (спроба ${i}/10)`)

        try {
          const r = await fetch(
            `/api/billing/wayforpay/sync?orderReference=${encodeURIComponent(orderReference)}`,
            { method: "GET", cache: "no-store" }
          )
          const json: any = await r.json().catch(() => null)

          const st = String(json?.state || json?.status || "").toLowerCase()
          if (st === "paid") {
            setState("ok")
            setMsg("Оплату підтверджено. Доступ активовано ✅")
            setTimeout(() => router.replace("/profile?paid=1"), 600)
            return
          }

          if (st === "failed" || st === "declined" || st === "refunded") {
            setState("fail")
            setMsg("Оплату не підтверджено. Якщо Ви оплатили, спробуйте ще раз або зверніться в підтримку.")
            return
          }
        } catch {}

        await new Promise((x) => setTimeout(x, 1200))
      }

      setState("fail")
      setMsg("Оплату поки не підтверджено. Якщо Ви оплатили, натисніть Перевірити знову.")
    }

    run()
    return () => {
      alive = false
    }
  }, [orderReference, router])

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Результат оплати</h1>

        <div className="mt-2 text-sm text-gray-600">
          Чек-код: <span className="font-mono text-gray-900">{orderReference || "—"}</span>
        </div>

        <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-800">
          {msg}
          {state === "checking" ? (
            <div className="mt-2 text-xs text-gray-500">Спроба: {attempt}/10</div>
          ) : null}
        </div>

        {state === "fail" ? (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => location.reload()}
              className="flex-1 rounded-xl bg-black px-4 py-2 text-white"
            >
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
