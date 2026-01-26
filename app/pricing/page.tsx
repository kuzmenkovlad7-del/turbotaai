"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { RainbowButton } from "@/components/ui/rainbow-button"
import TurbotaHoloCard from "@/components/turbota-holo-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n/language-context"

type AnyObj = Record<string, any>

const PRICE_UAH = Number(process.env.NEXT_PUBLIC_PRICE_UAH || "499")
const CURRENCY = String(process.env.NEXT_PUBLIC_CURRENCY || "UAH")

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

function clearClientAuthStorage() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) localStorage.removeItem(k)
    }
  } catch {}
  try {
    sessionStorage.removeItem("turbota_paywall")
    sessionStorage.removeItem("turbota_conv_id")
  } catch {}
}

export default function PricingPage() {
  const { currentLanguage } = useLanguage()
  const router = useRouter()

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
        uah: "UAH",
        p1: "Безлімітна кількість запитів",
        p2: "Чат, голос і відео",
        p3: "Історія зберігається у профілі",
        subscribe: "Підписатися",
        opening: "Відкриваємо оплату...",
        invoiceOpened: "Оплата відкрита. Завершіть оплату у WayForPay.",
        payFailed: "Не вдалося створити оплату",
        profileTitle: "Ваш профіль",
        profileDesc: "Перевірити доступ і історію",
        status: "Статус",
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
        promoNeedLogin: "Активація промокоду потребує входу.",
        promoOk: "Промокод активовано",
        manageTitle: "Керувати доступом",
        manageDesc: "Підписка та промо в профілі",
        openManage: "Відкрити керування",
        manageNeedLogin: "Щоб керувати доступом, потрібно увійти.",
      },
      ru: {
        title: "Тарифы",
        subtitle: "Безлимитный доступ к чату, голосу и видео. Пробный режим включает 5 вопросов.",
        planTitle: "Ежемесячно",
        planDesc: "Безлимитный доступ к чату, голосу и видео",
        uah: "UAH",
        p1: "Безлимитное количество запросов",
        p2: "Чат, голос и видео",
        p3: "История сохраняется в профиле",
        subscribe: "Подписаться",
        opening: "Открываем оплату...",
        invoiceOpened: "Оплата открыта. Завершите оплату в WayForPay.",
        payFailed: "Не удалось создать оплату",
        profileTitle: "Ваш профиль",
        profileDesc: "Проверить доступ и историю",
        status: "Статус",
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
        promoNeedLogin: "Активация промокода требует входа.",
        promoOk: "Промокод активирован",
        manageTitle: "Управлять доступом",
        manageDesc: "Подписка и промо в профиле",
        openManage: "Открыть управление",
        manageNeedLogin: "Чтобы управлять доступом, нужно войти.",
      },
      en: {
        title: "Pricing",
        subtitle: "Unlimited access to chat, voice and video. Trial includes 5 questions.",
        planTitle: "Monthly",
        planDesc: "Unlimited chat, voice and video access",
        uah: "UAH",
        p1: "Unlimited questions",
        p2: "Chat, voice and video",
        p3: "History saved in your profile",
        subscribe: "Subscribe",
        opening: "Opening...",
        invoiceOpened: "Payment opened. Complete it in WayForPay.",
        payFailed: "Payment init failed",
        profileTitle: "Your profile",
        profileDesc: "Check access and history",
        status: "Status",
        guest: "Guest",
        loggedIn: "Logged in",
        access: "Access",
        accessFree: "Free",
        accessPromo: "Promo code",
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
        promoNeedLogin: "Promo activation requires login.",
        promoOk: "Promo activated",
        manageTitle: "Manage access",
        manageDesc: "Subscription & promo in profile",
        openManage: "Open management",
        manageNeedLogin: "Please sign in to manage access.",
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

  const isLoggedIn = Boolean(summary?.isLoggedIn ?? summary?.loggedIn ?? summary?.user)

  const trialLeftNum = Number(
    summary?.trialLeft ?? summary?.trial_left ?? summary?.trial_questions_left ?? summary?.trialQuestionsLeft ?? 0
  )
  const trialLeft = Number.isFinite(trialLeftNum) ? trialLeftNum : 0

  const accessRaw = String(summary?.access ?? "")
  const paidUntilRaw = summary?.paidUntil ?? summary?.paid_until ?? null
  const promoUntilRaw = summary?.promoUntil ?? summary?.promo_until ?? null

  const paidActive = accessRaw === "Paid" || (Boolean(summary?.hasAccess) && isActiveDate(paidUntilRaw))
  const promoActive = accessRaw === "Promo" || isActiveDate(promoUntilRaw)

  const accessLabel = paidActive ? copy.accessUnlimited : promoActive ? copy.accessPromo : copy.accessFree

  const accessUntilPretty = fmtDateDMY(summary?.accessUntil ?? summary?.access_until) || null
  const questionsLabel = paidActive || promoActive ? copy.unlimited : String(trialLeft)

  useEffect(() => {
    let alive = true

    async function load() {
      setLoadingSummary(true)
      try {
        const r = await fetch("/api/account/summary", { cache: "no-store", credentials: "include" })
        const d = await r.json().catch(() => ({}))
        if (alive) setSummary(d)
      } catch {
        if (alive) setSummary(null)
      } finally {
        if (alive) setLoadingSummary(false)
      }
    }

    load()
    return () => {
      alive = false
    }
  }, [])

  async function doLogout() {
    try {
      await fetch(`/api/auth/clear?next=${encodeURIComponent("/pricing")}`, { method: "POST" })
    } catch {}
    clearClientAuthStorage()
    window.location.assign("/pricing")
  }

  async function handleSubscribe() {
    setPayMsg(null)
    setPayLoading(true)

    try {
      const r = await fetch("/api/billing/wayforpay/create-invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
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

  async function handleActivatePromo() {
    setPromoMsg(null)

    if (!isLoggedIn) {
      setPromoMsg(copy.promoNeedLogin)
      router.push("/login?next=/pricing")
      return
    }

    setPromoLoading(true)

    try {
      const r = await fetch("/api/billing/promo/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: promoCode.trim() }),
      })

      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.error || "Promo activation failed")

      setPromoMsg(copy.promoOk)

      const s = await fetch("/api/account/summary", { cache: "no-store", credentials: "include" }).then((x) => x.json())
      setSummary(s)
      setPromoCode("")
    } catch (e: any) {
      setPromoMsg(e?.message || "Promo activation failed")
    } finally {
      setPromoLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-4xl font-semibold">{copy.title}</h1>
      <p className="mt-2 text-muted-foreground">{copy.subtitle}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl">{copy.planTitle}</CardTitle>
            <CardDescription>{copy.planDesc}</CardDescription>
          </CardHeader>

          <CardContent className="pb-8">
            <div className="flex items-end gap-3">
              <div className="text-6xl font-bold leading-none">{Number.isFinite(PRICE_UAH) ? PRICE_UAH : 499}</div>
              <div className="pb-1 text-muted-foreground">{copy.uah}</div>
            </div>

            <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>{copy.p1}</li>
              <li>{copy.p2}</li>
              <li>{copy.p3}</li>
            </ul>

            <div className="mt-6 py-4">
              <div role="button" tabIndex={0} onClick={handleSubscribe} className="cursor-pointer" title={copy.subscribe}>
                <TurbotaHoloCard title="TurbotaAI" subtitle="TurbotaAI Monthly" height={260} />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <RainbowButton
                id="turbota-subscribe"
                onClick={handleSubscribe}
                disabled={payLoading}
                className="border border-slate-200"
              >
                {payLoading ? copy.opening : copy.subscribe}
              </RainbowButton>

              {payMsg ? <p className="text-sm text-muted-foreground">{payMsg}</p> : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">{copy.profileTitle}</CardTitle>
              <CardDescription>{copy.profileDesc}</CardDescription>
            </CardHeader>

            <CardContent className="pb-8">
              <div className="grid gap-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>{copy.status}</span>
                  <span className="text-slate-900">{loadingSummary ? "…" : isLoggedIn ? copy.loggedIn : copy.guest}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>{copy.access}</span>
                  <span className="text-slate-900">{loadingSummary ? "…" : accessLabel}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>{copy.questionsLeft}</span>
                  <span className="text-slate-900">{loadingSummary ? "…" : questionsLabel}</span>
                </div>

                {(summary?.accessUntil || summary?.access_until) && (
                  <div className="flex items-center justify-between">
                    <span>{copy.accessUntil}</span>
                    <span className="text-slate-900">{loadingSummary ? "…" : accessUntilPretty || "—"}</span>
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Button variant="outline" className="border border-slate-200" onClick={() => router.push("/profile")}>
                  {copy.openProfile}
                </Button>

                {isLoggedIn ? (
                  <Button variant="outline" className="border border-slate-200" onClick={doLogout}>
                    {copy.logout}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="border border-slate-200"
                    onClick={() => router.push("/login?next=/pricing")}
                  >
                    Login
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">{copy.promoTitle}</CardTitle>
              <CardDescription>{copy.promoDesc}</CardDescription>
            </CardHeader>

            <CardContent className="pb-8">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <Input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder={copy.promoPh}
                  autoCapitalize="characters"
                />

                <Button
                  onClick={handleActivatePromo}
                  disabled={promoLoading || !promoCode.trim()}
                  className="border border-slate-200"
                  variant="outline"
                >
                  {promoLoading ? copy.promoActivating : copy.promoActivate}
                </Button>
              </div>

              {!isLoggedIn ? <div className="mt-2 text-xs text-muted-foreground">{copy.promoNeedLogin}</div> : null}
              {promoMsg ? <p className="mt-2 text-sm text-muted-foreground">{promoMsg}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">{copy.manageTitle}</CardTitle>
              <CardDescription>{copy.manageDesc}</CardDescription>
            </CardHeader>

            <CardContent className="pb-8">
              <Button
                variant="outline"
                className="w-full border border-slate-200"
                onClick={() => (isLoggedIn ? router.push("/profile") : router.push("/login?next=/profile"))}
              >
                {copy.openManage}
              </Button>
              {!isLoggedIn ? <p className="mt-2 text-xs text-muted-foreground">{copy.manageNeedLogin}</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
