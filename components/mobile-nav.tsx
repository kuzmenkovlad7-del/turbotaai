"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { LanguageSelector } from "./language-selector"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, X, User, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function MobileNav() {
  const { t } = useLanguage()
  const { user, isLoading, signOut } = useAuth()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const isActive = (path: string) => {
    return pathname === path
  }

  const handleSignOut = async () => {
    await signOut()
    setIsOpen(false)
  }

  return (
    <div className="md:hidden">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-white">
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center py-4">
              <h2 className="text-lg font-semibold text-slate-900">Menu</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-6 w-6" />
                <span className="sr-only">Close menu</span>
              </Button>
            </div>

            <nav className="flex flex-col space-y-4 py-4">
              <Link
                href="/"
                className={`px-2 py-1 rounded-md ${
                  isActive("/") ? "bg-primary-100 text-primary-600" : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => setIsOpen(false)}
              >
                {t("Home")}
              </Link>
              <Link
                href="/about"
                className={`px-2 py-1 rounded-md ${
                  isActive("/about") ? "bg-primary-100 text-primary-600" : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => setIsOpen(false)}
              >
                {t("About")}
              </Link>
              <Link
                href="/services"
                className={`px-2 py-1 rounded-md ${
                  isActive("/services") ? "bg-primary-100 text-primary-600" : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => setIsOpen(false)}
              >
                {t("Services")}
              </Link>
              <Link
                href="/pricing"
                className={`px-2 py-1 rounded-md ${
                  isActive("/pricing") ? "bg-primary-100 text-primary-600" : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => setIsOpen(false)}
              >
                {t("Pricing")}
              </Link>
              <Link
                href="/contact"
                className={`px-2 py-1 rounded-md ${
                  isActive("/contact") ? "bg-primary-100 text-primary-600" : "text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => setIsOpen(false)}
              >
                {t("Contact")}
              </Link>
            </nav>

            <div className="mt-auto space-y-4 py-4 border-t border-gray-200">
              <LanguageSelector />

              {!isLoading && (
                <div className="space-y-2">
                  {user ? (
                    <>
                      <Link
                        href="/profile"
                        className="flex items-center space-x-2 px-2 py-1 rounded-md text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsOpen(false)}
                      >
                        <User size={18} />
                        <span>{t("Profile")}</span>
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="flex items-center space-x-2 px-2 py-1 rounded-md text-red-600 hover:bg-red-50 w-full text-left"
                      >
                        <LogOut size={18} />
                        <span>{t("Sign Out")}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="block w-full px-2 py-1 rounded-md text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsOpen(false)}
                      >
                        {t("Sign In")}
                      </Link>
                      <Link
                        href="/register"
                        className="block w-full px-2 py-1 rounded-md bg-primary-600 text-white text-center hover:bg-primary-700"
                        onClick={() => setIsOpen(false)}
                      >
                        {t("Sign Up")}
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
