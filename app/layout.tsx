import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/lib/auth/auth-context"
import { LanguageProvider } from "@/lib/i18n/language-context"
import { AutoTranslate } from "@/components/auto-translate"
import { RTLWrapper } from "@/components/rtl-wrapper"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Myitra",
  description: "Professional AI-powered psychological support and counseling services",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
    generator: 'v0.app'
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0f9ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a416f" },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-slate-950 text-slate-50 antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <LanguageProvider>
            <RTLWrapper>
              <AutoTranslate>
                <div className="flex min-h-screen flex-col">
                  <SiteHeader />
                  <main className="flex-1">
                    {children}
                  </main>
                  <SiteFooter />
                </div>
              </AutoTranslate>
            </RTLWrapper>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
