"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff, AlertCircle, Mail, Lock, ArrowRight, Brain } from "lucide-react"

export default function LoginForm() {
  const { t } = useLanguage()
  const { signIn, authDisabled } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (authDisabled) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-5rem)] px-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-gray-600 to-gray-500 rounded-full mb-4 shadow-lg mx-auto">
              <AlertCircle className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              {t("Авторизация временно отключена")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-600">
              {t("Это демо-окружение. Для работы с реальной авторизацией добавьте ключи Supabase в файл .env.local:")}
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-xs space-y-2">
              <div className="text-gray-700">NEXT_PUBLIC_SUPABASE_URL=...</div>
              <div className="text-gray-700">NEXT_PUBLIC_SUPABASE_ANON_KEY=...</div>
            </div>
            <div className="pt-4 border-t border-gray-100">
              <Link href="/">
                <Button className="w-full" variant="outline">
                  {t("Вернуться на главную")}
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
    setIsLoading(true)

    try {
      const { error } = await signIn(email, password)

      if (error) {
        setError(error.message)
        return
      }

      router.push("/profile")
    } catch (err) {
      setError(t("An unexpected error occurred. Please try again."))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-5rem)] px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-primary to-accent rounded-full mb-4 shadow-lg">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("Welcome Back")}</h1>
          <p className="text-gray-600">{t("Sign in to continue your journey with AI Psychology")}</p>
        </div>

        {/* Form Container */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-semibold text-center text-gray-900">{t("Sign In")}</CardTitle>
            <CardDescription className="text-center text-gray-600">
              {t("Enter your credentials to access your account")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
                <AlertCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  {t("Email Address")}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    required
                    autoComplete="email"
                    inputMode="email"
                    className="pl-10 h-12 border-gray-200 focus:border-primary-500 focus:ring-primary-500 rounded-lg bg-white/50 touch-manipulation"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    {t("Password")}
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary-600 hover:text-primary-800 font-medium touch-manipulation"
                  >
                    {t("Forgot password?")}
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pl-10 pr-12 h-12 border-gray-200 focus:border-primary-500 focus:ring-primary-500 rounded-lg bg-white/50 touch-manipulation"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t("Hide password") : t("Show password")}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none shadow-lg touch-manipulation"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    {t("Signing in...")}
                  </div>
                ) : (
                  <div className="flex items-center">
                    {t("Sign In")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </div>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="pt-6 border-t border-gray-100">
              <p className="text-center text-sm text-gray-600">
                {t("Don't have an account?")}{" "}
                <Link
                  href="/register"
                  className="text-primary-600 hover:text-primary-800 font-medium transition-colors"
                >
                  {t("Create account")}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            {t("By signing in, you agree to our")}{" "}
            <Link href="/terms-of-use" className="text-primary hover:underline">
              {t("Terms of Service")}
            </Link>{" "}
            {t("and")}{" "}
            <Link href="/privacy-policy" className="text-primary hover:underline">
              {t("Privacy Policy")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
