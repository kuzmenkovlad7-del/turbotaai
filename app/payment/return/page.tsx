"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

type Order = {
  order_reference: string
  status: string
  amount?: number
  currency?: string
  updated_at?: string
}

export default function PaymentReturnPage() {
  const sp = useSearchParams()
  const orderReference = sp.get("orderReference") || ""

  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orderReference) {
      setLoading(false)
      setError("Missing orderReference")
      return
    }

    let stopped = false
    let tries = 0

    const tick = async () => {
      tries += 1
      try {
        const res = await fetch(`/api/billing/orders/status?orderReference=${encodeURIComponent(orderReference)}`, {
          cache: "no-store",
        })
        const j = await res.json()
        if (!stopped) {
          setOrder(j?.order || null)
          setError(j?.ok ? null : (j?.error || "Unknown error"))
          setLoading(false)
        }

        const st = (j?.order?.status || "").toLowerCase()
        if (st === "paid" || st === "failed" || st === "refunded" || st === "expired") {
          return
        }

        // ещё ждём подтверждение webhook
        if (tries < 20) setTimeout(tick, 1500)
      } catch (e: any) {
        if (!stopped) {
          setLoading(false)
          setError(e?.message || "Request failed")
        }
      }
    }

    tick()
    return () => { stopped = true }
  }, [orderReference])

  const status = (order?.status || "").toLowerCase()
  const isPaid = status === "paid"

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 shadow-xl">
        <div className="text-xl font-semibold">TurbotaAI Payment</div>
        <div className="mt-2 text-sm text-neutral-400 break-all">
          Order: {orderReference || "—"}
        </div>

        <div className="mt-6">
          {loading && (
            <div className="text-neutral-300">Checking payment status...</div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-red-200">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4">
              <div className="text-sm text-neutral-400">Status</div>
              <div className="mt-1 text-lg font-semibold">
                {order?.status || "unknown"}
              </div>

              {order?.amount != null && (
                <div className="mt-2 text-sm text-neutral-400">
                  Amount: {order.amount} {order.currency || ""}
                </div>
              )}

              <div className="mt-3 text-xs text-neutral-500">
                Updated: {order?.updated_at || "—"}
              </div>

              {!isPaid && (
                <div className="mt-3 text-sm text-neutral-300">
                  If you just paid, webhook confirmation may take a few seconds. This page refreshes automatically.
                </div>
              )}

              {isPaid && (
                <div className="mt-3 text-sm text-green-300">
                  Payment confirmed ✅
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <a
            className="inline-flex items-center justify-center rounded-xl bg-white text-black px-4 py-2 text-sm font-medium hover:opacity-90"
            href={`/payment/return?orderReference=${encodeURIComponent(orderReference)}`}
          >
            Refresh
          </a>

          <Link
            className="inline-flex items-center justify-center rounded-xl border border-neutral-700 px-4 py-2 text-sm font-medium hover:bg-neutral-800"
            href="/"
          >
            Back to site
          </Link>
        </div>
      </div>
    </div>
  )
}
