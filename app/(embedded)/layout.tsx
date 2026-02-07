import type { ReactNode } from "react"
import { Suspense } from "react"
import { AuthProvider } from "@/lib/auth/auth-context"
import { LanguageProvider } from "@/lib/i18n/language-context"

/**
 * Embedded layout — used by /app/voice and /app/video routes.
 *
 * Strips ALL site chrome (Header, Footer, AssistantFab, PaywallToast)
 * so the WebView inside the mobile app looks native, not like a website.
 *
 * Still wraps with AuthProvider + LanguageProvider so auth context
 * and i18n work normally inside the dialog components.
 */
export default function EmbeddedLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AuthProvider>
        <LanguageProvider>
          <div
            style={{
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
              background: "#ffffff",
            }}
          >
            {children}
          </div>
        </LanguageProvider>
      </AuthProvider>
    </Suspense>
  )
}
