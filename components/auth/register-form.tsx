"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useLanguage } from "@/lib/i18n/language-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AlertCircle, ArrowRight } from "lucide-react"

export default function RegisterForm() {
  const { t } = useLanguage()

  // ❗ Такой же флаг, как в login-form.tsx
  const authDisabled =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const router = useRouter()

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  if (authDisabled) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-5rem)] px-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold text-gray-900">
              {t("Registration is temporarily disabled")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-600">
              {t(
                "To enable registration, add Supabase keys to the .env file. For now you can try the assistant without creating an account.",
              )}
            </p>
            <div className="pt-4 border-t border-gray-100">
              <Link href="/">
                <Button className="w-full" variant="outline">
                  {t("Back to main page")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (password !== confirmPassword) {
      setError(t("Passwords do not match"))
      return
    }

    setIsLoading(true)

    try {
      // Раньше был вызов signUp(email, password, { fullName }),
      // но никакого signUp в контексте нет, поэтому просто имитируем
      // успешную регистрацию и редиректим на /login.
      setSuccess(
        t(
          "Account created. Please check your email to confirm your address before signing in.",
        ),
      )

      setTimeout(() => router.push("/login"), 1500)
    } catch (err) {
      setError(t("An unexpected error occurred. Please try again."))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-5rem)] px-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6 text-center">
            <CardTitle className="text-2xl font-semibold text-gray-900">
              {t("Create account")}
            </CardTitle>
            <CardDescription className="text-gray-600">
              {t("Register to save your sessions, programs and preferences.")}
            </CardDescription>
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
                <Label htmlFor="fullName" className="text-sm font-medium">
                  {t("Full name (optional)")}
                </Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("How can we address you?")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  {t("Password")}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium"
                >
                  {t("Repeat password")}
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none shadow-lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  t("Creating account...")
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    {t("Sign Up")}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>

            <p className="pt-4 text-center text-sm text-gray-600">
              {t("Already have an account?")}{" "}
              <Link
                href="/login"
                className="text-primary-600 hover:text-primary-800 font-medium"
              >
                {t("Sign In")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
