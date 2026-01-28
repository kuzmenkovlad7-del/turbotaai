"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Mail, Lock, ArrowRight, Brain } from "lucide-react"

function safeNext(v: string | null) {
  const p = String(v || "").trim()
  return p.startsWith("/") ? p : "/profile"
}

export default function LoginForm() {
  const { t } = useLanguage()
  const { signInWithPassword } = useAuth()
  const sp = useSearchParams()

  const next = useMemo(() => safeNext(sp.get("next")), [sp])
  const promo = useMemo(() => (sp.get("promo") === "1" ? "1" : "0"), [sp])

  const registerHref = useMemo(() => {
    const q = new URLSearchParams()
    q.set("next", next)
    if (promo === "1") q.set("promo", "1")
    return `/register?${q.toString()}`
  }, [next, promo])

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    const r = await signInWithPassword(email, password)
    setIsLoading(false)
    if (!r.ok) setError(r.error || "Sign-in failed")
    else window.location.href = next
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-primary to-accent rounded-full mb-4 shadow-lg">
          <Brain className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("Welcome Back")}</h1>
        <p className="text-gray-600">{t("Sign in to continue")}</p>
      </div>

      <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-2xl font-semibold text-center text-gray-900">{t("Sign In")}</CardTitle>
          <CardDescription className="text-center text-gray-600">{t("Enter your credentials")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">{t("Email Address")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                  className="pl-10 h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("Password")}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 h-12"
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-12" disabled={isLoading}>
              {isLoading ? (
                t("Signing in...")
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {t("Sign In")} <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-600">
            {t("Don't have an account?")}{" "}
            <Link href={registerHref} className="text-primary-600 hover:text-primary-800 font-medium">
              {t("Create account")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
