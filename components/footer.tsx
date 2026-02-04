"use client"

import Link from "next/link"
import { useLanguage } from "@/lib/i18n/language-context"
import Logo from "@/components/logo"
import { APP_NAME, APP_SUPPORT_EMAIL } from "@/lib/app-config"
import { SITE_NAV } from "@/lib/site-nav"

type FooterLink = {
  href: string
  labelKey: string
}

const mainLinks: FooterLink[] = SITE_NAV.map((x) => ({ href: x.href, labelKey: x.labelKey }))

const legalLinks: FooterLink[] = [
  { href: "/privacy-policy", labelKey: "nav.privacyPolicy" },
  { href: "/terms-of-use", labelKey: "nav.termsOfUse" },
]

export default function Footer() {
  const { t } = useLanguage()
  const currentYear = Math.max(new Date().getFullYear(), 2026)

  return (
    <footer className="mt-16 w-full border-t border-slate-200 bg-white">
      <div className="container mx-auto px-4 py-10 lg:py-12">
        <div className="grid gap-10 md:grid-cols-3 lg:grid-cols-4">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <Logo />
              <span className="text-lg font-semibold text-slate-900">{APP_NAME}</span>
            </div>

            <p className="max-w-md text-sm text-slate-600">
              {t("Gentle AI support for everyday conversations and emotional care.")}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#"
                aria-label="Download on the App Store"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-black px-4 text-white transition-opacity hover:opacity-80"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <div className="flex flex-col leading-tight">
                  <span className="text-[8px] uppercase">{t("Download on the")}</span>
                  <span className="text-sm font-semibold">App Store</span>
                </div>
              </a>
              <a
                href="#"
                aria-label="Get it on Google Play"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-black px-4 text-white transition-opacity hover:opacity-80"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 1.33a1 1 0 0 1 0 1.724l-2.302 1.33-2.536-2.192 2.536-2.192zM5.864 2.658L16.8 8.99l-2.302 2.302-8.635-8.635z" />
                </svg>
                <div className="flex flex-col leading-tight">
                  <span className="text-[8px] uppercase">{t("Get it on")}</span>
                  <span className="text-sm font-semibold">Google Play</span>
                </div>
              </a>
            </div>

            <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-xs text-slate-700 sm:text-sm">
              <p className="font-semibold text-violet-900">{t("This is not an emergency service")}</p>
              <p className="mt-1">{t("TurbotaAI is a support tool and does not replace professional help.")}</p>
              <p className="mt-1">
                {t("If you are in immediate danger, contact emergency services or a crisis hotline in your country.")}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">{t("Quick Links")}</h3>
            <nav className="mt-4 flex flex-col gap-2 text-sm text-slate-600">
              {mainLinks.map((link) => (
                <Link key={link.href} href={link.href} className="transition-colors hover:text-slate-900">
                  {t(link.labelKey)}
                </Link>
              ))}
            </nav>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">{t("Contact Us")}</h3>
            <a
              href={`mailto:${APP_SUPPORT_EMAIL}`}
              className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              {APP_SUPPORT_EMAIL}
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row">
          <p>
            © {currentYear} {APP_NAME}. {t("All rights reserved")}.
          </p>
          <nav className="flex flex-wrap items-center gap-4">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-slate-700">
                {t(link.labelKey)}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
