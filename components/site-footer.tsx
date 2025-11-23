"use client"

import Link from "next/link"
import { Instagram, Facebook, Github } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n/language-context"
import Logo from "@/components/logo"

const mainLinks = [
  { href: "/programs", label: "nav.programs" },
  { href: "/client-stories", label: "nav.clientStories" },
  { href: "/contacts", label: "nav.contacts" },
]

const legalLinks = [
  { href: "/privacy-policy", label: "nav.privacyPolicy" },
  { href: "/terms-of-use", label: "nav.termsOfUse" },
]

const socialLinks = [
  { href: "https://instagram.com", icon: Instagram, label: "Instagram" },
  { href: "https://facebook.com", icon: Facebook, label: "Facebook" },
  { href: "https://github.com", icon: Github, label: "Github" },
]

export function SiteFooter() {
  const { t } = useLanguage()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="w-full border-t border-border bg-muted text-muted-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <Logo />
              <span className="text-xl font-semibold text-foreground">Myitra</span>
            </div>

            <div className="flex items-center gap-2">
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
                    className="h-10 w-10 rounded-full border border-border text-muted-foreground hover:border-accent hover:text-accent hover:bg-accent/5 transition-colors"
                  >
                    <link.icon className="h-4 w-4" />
                  </Button>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-6 border-t border-border pt-8 sm:flex-row">
            <nav className="flex flex-wrap items-center justify-center gap-4 sm:justify-start">
              {mainLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm transition-colors hover:text-accent"
                >
                  {t(link.label)}
                </Link>
              ))}
            </nav>

            <nav className="flex flex-wrap items-center justify-center gap-4 sm:justify-end">
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm transition-colors hover:text-accent"
                >
                  {t(link.label)}
                </Link>
              ))}
            </nav>
          </div>

          <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>© {currentYear} Myitra. {t("All rights reserved")}.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
