"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"

import { RainbowButton } from "@/components/ui/rainbow-button"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { LanguageSelector } from "@/components/language-selector"

import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import Logo from "@/components/logo"
import { APP_NAME } from "@/lib/app-config"

type MainLink = { href: string; label: string }

function tryExtractUserText(init?: any): string | null {
  try {
    const body = init?.body
    if (typeof body !== "string") return null
    const parsed = JSON.parse(body)
    return (
      (typeof parsed?.text === "string" && parsed.text) ||
      (typeof parsed?.message === "string" && parsed.message) ||
      (typeof parsed?.prompt === "string" && parsed.prompt) ||
      (typeof parsed?.input === "string" && parsed.input) ||
      (typeof parsed?.query === "string" && parsed.query) ||
      (typeof parsed?.q === "string" && parsed.q) ||
      null
    )
  } catch {
    return null
  }
}

function tryExtractAssistantText(data: any): string | null {
  if (!data) return null

  if (Array.isArray(data) && data.length) {
    const first: any = data[0]
    const v =
      (typeof first?.text === "string" && first.text) ||
      (typeof first?.output === "string" && first.output) ||
      (typeof first?.answer === "string" && first.answer) ||
      (typeof first?.result === "string" && first.result) ||
      (typeof first?.message === "string" && first.message) ||
      null
    if (v) return v
  }

  return (
    (typeof data?.text === "string" && data.text) ||
    (typeof data?.output === "string" && data.output) ||
    (typeof data?.answer === "string" && data.answer) ||
    (typeof data?.result === "string" && data.result) ||
    (typeof data?.message === "string" && data.message) ||
    null
  )
}

function clipText(s: string, max = 4000) {
  if (!s) return s
  return s.length > max ? s.slice(0, max) : s
}

