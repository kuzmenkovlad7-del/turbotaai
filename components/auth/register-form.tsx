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
import { Eye, EyeOff, AlertCircle, CheckCircle2, Mail, Lock, User, ArrowRight, Brain, MailCheck } from "lucide-react"

export default function RegisterForm() {
  const { t } = useLanguage()
  const { signUp, authDisabled } = useAuth()
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false)

  if (authDisabled) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-5rem)] px-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-gray-600 to-gray-500 rounded-full mb-4 shadow-lg mx-auto">
              <AlertCircle className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              {t("Регистрация временно недоступна")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-600">
              {t("Это демо-окружение. Для работы с реальной регистрацией добавьте ключи Supabase в файл .env.local:")}
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
    setSuccess(false)
    setIsLoading(true)

    try {
      const { data, error } = await signUp(email, password, username)

      if (error) {
        setError(error.message)
        return
      }

      // Check if user needs email confirmation
      if (data?.user && !data.session) {
        setEmailConfirmationSent(true)
        setSuccess(true)
      } else if (data?.session) {
        // User is automatically logged in (email confirmation disabled)
        setSuccess(true)
        setTimeout(() => {
          router.push("/profile")
        }, 1500)
      }
    } catch (err) {
      setError(t("An unexpected error occurred. Please try again."))
    } finally {
      setIsLoading(false)
    }
  }

  const getPasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    return strength
  }

  const passwordStrength = getPasswordStrength(password)
  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-primary-500", "bg-green-500"]
  const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong"]

  // Show email confirmation message if registration was successful but needs confirmation
  if (emailConfirmationSent) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-5rem)]">
        <div className="w-full max-w-md">
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-primary-600 to-primary-500 rounded-full mb-4 mx-auto shadow-lg">
                <MailCheck className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-semibold text-gray-900">{t("Check Your Email")}</CardTitle>
              <CardDescription className="text-gray-600 mt-2">
                {t("We've sent you a confirmation email")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <Mail className="h-5 w-5 text-blue-500 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-blue-800 text-sm font-medium mb-2">{t("Confirmation email sent to:")}</p>
                    <p className="text-blue-700 text-sm font-mono bg-blue-100 px-2 py-1 rounded">{email}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <span className="text-primary-600 text-xs font-bold">1</span>
                  </div>
                  <p className="text-sm text-gray-700">{t("Check your email inbox (and spam folder)")}</p>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <span className="text-primary-600 text-xs font-bold">2</span>
                  </div>
                  <p className="text-sm text-gray-700">{t("Click the confirmation link in the email")}</p>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                    <span className="text-primary-600 text-xs font-bold">3</span>
                  </div>
                  <p className="text-sm text-gray-700">{t("Return here to log in to your account")}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <p className="text-center text-sm text-gray-600 mb-4">{t("Didn't receive the email?")}</p>
                <Button
                  onClick={() => {
                    setEmailConfirmationSent(false)
                    setSuccess(false)
                    setEmail("")
                    setPassword("")
                    setUsername("")
                  }}
                  variant="outline"
                  className="w-full"
                >
                  {t("Try again with different email")}
                </Button>
              </div>

              <div className="text-center">
                <Link href="/login" className="text-primary-600 hover:text-primary-800 font-medium transition-colors">
                  {t("Back to Login")}
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-5rem)]">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-primary-600 to-primary-500 rounded-full mb-4 shadow-lg">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("Join Our Community")}</h1>
          <p className="text-gray-600">{t("Create your account to start your AI Psychology journey")}</p>
        </div>

        {/* Form Container */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-semibold text-center text-gray-900">{t("Create Account")}</CardTitle>
            <CardDescription className="text-center text-gray-600">
              {t("Fill in your details to get started")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
                <AlertCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {success && !emailConfirmationSent && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-green-600 text-sm font-medium">{t("Account created successfully!")}</p>
                  <p className="text-green-600 text-xs mt-1">{t("Redirecting to your profile...")}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                  {t("Username")}
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t("Choose a username")}
                    required
                    minLength={3}
                    maxLength={30}
                    className="pl-10 h-12 border-gray-200 focus:border-primary-500 focus:ring-primary-500 rounded-lg bg-white/50"
                  />
                </div>
                <p className="text-xs text-gray-500">{t("3-30 characters, letters and numbers only")}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  {t("Email Address")}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    required
                    autoComplete="email"
                    className="pl-10 h-12 border-gray-200 focus:border-primary-500 focus:ring-primary-500 rounded-lg bg-white/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  {t("Password")}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="pl-10 pr-12 h-12 border-gray-200 focus:border-primary-500 focus:ring-primary-500 rounded-lg bg-white/50"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t("Hide password") : t("Show password")}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {password && (
                  <div className="mt-2">
                    <div className="flex space-x-1 mb-2">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-2 flex-1 rounded-full ${
                            level <= passwordStrength ? strengthColors[passwordStrength - 1] : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-600">
                      {t("Password strength")}: {t(strengthLabels[passwordStrength - 1] || "Very Weak")}
                    </p>
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-1">
                  {t("At least 8 characters with uppercase, lowercase, number and special character")}
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none shadow-lg"
                disabled={isLoading || success}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    {t("Creating account...")}
                  </div>
                ) : success ? (
                  <div className="flex items-center">
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    {t("Account created!")}
                  </div>
                ) : (
                  <div className="flex items-center">
                    {t("Create Account")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </div>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="pt-6 border-t border-gray-100">
              <p className="text-center text-sm text-gray-600">
                {t("Already have an account?")}{" "}
                <Link href="/login" className="text-primary-600 hover:text-primary-800 font-medium transition-colors">
                  {t("Sign in here")}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            {t("By creating an account, you agree to our")}{" "}
            <Link href="/terms" className="text-primary-600 hover:underline">
              {t("Terms of Service")}
            </Link>{" "}
            {t("and")}{" "}
            <Link href="/privacy" className="text-primary-600 hover:underline">
              {t("Privacy Policy")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
