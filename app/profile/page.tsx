"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth/auth-context"

type Summary = {
  email?: string | null
  trialLeft?: any
  trial_left?: any
  trial_questions_left?: any
  access?: "Paid" | "Promo" | "Limited" | string | null
  paidUntil?: string | null
  paid_until?: string | null
  promoUntil?: string | null
  promo_until?: string | null
  isLoggedIn?: boolean
  hasAccess?: boolean
}

function safeDate(v: any): string | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function isActiveDate(v: any) {
  if (!v) return false
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() > Date.now()
}

export default function ProfilePage() {
  const { currentLanguage } = useLanguage()
  const { user } = useAuth()
  const router = useRouter()

  const lang = useMemo(() => {
    const code = String(currentLanguage?.code || "uk").toLowerCase()
    return code.startsWith("ru") ? "ru" : code.startsWith("en") ? "en" : "uk"
  }, [currentLanguage?.code])

  const copy = useMemo(() => {
    const c = {
      uk: {
        title: "Профіль",
        pricing: "Тарифи",
        signIn: "Увійти",
        logout: "Вийти",
        account: "Акаунт",
        accountDesc: "Статус входу та доступ",
        email: "Email",
        access: "Доступ",
        accessFree: "Безкоштовно",
        accessPromo: "Промокод",
        accessUnlimited: "Безліміт",
        questionsLeft: "Залишилось запитань",
        unlimited: "Безлімітно",
        paidUntil: "Оплачено до",
        promoUntil: "Промо до",
        notActive: "Не активно",
        manageSub: "Керувати підпискою",
        hint: "Увійдіть, щоб зберігати історію та керувати доступом.",
        history: "Історія",
        historyDesc: "Збережені сесії",
        historyNeedLogin: "Увійдіть, щоб бачити історію.",
        historyOpen: "Відкрийте сесію з історії.",
        guest: "Гість",
      },
      ru: {
        title: "Профиль",
        pricing: "Тарифы",
        signIn: "Войти",
        logout: "Выйти",
        account: "Аккаунт",
        accountDesc: "Статус входа и доступ",
        email: "Email",
        access: "Доступ",
        accessFree: "Бесплатно",
        accessPromo: "Промокод",
        accessUnlimited: "Безлимит",
        questionsLeft: "Осталось вопросов",
        unlimited: "Безлимитно",
        paidUntil: "Оплачено до",
        promoUntil: "Промо до",
        notActive: "Не активно",
        manageSub: "Управлять подпиской",
        hint: "Войдите, чтобы сохранять историю и управлять доступом.",
        history: "История",
        historyDesc: "Сохранённые сессии",
        historyNeedLogin: "Войдите, чтобы видеть историю.",
        historyOpen: "Откройте сессию из истории.",
        guest: "Гость",
      },
      en: {
        title: "Profile",
        pricing: "Pricing",
        signIn: "Sign In",
        logout: "Log out",
        account: "Account",
        accountDesc: "Login status and access",
        email: "Email",
        access: "Access",
        accessFree: "Free",
        accessPromo: "Promo code",
        accessUnlimited: "Unlimited",
        questionsLeft: "Questions left",
        unlimited: "Unlimited",
        paidUntil: "Paid until",
        promoUntil: "Promo until",
        notActive: "Not active",
        manageSub: "Manage subscription",
        hint: "Sign in to unlock saved sessions and access controls.",
        history: "History",
        historyDesc: "Saved sessions",
        historyNeedLogin: "Login to see history.",
        historyOpen: "Open a session from your history.",
        guest: "Guest",
      },
    }
    return c[lang as "uk" | "ru" | "en"]
  }, [lang])

  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    let alive = true
    fetch("/api/account/summary", { cache: "no-store", credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        setSummary(d || {})
      })
      .catch(() => setSummary({}))
    return () => {
      alive = false
    }
  }, [])

  const isLoggedIn = Boolean(user) || Boolean(summary?.isLoggedIn)
  const email = summary?.email ? String(summary.email) : copy.guest

  const trialLeftNum = Number(
    (summary as any)?.trialLeft ??
      (summary as any)?.trial_left ??
      (summary as any)?.trial_questions_left ??
      0
  )
  const trialLeft = Number.isFinite(trialLeftNum) ? trialLeftNum : 0

  const paidUntilRaw = (summary as any)?.paidUntil ?? (summary as any)?.paid_until ?? null
  const promoUntilRaw = (summary as any)?.promoUntil ?? (summary as any)?.promo_until ?? null

  const paidActive = summary?.access === "Paid" || isActiveDate(paidUntilRaw)
  const promoActive = summary?.access === "Promo" || isActiveDate(promoUntilRaw)

  const accessLabel = paidActive
    ? copy.accessUnlimited
    : promoActive
    ? copy.accessPromo
    : copy.accessFree

  const questionsLabel = paidActive || promoActive ? copy.unlimited : String(trialLeft)

  const paidUntil = safeDate(paidUntilRaw)
  const promoUntil = safeDate(promoUntilRaw)

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-10 xl:px-16">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900">{copy.title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/pricing">
            <Button variant="outline" className="rounded-full border border-slate-200">
              {copy.pricing}
            </Button>
          </Link>

          {isLoggedIn ? (
            <Button
              variant="outline"
              className="rounded-full border border-slate-200"
              onClick={async () => {
                await fetch("/api/auth/clear?scope=hard", { method: "POST" }).catch(() => {})
                router.refresh()
                router.push("/")
              }}
            >
              {copy.logout}
            </Button>
          ) : (
            <Link href="/login">
              <Button variant="outline" className="rounded-full border border-slate-200">
                {copy.signIn}
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{copy.account}</CardTitle>
            <CardDescription>{copy.accountDesc}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{copy.email}:</span>
              <span className="font-medium">{email}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">{copy.access}:</span>
              <span className="font-medium">{accessLabel}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">{copy.questionsLeft}:</span>
              <span className="font-medium">{questionsLabel}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">{copy.paidUntil}:</span>
              <span className="font-medium">{paidUntil || copy.notActive}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">{copy.promoUntil}:</span>
              <span className="font-medium">{promoUntil || copy.notActive}</span>
            </div>

            <div className="pt-4">
              <Link href="/subscription">
                <Button variant="outline" className="w-full rounded-full border border-slate-200">
                  {copy.manageSub}
                </Button>
              </Link>
              <p className="mt-2 text-xs text-slate-500">{copy.hint}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{copy.history}</CardTitle>
            <CardDescription>{copy.historyDesc}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-700">
            {isLoggedIn ? (
              <div className="text-slate-600">{copy.historyOpen}</div>
            ) : (
              <div className="text-slate-600">{copy.historyNeedLogin}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
