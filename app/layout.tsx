import type React from "react"
import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { Inter } from "next/font/google"

import "./globals.css"
import { AuthProvider } from "@/lib/auth/auth-context"
import { LanguageProvider } from "@/lib/i18n/language-context"
import { AutoTranslate } from "@/components/auto-translate"
import { RTLWrapper } from "@/components/rtl-wrapper"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { APP_NAME } from "@/lib/app-config"

const inter = Inter({ subsets: ["latin"] })

const fullTitle = `${APP_NAME} — AI-psychologist nearby 24/7`

export const metadata: Metadata = {
  title: {
    default: "TurbotaAI — AI-psychologist nearby 24/7",
    template: "%s | TurbotaAI",
  },
  description:
    "TurbotaAI — AI-psychologist nearby 24/7. Live psychological support in chat, voice or video when you feel exhausted, anxious or alone.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "TurbotaAI — AI-psychologist nearby 24/7",
    description:
      "Talk to an AI-powered psychologist in chat, voice or video. Gentle, always-on support when it feels bad, anxious or lonely.",
    url: "https://turbotaai.com",
    siteName: "TurbotaAI",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TurbotaAI — AI-powered psychological support",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: fullTitle,
    description:
      "AI-psychologist nearby 24/7. Talk in chat, voice or video when you need support.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  generator: "v0.app",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#F7F8FF",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body
        className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}
        suppressHydrationWarning
      >
        {/* Voiceflow site-assistant widget */}
        <Script id="voiceflow-chat-widget" strategy="afterInteractive">
          {`
            (function(d, t) {
              var v = d.createElement(t), s = d.getElementsByTagName(t)[0];
              v.onload = function() {
                window.voiceflow.chat.load({
                  verify: { projectID: '6920c09ba59edfa96ca49b3a' },
                  url: 'https://general-runtime.voiceflow.com',
                  versionID: 'production',
                  voice: {
                    url: 'https://runtime-api.voiceflow.com'
                  }
                });
              };
              v.src = 'https://cdn.voiceflow.com/widget-next/bundle.mjs';
              v.type = 'text/javascript';
              s.parentNode.insertBefore(v, s);
            })(document, 'script');
          `}
        </Script>

        <AuthProvider>
          <LanguageProvider>
            <RTLWrapper>
              <AutoTranslate>
                <div className="flex min-h-screen flex-col bg-soft-grid">
                  <Header />
                  <main className="flex-1">{children}</main>
                  <Footer />
                </div>
              </AutoTranslate>
            </RTLWrapper>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
