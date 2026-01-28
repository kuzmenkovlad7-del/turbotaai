"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { LanguageSelector } from "@/components/language-selector"

import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import Logo from "@/components/logo"
import { APP_NAME } from "@/lib/app-config"

type AnyObj = Record<string, any>
type MainLink = { href: string; label: string }

function isActiveDate(v: any) {
  if (!v) return false
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() > Date.now()
}

function safeNext(pathname: string | null) {
  const p = pathname || "/"
  return p.startsWith("/") ? p : "/"
}

export default function Header() {
  const { t } = useLanguage()
  const { user } = useAuth()

  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [summary, setSummary] = useState<AnyObj | null>(null)

  const paywall = searchParams?.get("paywall")
  const showPaywall = pathname === "/pricing" && paywall === "trial"

  const mainLinks: MainLink[] = useMemo(
    () => [
      { href: "/", label: t("Home") },
      { href: "/about", label: t("About") },
      { href: "/contacts", label: t("Contacts") },
      { href: "/pricing", label: t("Pricing") },
    ],
    [t]
  )

  const inFlightRef = useRef(false)
  const lastRunRef = useRef(0)

  const runSummary = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && now - lastRunRef.current < 700) return
    if (inFlightRef.current) return

    lastRunRef.current = now
    inFlightRef.current = true

    try {
      const r1 = await fetch("/api/account/summary", { cache: "no-store", credentials: "include" })
      const d1 = (await r1.json().catch(() => ({}))) as AnyObj

      let d2: AnyObj = {}
      try {
        const r2 = await fetch("/api/billing/subscription/status", { cache: "no-store", credentials: "include" })
        d2 = (await r2.json().catch(() => ({}))) as AnyObj
      } catch {}

      setSummary({ ...d1, ...d2 })
    } catch {
      setSummary(null)
    } finally {
      inFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    runSummary(true)
  }, [runSummary, pathname])

  useEffect(() => {
    const onRefresh = () => runSummary(false)
    window.addEventListener("turbota:refresh", onRefresh)
    return () => window.removeEventListener("turbota:refresh", onRefresh)
  }, [runSummary])

  useEffect(() => {
    if (typeof window === "undefined") return
    const w = window as any
    if (w.__turbota_fetch_wrapped) return

    const originalFetch = window.fetch.bind(window)
    w.__turbota_fetch_wrapped = true

    window.fetch = (async (input: any, init?: any) => {
      const res = await originalFetch(input, init)

      try {
        const url =
          typeof input === "string"
            ? input
            : input?.url
            ? String(input.url)
            : ""

        const isAgent = url.includes("/api/turbotaai-agent")
        const isPromo = url.includes("/api/billing/promo/redeem")
        const isSyncPay = url.includes("/api/billing/wayforpay/sync")
        const isSubCancel = url.includes("/api/billing/subscription/cancel")
        const isSubResume = url.includes("/api/billing/subscription/resume")
        const isPromoCancel = url.includes("/api/billing/promo/cancel")

        const isLogin = url.includes("/api/auth/login")
        const isRegister = url.includes("/api/auth/register")
        const isClear = url.includes("/api/auth/clear")

        if (isAgent && res.status === 402) {
          try {
            sessionStorage.setItem("turbota_paywall", "trial")
          } catch {}
          window.dispatchEvent(new Event("turbota:refresh"))
          window.location.assign("/pricing?paywall=trial")
          return res
        }

        if ((isLogin || isRegister) && res.ok) {
          try {
            await originalFetch("/api/account/claim", {
              method: "POST",
              headers: { "content-type": "application/json" },
              credentials: "include",
              body: "{}",
              cache: "no-store",
            })
          } catch {}
          try {
            sessionStorage.removeItem("turbota_conv_id")
          } catch {}
          window.dispatchEvent(new Event("turbota:refresh"))
          return res
        }

        if (isClear && res.ok) {
          window.dispatchEvent(new Event("turbota:refresh"))
          return res
        }

        if ((isPromo || isSyncPay || isSubCancel || isSubResume || isPromoCancel) && res.ok) {
          window.dispatchEvent(new Event("turbota:refresh"))
          return res
        }
      } catch {}

      return res
    }) as any

    return () => {
      try {
        window.fetch = originalFetch as any
      } catch {}
      try {
        delete (window as any).__turbota_fetch_wrapped
      } catch {}
    }
  }, [])

  const isLoggedIn = Boolean(user) || Boolean(summary?.isLoggedIn ?? summary?.loggedIn ?? summary?.user)

  const paidUntil = summary?.paidUntil ?? summary?.paid_until ?? null
  const promoUntil = summary?.promoUntil ?? summary?.promo_until ?? null
  const hasPaid = isActiveDate(paidUntil)
  const hasPromo = isActiveDate(promoUntil)

  const accessRaw = String(summary?.access ?? "").toLowerCase()
  const unlimited = Boolean(summary?.unlimited) || accessRaw === "paid" || accessRaw === "promo" || hasPaid || hasPromo

  const left =
    typeof summary?.questionsLeft === "number"
      ? summary.questionsLeft
      : typeof summary?.trial_questions_left === "number"
      ? summary.trial_questions_left
      : typeof summary?.trialLeft === "number"
      ? summary.trialLeft
      : null

  const badgeText = unlimited
    ? `${t("Access")}: ${t("Active")}`
    : typeof left === "number"
    ? `${t("Trial left")}: ${left}`
    : null

  const next = encodeURIComponent(safeNext(pathname))

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/85 backdrop-blur">
      {showPaywall ? (
        <div className="border-b bg-amber-50">
          <div className="mx-auto max-w-6xl px-4 py-2 text-sm text-amber-900 flex items-center justify-between gap-3">
            <div>
              {t("Trial limit reached")}. {t("Choose a plan to continue")}.
            </div>
            <Link href="/pricing" className="underline">
              {t("Pricing")}
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Logo />
              <span className="font-semibold">{APP_NAME}</span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-2">
            {mainLinks.map((l) => (
              <Link key={l.href} href={l.href} className="px-3 py-2 text-sm rounded-lg hover:bg-gray-100">
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {badgeText ? (
              <div className="hidden sm:inline-flex items-center rounded-full border px-3 py-1 text-xs text-gray-700">
                {badgeText}
              </div>
            ) : null}

            <LanguageSelector />

            {isLoggedIn ? (
              <Link href="/profile">
                <Button className="rounded-xl">{t("Profile")}</Button>
              </Link>
            ) : (
              <Link href={`/login?next=${next}`}>
                <Button className="rounded-xl" variant="outline">
                  {t("Sign In")}
                </Button>
              </Link>
            )}

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="rounded-xl md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <div className="mt-4 flex flex-col gap-2">
                  {mainLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="rounded-xl border px-4 py-3 text-sm"
                      onClick={() => setMobileOpen(false)}
                    >
                      {l.label}
                    </Link>
                  ))}

                  <div className="mt-3">
                    {isLoggedIn ? (
                      <Link href="/profile" onClick={() => setMobileOpen(false)}>
                        <Button className="w-full rounded-xl">{t("Profile")}</Button>
                      </Link>
                    ) : (
                      <Link href={`/login?next=${next}`} onClick={() => setMobileOpen(false)}>
                        <Button className="w-full rounded-xl" variant="outline">
                          {t("Sign In")}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
