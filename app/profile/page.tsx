"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Loader2, Brain } from "lucide-react"

export default function ProfilePage() {
  const { t } = useLanguage()
  const { user, isLoading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [isLoading, user, router])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!user) {
    // редирект уже ушёл, просто ничего не рендерим
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-primary-50">
      <Header />
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-xl mx-auto bg-white/80 backdrop-blur-sm rounded-xl shadow-xl border border-white/20 p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
              <Brain className="h-8 w-8 text-primary-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("Your Profile")}</h1>
            <p className="text-gray-600">
              {t("You are using TurbotaAI in demo mode. Full account features will appear later.")}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase text-gray-500 mb-1">{t("Email")}</p>
              <p className="text-base font-medium text-gray-900">{user.email}</p>
            </div>
          </div>

          <div className="flex justify-end pt-6">
            <Button
              type="button"
              variant="outline"
              className="text-red-600 bg-transparent"
              onClick={async () => {
                await signOut()
                router.push("/")
              }}
            >
              {t("Sign Out")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
