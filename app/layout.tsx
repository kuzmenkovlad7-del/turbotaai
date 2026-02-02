import { Suspense } from "react"
import type { ReactNode } from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"

import "./globals.css"
import { AuthProvider } from "@/lib/auth/auth-context"
import { LanguageProvider } from "@/lib/i18n/language-context"
import { AutoTranslate } from "@/components/auto-translate"
import { RTLWrapper } from "@/components/rtl-wrapper"
import { PaywallToast } from "@/components/paywall-toast"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { APP_NAME } from "@/lib/app-config"
import AssistantFab from "@/components/assistant-fab"

const inter = Inter({ subsets: ["latin"] })

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://turbotaai.com"

const fullTitle = `${APP_NAME} — AI-компаньйон, який завжди поруч`

export const metadata: Metadata = {
  title: {
    default: fullTitle,
    template: "%s | TurbotaAI",
  },
  description:
    "TurbotaAI — AI-компаньйон для спокійних розмов. Чат, голос або відео — коли потрібна підтримка.",
  keywords: [
    "TurbotaAI",
    "AI companion",
    "AI компаньйон",
    "підтримка",
    "чат",
    "голос",
    "відео",
    "emotional support",
    "психологічна підтримка",
  ],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: fullTitle,
    description:
      "Спокійний та безпечний простір для розмови. Поговоріть з AI-компаньйоном у чаті, голосом або відео.",
    url: siteUrl,
    siteName: "TurbotaAI",
    type: "website",
    locale: "uk_UA",
    alternateLocale: ["ru_RU", "en_US"],
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TurbotaAI — AI-компаньйон поруч 24/7",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: fullTitle,
    description:
      "AI-компаньйон поруч 24/7. Чат, голос або відео — коли потрібна підтримка.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: siteUrl,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#F7F8FF",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body
        className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}
        suppressHydrationWarning
      >
        <Suspense fallback={null}>
          <AuthProvider>
            <LanguageProvider>
              <RTLWrapper>
                <AutoTranslate>
                  <div className="flex min-h-screen flex-col bg-soft-grid">
                    <PaywallToast />
                    <Header />
                    <main className="flex-1">{children}</main>
                    <Footer />
                    <AssistantFab />
                  </div>
                </AutoTranslate>
              </RTLWrapper>
            </LanguageProvider>
          </AuthProvider>
        </Suspense>
      </body>
    </html>
  )
}