export default function Header() {
  const { t } = useLanguage()
  const { user } = useAuth()

  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [trialLeft, setTrialLeft] = useState<number | null>(null)
  const [trialText, setTrialText] = useState<string | null>(null)
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  const loggedIn = Boolean(user) || Boolean(isLoggedIn)

  const paywall = searchParams?.get("paywall")
  const [paywallDismissed, setPaywallDismissed] = useState(false)
  const showPaywall = pathname === "/pricing" && paywall === "trial" && !paywallDismissed

  const mainLinks: MainLink[] = useMemo(
    () => [
      { href: "/", label: t("Home") },
      { href: "/about", label: t("About") },
      { href: "/contacts", label: t("Contacts") },
      { href: "/pricing", label: t("Pricing") },
    ],
    [t]
  )

  const loadSummary = () =>
    fetch("/api/account/summary", { cache: "no-store", credentials: "include" })

  useEffect(() => {
    let alive = true

    const run = () => {
      loadSummary()
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return

          setIsLoggedIn(Boolean(d?.isLoggedIn))

          const left = typeof d?.trialLeft === "number" ? d.trialLeft : null
          setTrialLeft(left)

          const txt =
            typeof d?.trialText === "string"
              ? d.trialText
              : d?.access === "Paid"
              ? "Unlimited"
              : d?.access === "Promo"
              ? "Promo code"
              : null

          setTrialText(txt)

          const accessActive =
            Boolean(d?.hasAccess) || d?.access === "Paid" || d?.access === "Promo"
          setHasAccess(accessActive)
        })
        .catch(() => {})
    }

    run()
    const onRefresh = () => run()
    window.addEventListener("turbota:refresh", onRefresh)

    return () => {
      alive = false
      window.removeEventListener("turbota:refresh", onRefresh)
    }
  }, [])

  const scrollToSection = (e: any, href: string) => {
    if (href.startsWith("#")) {
      e.preventDefault()
      const el = document.querySelector(href)
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
      setMobileMenuOpen(false)
    } else {
      setMobileMenuOpen(false)
    }
  }

  const scrollToAssistant = () => {
    const el = document.querySelector("#assistant")
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const badgeText =
    trialText
      ? `${t("Access")}: ${t(trialText)}`
      : typeof trialLeft === "number"
      ? `${t("Trial left")}: ${trialLeft}`
      : hasAccess
      ? `${t("Access")}: ${t("Active")}`
      : null

  // turbota_global_fetch_interceptor
  useEffect(() => {
    if (typeof window === "undefined") return

    const originalFetch = window.fetch.bind(window)

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
        const isClear = url.includes("/api/auth/clear")
        const isLogin = url.includes("/api/auth/login")

        if (isAgent && res.status === 402) {
          try {
            sessionStorage.setItem("turbota_paywall", "trial")
          } catch {}

          window.dispatchEvent(new Event("turbota:refresh"))
          window.location.assign("/pricing?paywall=trial")
          return res
        }

        if (isLogin && res.ok) {
          try {
            sessionStorage.removeItem("turbota_conv_id")
          } catch {}
          window.dispatchEvent(new Event("turbota:refresh"))
          return res
        }

        if (isClear && res.ok) {
          try {
            for (const k of Object.keys(localStorage)) {
              if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
                localStorage.removeItem(k)
              }
            }
          } catch {}

          try {
            sessionStorage.removeItem("turbota_paywall")
            sessionStorage.removeItem("turbota_conv_id")
          } catch {}

          window.dispatchEvent(new Event("turbota:refresh"))
          return res
        }

        if ((isAgent || isPromo) && res.ok) {
          window.dispatchEvent(new Event("turbota:refresh"))

          if (isAgent) {
            const userText = tryExtractUserText(init)

            ;(async () => {
              try {
                const convId =
                  (() => {
                    try {
                      return sessionStorage.getItem("turbota_conv_id")
                    } catch {
                      return null
                    }
                  })() || null

                const cloned = res.clone()
                const raw = await cloned.text().catch(() => "")
                let parsed: any = null
                try {
                  parsed = raw ? JSON.parse(raw) : null
                } catch {}

                const assistantText =
                  tryExtractAssistantText(parsed) || (raw ? clipText(raw) : null)

                if (userText || assistantText) {
                  const rr = await fetch("/api/history/save", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      conversationId: convId,
                      userText,
                      assistantText,
                    }),
                  }).catch(() => null)

                  const dd = await rr?.json().catch(() => null)
                  const newId =
                    typeof dd?.conversationId === "string" ? dd.conversationId : null

                  if (newId) {
                    try {
                      sessionStorage.setItem("turbota_conv_id", newId)
                    } catch {}
                  }
                }
              } catch {}
            })()
          }
        }
      } catch {}

      return res
    }) as any

    return () => {
      window.fetch = originalFetch as any
    }
  }, [])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
      {showPaywall ? (
        <div className="fixed right-4 top-4 z-[9999] w-[380px]">
          <Banner
            show={true}
            variant="warning"
            showShade={true}
            closable={true}
            onHide={() => setPaywallDismissed(true)}
            title={t("Free trial is over")}
            description={t("Subscribe to continue using the assistant.")}
            action={
              <div className="flex items-center gap-2">
                <RainbowButton
                  className="h-9 px-4 text-sm font-semibold"
                  onClick={() => {
                    const btn = document.getElementById(
                      "turbota-subscribe"
                    ) as HTMLButtonElement | null
                    if (btn) btn.click()
                    else window.location.assign("/pricing")
                  }}
                >
                  {t("Subscribe")}
                </RainbowButton>
                <Button
                  variant="outline"
                  className="h-9 px-4"
                  onClick={() => setPaywallDismissed(true)}
                >
                  {t("Later")}
                </Button>
              </div>
            }
          />
        </div>
      ) : null}

      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-10 xl:px-16">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full px-1 py-1 transition-colors hover:bg-slate-50"
        >
          <Logo />
          <span className="text-xl font-semibold text-slate-900">{APP_NAME}</span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {mainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => scrollToSection(e, link.href)}
              className="text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageSelector />

          {badgeText ? (
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
              {badgeText}
            </span>
          ) : null}

          <Link href={loggedIn ? "/profile" : "/login"}>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-100 hover:text-slate-900"
            >
              {loggedIn ? t("Profile") : t("Sign In")}
            </Button>
          </Link>

          <Button
            onClick={scrollToAssistant}
            size="sm"
            className="rounded-full bg-slate-900 px-5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            {t("Talk Now")}
          </Button>
        </div>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" className="text-slate-800">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>

          <SheetContent side="left" className="w-[300px] border-border bg-white">
            <div className="flex flex-col gap-6 pt-6">
              <div className="flex items-center gap-2">
                <Logo />
                <span className="text-xl font-semibold text-slate-900">{APP_NAME}</span>
              </div>

              <nav className="flex flex-col gap-4">
                {mainLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={(e) => scrollToSection(e, link.href)}
                    className="text-base font-medium text-slate-800 transition-colors hover:text-slate-900"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="border-t border-slate-200 pt-6">
                <LanguageSelector />
              </div>

              <div className="flex flex-col gap-3">
                <Link
                  href={loggedIn ? "/profile" : "/login"}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button
                    variant="outline"
                    className="w-full border-slate-200 bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-900"
                  >
                    {loggedIn ? t("Profile") : t("Sign In")}
                  </Button>
                </Link>

                <Button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    scrollToAssistant()
                  }}
                  className="w-full rounded-full bg-slate-900 text-white hover:bg-slate-800"
                >
                  {t("Talk Now")}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
