"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { LanguageSelector } from "@/components/language-selector"
import { RainbowButton } from "@/components/ui/rainbow-button"
import { useLanguage } from "@/lib/i18n/language-context"
import Logo from "@/components/logo"

const mainLinks = [
  { href: "/", label: "Главная" },
  { href: "#programs", label: "Программы" },
  { href: "#stories", label: "Истории клиентов" },
  { href: "#contacts", label: "Контакты" },
]

export function SiteHeader() {
  const { t } = useLanguage()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      e.preventDefault()
      const element = document.querySelector(href)
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" })
        setMobileMenuOpen(false)
      }
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-xl font-bold text-white">Myitra</span>
        </div>

        <nav className="hidden items-center gap-6 lg:flex">
          {mainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => scrollToSection(e, link.href)}
              className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
            >
              {t(link.label)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <LanguageSelector />
          <Link href="/login">
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              {t("Войти")}
            </Button>
          </Link>
          <RainbowButton
            onClick={() => {
              const element = document.querySelector("#assistant")
              if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            }}
          >
            {t("Поговорить сейчас")}
          </RainbowButton>
        </div>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" className="text-slate-300">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] bg-slate-950 border-white/10">
            <div className="flex flex-col gap-6 pt-6">
              <div className="flex items-center gap-2">
                <Logo />
                <span className="text-xl font-bold text-white">Myitra</span>
              </div>

              <nav className="flex flex-col gap-4">
                {mainLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={(e) => scrollToSection(e, link.href)}
                    className="text-base font-medium text-slate-300 transition-colors hover:text-white"
                  >
                    {t(link.label)}
                  </Link>
                ))}
              </nav>

              <div className="border-t border-white/10 pt-6">
                <LanguageSelector />
              </div>

              <div className="flex flex-col gap-3">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full border-white/20 text-slate-300">
                    {t("Войти")}
                  </Button>
                </Link>
                <RainbowButton
                  onClick={() => {
                    setMobileMenuOpen(false)
                    const element = document.querySelector("#assistant")
                    if (element) {
                      element.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                  }}
                  className="w-full"
                >
                  {t("Поговорить сейчас")}
                </RainbowButton>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
