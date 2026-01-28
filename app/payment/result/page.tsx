"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type AnyObj = Record<string, any>

function pickOrderRef(sp: ReturnType<typeof useSearchParams>) {
  const keys = ["orderReference", "order_reference", "order", "ref", "merchantTransactionSecureType"]
  for (const k of keys) {
    const v = sp?.get(k)
    if (v) return v
  }
  // WayForPay часто возвращает orderReference
  return sp?.get("orderReference") || null
}

export default function PaymentResultPage() {
  const router = useRouter()
  const sp = useSearchParams()

  const orderReference = useMemo(() => pickOrderRef(sp), [sp])
  const [state, setState] = useState<"checking" | "ok" | "fail">("checking")
  const [msg, setMsg] = useState<string | null>(null)
  const [details, setDetails] = useState<AnyObj | null>(null)

  useEffect(() => {
    let alive = true

    async function run() {
      setState("checking")
      setMsg(null)
      setDetails(null)

      if (!orderReference) {
        setState("fail")
        setMsg("Не найден orderReference в URL. Откройте страницу из возврата WayForPay или проверьте параметры.")
        return
      }

      try {
        // 1) синхронизируем оплату (это то, что ты делал вручную через /sync)
        const url = `/api/billing/wayforpay/sync?orderReference=${encodeURIComponent(orderReference)}`
        const r = await fetch(url, { cache: "no-store", credentials: "include" })
        const j = await r.json().catch(() => ({}))

        if (!r.ok || !j?.ok) {
          throw new Error(j?.error || j?.reason || "Sync failed")
        }

        if (!alive) return

        // 2) обновляем UI по всему приложению
        try {
          window.dispatchEvent(new Event("turbota:refresh"))
        } catch {}

        setState("ok")
        setDetails(j)

        // 3) уводим на профиль без “paid=1”, чтобы не было ложной отрисовки
        router.replace("/profile")
      } catch (e: any) {
        if (!alive) return
        setState("fail")
        setMsg(String(e?.message || e))
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [orderReference, router])

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Оплата</CardTitle>
          <CardDescription>
            {state === "checking"
              ? "Проверяем статус оплаты..."
              : state === "ok"
              ? "Оплата подтверждена. Переходим в профиль."
              : "Не удалось подтвердить оплату."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {orderReference ? (
            <div className="text-sm text-gray-600">
              orderReference: <span className="font-mono">{orderReference}</span>
            </div>
          ) : null}

          {msg ? <div className="text-sm text-red-600">{msg}</div> : null}

          {state === "fail" ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => window.location.reload()}>Повторить</Button>
              <Button variant="outline" onClick={() => router.push("/profile")}>
                Открыть профиль
              </Button>
              <Button variant="outline" onClick={() => router.push("/pricing")}>
                Тарифы
              </Button>
            </div>
          ) : null}

          {details ? (
            <pre className="max-h-72 overflow-auto rounded-lg bg-gray-50 p-3 text-xs">
              {JSON.stringify(details, null, 2)}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
