"use client"

import { useState } from "react"
import Link from "next/link"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, ArrowRight } from "lucide-react"

export default function RegisterForm() {
  const { t } = useLanguage()
  const { signUpWithPassword } = useAuth()

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (password !== confirmPassword) {
      setError(t("Passwords do not match"))
      return
    }

    setIsLoading(true)
    const r = await signUpWithPassword(email, password, fullName || undefined)
    setIsLoading(false)

    if (!r.ok) {
      setError(r.error || "Sign-up failed")
      return
    }

    if (r.needsEmailConfirm) {
      setSuccess("Аккаунт создан. Подтвердите email и войдите.")
    } else {
      window.location.href = "/profile"
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-6 text-center">
          <CardTitle className="text-2xl font-semibold text-gray-900">{t("Create account")}</CardTitle>
          <CardDescription className="text-gray-600">{t("Register to save your sessions and preferences.")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t("Full name (optional)")}</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("Password")}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("Repeat password")}</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>

            <Button type="submit" className="w-full h-12" disabled={isLoading}>
              {isLoading ? t("Creating account...") : <span className="flex items-center justify-center gap-2">{t("Sign Up")} <ArrowRight className="h-4 w-4" /></span>}
            </Button>
          </form>

          <p className="pt-2 text-center text-sm text-gray-600">
            {t("Already have an account?")}{" "}
            <Link href="/login" className="text-primary-600 hover:text-primary-800 font-medium">
              {t("Sign In")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
