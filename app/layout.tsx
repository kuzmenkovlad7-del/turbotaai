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

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Myitra",
  description: "Professional AI-powered psychological support and counseling services",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
  generator: "v0.app",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  // Myitra light theme only
  themeColor: "#F7F8FF",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
