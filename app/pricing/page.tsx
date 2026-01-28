"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n/language-context"

type AnyObj = Record<string, any>

const PRICE_UAH = Number(process.env.NEXT_PUBLIC_PRICE_UAH || "499")
const CURRENCY = String(process.env.NEXT_PUBLIC_CURRENCY || "UAH")

const PENDING_PROMO_KEY = "turbota_promo_pending"

function isActiveDate(v: any) {
  if (!v) return false
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() > Date.now()
}

function fmtDateDMY(v: any) {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
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

export default function PricingPage() {
  const { currentLanguage } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()

  const lang = useMemo(() => {
    const code = String(currentLanguage?.code || "uk").toLowerCase()
    return code.startsWith("ru") ? "ru" : code.startsWith("en") ? "en" : "uk"
  }, [currentLanguage?.code])

  const copy = useMemo(() => {
    const c = {
      uk: {
        title: "Тарифи",
        subtitle: "Безлімітний доступ до чату, голосу та відео. Пробний режим має 5 запитань.",
        planTitle: "Щомісяця",
        planDesc: "Безлімітний доступ до чату, голосу і відео",
        p1: "Безлімітна кількість запитів",
        p2: "Чат, голос і відео",
        p3: "Історія зберігається у профілі",
        subscribe: "Підписатися",
        opening: "Відкриваємо оплату...",
        invoiceOpened: "Оплата відкрита. Завершіть оплату у WayForPay.",
        payFailed: "Не вдалося створити оплату",
        statusTitle: "Статус доступу",
        statusDesc: "Перевірка доступу та ліміту",
        guest: "Гість",
        loggedIn: "Вхід виконано",
        access: "Доступ",
        accessFree: "Безкоштовно",
        accessPromo: "Промокод",
        accessUnlimited: "Безліміт",
        questionsLeft: "Залишилось запитань",
        unlimited: "Безлімітно",
        accessUntil: "Доступ до",
        openProfile: "Відкрити профіль",
        logout: "Вийти",
        promoTitle: "Промокод",
        promoDesc: "12 місяців безкоштовного доступу за промокодом",
        promoPh: "Промокод",
        promoActivate: "Активувати промо",
        promoActivating: "Активуємо...",
        promoNeedLogin: "Активація промокоду потребує входу. Після входу промокод застосовується автоматично.",
        promoOk: "Промокод активовано",
      },
      ru: {
        title: "Тарифы",
        subtitle: "Безлимитный доступ к чату, голосу и видео. Пробный режим включает 5 вопросов.",
        planTitle: "Ежемесячно",
        planDesc: "Безлимитный доступ к чату, голосу и видео",
        p1: "Безлимитное количество запросов",
        p2: "Чат, голос и видео",
        p3: "История сохраняется в профиле",
        subscribe: "Подписаться",
        opening: "Открываем оплату...",
        invoiceOpened: "Оплата открыта. Завершите оплату в WayForPay.",
        payFailed: "Не удалось создать оплату",
        statusTitle: "Статус доступа",
        statusDesc: "Проверка доступа и лимита",
        guest: "Гость",
        loggedIn: "Вход выполнен",
        access: "Доступ",
        accessFree: "Бесплатно",
        accessPromo: "Промокод",
        accessUnlimited: "Безлимит",
        questionsLeft: "Осталось вопросов",
        unlimited: "Безлимитно",
        accessUntil: "Доступ до",
        openProfile: "Открыть профиль",
        logout: "Выйти",
        promoTitle: "Промокод",
        promoDesc: "12 месяцев бесплатного доступа по промокоду",
        promoPh: "Промокод",
        promoActivate: "Активировать промо",
        promoActivating: "Активируем...",
        promoNeedLogin: "Активация промокода требует входа. После входа промокод применится автоматически.",
        promoOk: "Промокод активирован",
      },
      en: {
        title: "Pricing",
        subtitle: "Unlimited access to chat, voice and video. Trial includes 5 questions.",
        planTitle: "Monthly",
        planDesc: "Unlimited chat, voice and video access",
        p1: "Unlimited questions",
        p2: "Chat, voice and video",
        p3: "History saved in your profile",
        subscribe: "Subscribe",
        opening: "Opening...",
        invoiceOpened: "Payment opened. Complete it in WayForPay.",
        payFailed: "Payment init failed",
        statusTitle: "Access status",
        statusDesc: "Check access and limits",
        guest: "Guest",
        loggedIn: "Logged in",
        access: "Access",
        accessFree: "Free",
        accessPromo: "Promo",
        accessUnlimited: "Unlimited",
        questionsLeft: "Questions left",
        unlimited: "Unlimited",
        accessUntil: "Access until",
        openProfile: "Open profile",
        logout: "Log out",
        promoTitle: "Promo code",
        promoDesc: "12 months free access by promo code",
        promoPh: "Promo code",
        promoActivate: "Activate promo",
        promoActivating: "Activating...",
        promoNeedLogin: "Promo activation requires login. After login it will apply automatically.",
        promoOk: "Promo activated",
      },
    }
    return c[lang as "uk" | "ru" | "en"]
  }, [lang])

  const [summary, setSummary] = useState<AnyObj | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(true)

  const [payLoading, setPayLoading] = useState(false)
  const [payMsg, setPayMsg] = useState<string | null>(null)

  const [promoCode, setPromoCode] = useState("")
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoMsg, setPromoMsg] = useState<string | null>(null)

  const triedPendingRef = useRef(false)

  const isLoggedIn = Boolean(summary?.isLoggedIn ?? summary?.loggedIn ?? summary?.user)

  const accessRaw = String(summary?.access ?? "").toLowerCase()
  const paidUntilRaw = summary?.paidUntil ?? summary?.paid_until ?? null
  const promoUntilRaw = summary?.promoUntil ?? summary?.promo_until ?? null

  const hasPaid = accessRaw === "paid" || isActiveDate(paidUntilRaw)
  const hasPromo = accessRaw === "promo" || isActiveDate(promoUntilRaw)
  const unlimited = Boolean(summary?.unlimited) || hasPaid || hasPromo

  const questionsLeftNum = Number(
    summary?.questionsLeft ??
      summary?.questions_left ??
      summary?.trialLeft ??
      summary?.trial_left ??
      summary?.trial_questions_left ??
      summary?.trialQuestionsLeft ??
      0
  )
  const questionsLeft = Number.isFinite(questionsLeftNum) ? questionsLeftNum : 0

  const accessLabel = hasPaid ? copy.accessUnlimited : hasPromo ? copy.accessPromo : copy.accessFree
  const accessUntilPretty = fmtDateDMY(hasPaid ? paidUntilRaw : hasPromo ? promoUntilRaw : null) || null
  const questionsLabel = unlimited ? copy.unlimited : String(questionsLeft)

  async function refreshSummary() {
    setLoadingSummary(true)
    try {
      const d = await loadCombinedSummary()
      setSummary(d)
    } catch {
      setSummary(null)
    } finally {
      setLoadingSummary(false)
    }
  }

  useEffect(() => {
    refreshSummary()
  }, [])

  useEffect(() => {
    const onRefresh = () => refreshSummary()
    window.addEventListener("turbota:refresh", onRefresh)
    return () => window.removeEventListener("turbota:refresh", onRefresh)
  }, [])

  async function doLogout() {
    window.location.assign("/api/auth/logout?next=/pricing")
  }

  async function handleSubscribe() {
    setPayMsg(null)
    setPayLoading(true)

    try {
      const r = await fetch("/api/billing/wayforpay/create-invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ planId: "monthly", amount: PRICE_UAH, currency: CURRENCY }),
      })

      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d?.invoiceUrl) throw new Error(d?.error || copy.payFailed)

      window.location.assign(String(d.invoiceUrl))
      setPayMsg(copy.invoiceOpened)
    } catch (e: any) {
      setPayMsg(e?.message || copy.payFailed)
    } finally {
      setPayLoading(false)
    }
  }

  async function redeemPromo(code: string) {
    const clean = String(code || "").trim()
    if (!clean) {
      setPromoMsg(copy.payFailed)
      return
    }

    setPromoLoading(true)
    setPromoMsg(null)

    try {
      const r = await fetch("/api/billing/promo/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ code: clean }),
      })
      const d = await r.json().catch(() => ({}))

      if (!r.ok) {
        const msg = String(d?.error || d?.message || "Promo failed")
        throw new Error(msg)
      }

      setPromoMsg(copy.promoOk)
      try {
        sessionStorage.removeItem(PENDING_PROMO_KEY)
      } catch {}

      window.dispatchEvent(new Event("turbota:refresh"))
      await refreshSummary()
    } catch (e: any) {
      setPromoMsg(String(e?.message || "Promo failed"))
    } finally {
      setPromoLoading(false)
    }
  }

  async function handleActivatePromo() {
    setPromoMsg(null)

    const code = String(promoCode || "").trim()
    if (!code) return

    if (!isLoggedIn) {
      try {
        sessionStorage.setItem(PENDING_PROMO_KEY, code)
      } catch {}
      setPromoMsg(copy.promoNeedLogin)
      router.push("/login?next=/pricing&promo=1")
      return
    }

    await redeemPromo(code)
  }

  useEffect(() => {
    if (!isLoggedIn) return
    if (triedPendingRef.current) return

    triedPendingRef.current = true

    let pending = ""
    try {
      pending = String(sessionStorage.getItem(PENDING_PROMO_KEY) || "").trim()
    } catch {}

    if (pending) {
      setPromoCode(pending)
      redeemPromo(pending)
    }
  }, [isLoggedIn])

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-10">
        <h1 className="text-4xl font-semibold">{copy.title}</h1>
        <p className="mt-2 text-gray-500">{copy.subtitle}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">{copy.planTitle}</CardTitle>
            <CardDescription>{copy.planDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <div className="text-5xl font-semibold">{PRICE_UAH}</div>
              <div className="pb-2 text-gray-500">{CURRENCY} / {lang === "en" ? "month" : "місяць"}</div>
            </div>

            <ul className="mt-6 space-y-2 text-sm text-gray-700">
              <li>• {copy.p1}</li>
              <li>• {copy.p2}</li>
              <li>• {copy.p3}</li>
            </ul>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button className="h-12 rounded-xl" onClick={handleSubscribe} disabled={payLoading}>
                {payLoading ? copy.opening : copy.subscribe}
              </Button>

              <Link href="/profile" className="sm:ml-auto">
                <Button className="h-12 rounded-xl" variant="outline">
                  {copy.openProfile}
                </Button>
              </Link>
            </div>

            {payMsg ? <div className="mt-4 text-sm text-gray-700">{payMsg}</div> : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xl">{copy.statusTitle}</CardTitle>
            <CardDescription>{copy.statusDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="text-gray-500">Status</div>
              <div className="font-medium">{isLoggedIn ? copy.loggedIn : copy.guest}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-500">{copy.access}</div>
              <div className="font-medium">{accessLabel}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-500">{copy.questionsLeft}</div>
              <div className="font-medium">{questionsLabel}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-gray-500">{copy.accessUntil}</div>
              <div className="font-medium">{accessUntilPretty || "—"}</div>
            </div>

            <div className="pt-2">
              <Button className="w-full rounded-xl" variant="outline" onClick={refreshSummary} disabled={loadingSummary}>
                {loadingSummary ? "..." : "Refresh"}
              </Button>
            </div>

            {isLoggedIn ? (
              <div>
                <Button className="w-full rounded-xl" variant="outline" onClick={doLogout}>
                  {copy.logout}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xl">{copy.promoTitle}</CardTitle>
            <CardDescription>{copy.promoDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder={copy.promoPh}
              className="h-12"
            />
            <Button className="h-12 w-full rounded-xl" onClick={handleActivatePromo} disabled={promoLoading}>
              {promoLoading ? copy.promoActivating : copy.promoActivate}
            </Button>
            {promoMsg ? <div className="text-sm text-gray-700">{promoMsg}</div> : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xl">Тест</CardTitle>
            <CardDescription>Для чистої перевірки відкрийте інкогніто</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 space-y-2">
            <div>Инкогнито создает новый device hash, поэтому пробный режим и доступ начинаются с нуля.</div>
            <div>После оплаты переходите в профиль и нажимайте Проверить оплату, если доступ не обновился сразу.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
