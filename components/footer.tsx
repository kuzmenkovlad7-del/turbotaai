"use client"

import Link from "next/link"
import { Instagram, Facebook, Github } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n/language-context"
import Logo from "@/components/logo"
import { APP_NAME, APP_SUPPORT_EMAIL } from "@/lib/app-config"

type FooterLink = {
  href: string
  labelKey?: string
  label?: string
}

const mainLinks: FooterLink[] = [
  { href: "/", labelKey: "nav.home" },
  { href: "/programs", labelKey: "nav.programs" },
  { href: "/client-stories", labelKey: "nav.clientStories" },
  // здесь — только текст, без nav.about
  { href: "/about", label: "About" },
  { href: "/contacts", labelKey: "nav.contacts" },
]

const legalLinks: FooterLink[] = [
  { href: "/privacy-policy", labelKey: "nav.privacyPolicy" },
  { href: "/terms-of-use", labelKey: "nav.termsOfUse" },
]

const socialLinks = [
  { href: "https://instagram.com/turbotaai", icon: Instagram, label: "Instagram" },
  { href: "https://facebook.com/turbotaai", icon: Facebook, label: "Facebook" },
  { href: "https://github.com/turbotaai", icon: Github, label: "Github" },
]

export default function Footer() {
  const { t } = useLanguage()
  const currentYear = new Date().getFullYear()

  const renderLabel = (link: FooterLink) =>
    link.labelKey ? t(link.labelKey) : link.label

  return (
    <footer className="mt-16 w-full border-t border-slate-200 bg-white">
      <div className="container mx-auto px-4 py-10 lg:py-12">
        <div className="grid gap-10 md:grid-cols-3 lg:grid-cols-4">
          {/* Логотип + слоган + дисклеймер */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <Logo />
              <span className="text-lg font-semibold text-slate-900">
                {APP_NAME}
              </span>
            </div>

            <p className="max-w-md text-sm text-slate-600">
              {t(
                "Psychological support based on AI for everyday emotional difficulties.",
              )}
            </p>

            <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-xs text-slate-700 sm:text-sm">
              <p className="font-semibold text-violet-900">
                {t("This is not an emergency service")}
              </p>
              <p className="mt-1">
                {t(
                  "Myitra is not a replacement for a licensed psychologist or psychiatrist.",
                )}
              </p>
              <p className="mt-1">
                {t(
                  "If you are in immediate danger, contact emergency services or a crisis hotline in your country.",
                )}
              </p>
            </div>
          </div>

          {/* Быстрые ссылки */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {t("Quick Links")}
            </h3>
            <nav className="mt-4 flex flex-col gap-2 text-sm text-slate-600">
              {mainLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="transition-colors hover:text-slate-900"
                >
                  {renderLabel(link)}
                </Link>
              ))}
            </nav>
          </div>

          {/* Контакты / соцсети */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              {t("Contact Us")}
            </h3>

            <a
              href={`mailto:${APP_SUPPORT_EMAIL}`}
              className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              {APP_SUPPORT_EMAIL}
            </a>

            <div className="flex flex-wrap gap-2">
              {socialLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-violet-500 hover:bg-violet-50 hover:text-violet-600"
                  >
                    <link.icon className="h-4 w-4" />
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Нижняя полоса */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row">
          <p>
            © {currentYear} {APP_NAME}. {t("All rights reserved")}.
          </p>
          <nav className="flex flex-wrap items-center gap-4">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-slate-700"
              >
                {renderLabel(link)}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
