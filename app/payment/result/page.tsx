"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

type AnyObj = Record<string, any>

function isApproved(data: AnyObj | null) {
  if (!data) return false
  const s = String(data.status ?? data.paymentStatus ?? data.transactionStatus ?? "").toLowerCase()
  if (s.includes("approved") || s.includes("success") || s === "ok") return true
  if (data.ok === true && (data.approved === true || data.paid === true)) return true
  return false
}

export default function PaymentResultPage() {
  const sp = useSearchParams()
  const orderReference = useMemo(() => {
    return (
      sp.get("orderReference") ||
      sp.get("order_reference") ||
      sp.get("order") ||
      sp.get("ref") ||
      ""
    )
  }, [sp])

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnyObj | null>(null)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    let alive = true

    async function run() {
      setLoading(true)
      setError("")
      setData(null)

      try {
        if (!orderReference) {
          setError("Не знайдено orderReference у URL.")
          return
        }

        // 1) пробуем GET ?orderReference=
        const q = new URLSearchParams()
        q.set("orderReference", orderReference)

        let r = await fetch(`/api/billing/orders/status?${q.toString()}`, { cache: "no-store" })

        // 2) если вдруг у вас реализован POST
        if (!r.ok) {
          r = await fetch(`/api/billing/orders/status`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ orderReference, order_reference: orderReference }),
            cache: "no-store",
          })
        }

        const j = (await r.json()) as AnyObj
        if (!alive) return
        setData(j)
      } catch (e: any) {
        if (!alive) return
        setError(String(e?.message || e))
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [orderReference])

  const ok = isApproved(data)
  const reason = String(data?.reason ?? data?.message ?? data?.error ?? "").trim()

  return (
    <div className="min-h-[70vh] w-full">
      <div className="mx-auto max-w-3xl px-4 py-14">
        <div className="rounded-2xl border bg-white/70 p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Результат оплати</h1>

          <div className="mt-2 text-sm text-muted-foreground">
            {orderReference ? (
              <div>
                Чек-код: <span className="font-mono">{orderReference}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="text-sm text-muted-foreground">Перевіряємо статус оплати…</div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
                Помилка перевірки: {error}
                <div className="mt-3 text-muted-foreground">
                  Спробуйте оновити сторінку або повернутися на тарифи.
                </div>
              </div>
            ) : ok ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                Оплату підтверджено. Доступ активовано.
                <div className="mt-2 text-muted-foreground">
                  Порада: збережіть чек-код на випадок звернення в підтримку.
                </div>
                <div className="mt-2 text-muted-foreground">
                  Статус: {String(data?.status ?? "Approved")} {reason ? `• Причина: ${reason}` : ""}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                Оплата не підтверджена або була скасована.
                <div className="mt-2 text-muted-foreground">
                  Перевірте баланс/ліміти карти та спробуйте ще раз.
                </div>
                <div className="mt-2 text-muted-foreground">
                  Статус: {String(data?.status ?? "Not approved")} {reason ? `• Деталі: ${reason}` : ""}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/profile"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-medium text-white"
            >
              Перейти в профіль
            </Link>

            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-xl border px-5 text-sm font-medium"
            >
              Повернутися до тарифів
            </Link>
          </div>

          <div className="mt-6 text-xs text-muted-foreground">
            Якщо гроші списані, але доступ не видався, надішліть в підтримку чек-код.
          </div>
        </div>
      </div>
    </div>
  )
}
