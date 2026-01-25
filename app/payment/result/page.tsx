"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"

type SyncState = "idle" | "loading" | "ok" | "fail"

export default function PaymentResultPage() {
  const router = useRouter()
  const sp = useSearchParams()

  const orderReference = useMemo(() => {
    const v = sp.get("orderReference")
    return (v ?? "").trim()
  }, [sp])

  const [state, setState] = useState<SyncState>("idle")
  const [msg, setMsg] = useState<string>("")

  useEffect(() => {
    if (!orderReference) {
      setState("fail")
      setMsg("Не знайдено номер замовлення. Поверніться в профіль і оновіть сторінку.")
      return
    }

    let cancelled = false

    ;(async () => {
      setState("loading")
      setMsg("Перевіряємо оплату...")

      const res = await fetch(`/api/billing/wayforpay/sync?orderReference=${encodeURIComponent(orderReference)}`, {
        cache: "no-store",
      }).catch(() => null)

      const json: any = await res?.json().catch(() => null)

      if (cancelled) return

      if (json?.ok) {
        setState("ok")
        setMsg("Оплата підтверджена. Доступ оновлено.")
        setTimeout(() => router.replace("/profile?paid=1"), 800)
        return
      }

      setState("fail")
      setMsg(json?.message || "Не вдалося підтвердити оплату. Спробуйте оновити сторінку або відкрийте профіль.")
    })()

    return () => {
      cancelled = true
    }
  }, [orderReference, router])

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Результат оплати</CardTitle>
          <CardDescription className="break-all">Замовлення: {orderReference || "—"}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {state === "loading" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{msg}</span>
            </div>
          ) : null}

          {state === "ok" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              <span>{msg}</span>
            </div>
          ) : null}

          {state === "fail" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>{msg}</span>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border border-slate-200"
              onClick={() => router.push("/profile")}
            >
              Відкрити профіль
            </Button>

            <Button
              className="bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => router.push("/pricing")}
            >
              Тарифи
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
