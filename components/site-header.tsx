"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { LanguageSelector } from "@/components/language-selector"
import { useLanguage } from "@/lib/i18n/language-context"
import Logo from "@/components/logo"

const mainLinks = [
  { href: "/", label: "nav.home" },
  { href: "/programs", label: "nav.programs" },
  { href: "/client-stories", label: "nav.clientStories" },
  { href: "/contacts", label: "nav.contacts" },
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
    <header className="sticky top-0 z-50 w-full border-b border-border bg-white/95 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Logo />
          <span className="text-xl font-semibold text-gray-900">Myitra</span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {mainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => scrollToSection(e, link.href)}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-accent relative after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-0 after:bg-accent after:transition-all hover:after:w-full"
            >
              {t(link.label)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageSelector />
          <Link href="/login">
            <Button variant="outline" size="sm" className="border-border">
              {t("Sign In")}
            </Button>
          </Link>
          <Button
            onClick={() => {
              const element = document.querySelector("#assistant")
              if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            }}
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t("Talk Now")}
          </Button>
        </div>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" className="text-foreground">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] bg-white border-border">
            <div className="flex flex-col gap-6 pt-6">
              <div className="flex items-center gap-2">
                <Logo />
                <span className="text-xl font-semibold text-gray-900">Myitra</span>
              </div>

              <nav className="flex flex-col gap-4">
                {mainLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={(e) => scrollToSection(e, link.href)}
                    className="text-base font-medium text-muted-foreground transition-colors hover:text-accent"
                  >
                    {t(link.label)}
                  </Link>
                ))}
              </nav>

              <div className="border-t border-border pt-6">
                <LanguageSelector />
              </div>

              <div className="flex flex-col gap-3">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full border-border">
                    {t("Sign In")}
                  </Button>
                </Link>
                <Button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    const element = document.querySelector("#assistant")
                    if (element) {
                      element.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                  }}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
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
