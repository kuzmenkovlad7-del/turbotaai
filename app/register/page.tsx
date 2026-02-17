"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BrandMark } from "@/components/brand/BrandMark"
import { useLanguage } from "@/lib/i18n/language-context"
import { trackSignup, trackTrialStart } from "@/lib/tracking"

export default function RegisterPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const { currentLanguage } = useLanguage()

  const lang = useMemo(() => {
    const code = String(currentLanguage?.code || "uk").toLowerCase()
    return code.startsWith("ru") ? "ru" : code.startsWith("en") ? "en" : "uk"
  }, [currentLanguage?.code])

  const copy = useMemo(() => {
    const c = {
      uk: {
        title: "Створити акаунт",
        desc: "Зареєструйтесь, щоб зберегти сесії та керувати доступом",
        fullName: "Повне імʼя (необовʼязково)",
        namePh: "Ваше імʼя",
        email: "Email",
        emailPh: "you@email.com",
        password: "Пароль",
        creating: "Створюємо...",
        signUp: "Зареєструватися",
        hasAccount: "Вже маєте акаунт?",
        signIn: "Увійти",
        errFields: "Введіть email та пароль",
        errGeneric: "Не вдалося зареєструватися",
        okCreated: "Акаунт створено",
        okCreatedSignIn: "Акаунт створено. Будь ласка, увійдіть.",
      },
      ru: {
        title: "Создать аккаунт",
        desc: "Зарегистрируйтесь, чтобы сохранить сессии и управлять доступом",
        fullName: "Полное имя (необязательно)",
        namePh: "Ваше имя",
        email: "Email",
        emailPh: "you@email.com",
        password: "Пароль",
        creating: "Создаём...",
        signUp: "Зарегистрироваться",
        hasAccount: "Уже есть аккаунт?",
        signIn: "Войти",
        errFields: "Введите email и пароль",
        errGeneric: "Не удалось зарегистрироваться",
        okCreated: "Аккаунт создан",
        okCreatedSignIn: "Аккаунт создан. Пожалуйста, войдите.",
      },
      en: {
        title: "Create account",
        desc: "Sign up to save sessions and manage access",
        fullName: "Full name (optional)",
        namePh: "Your name",
        email: "Email",
        emailPh: "you@email.com",
        password: "Password",
        creating: "Creating...",
        signUp: "Sign Up",
        hasAccount: "Already have an account?",
        signIn: "Sign In",
        errFields: "Please enter email and password",
        errGeneric: "Registration failed",
        okCreated: "Account created",
        okCreatedSignIn: "Account created. Please sign in.",
      },
    }
    return c[lang as "uk" | "ru" | "en"]
  }, [lang])

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [successText, setSuccessText] = useState<string | null>(null)

  useEffect(() => {
    const q = (sp.get("email") || "").trim()
    if (q) setEmail(q)
  }, [sp])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorText(null)
    setSuccessText(null)

    const e1 = email.trim()
    const n1 = fullName.trim()

    if (!e1 || !password) {
      setErrorText(copy.errFields)
      return
    }

    setLoading(true)
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: e1,
          password,
          fullName: n1 || null,
          full_name: n1 || null,
          name: n1 || null,
        }),
      })

      const data = await r.json().catch(() => ({} as any))
      if (!r.ok || data?.ok === false) {
        setErrorText(data?.error || copy.errGeneric)
        return
      }

      trackSignup("email")
      trackTrialStart()

      const r2 = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: e1, password }),
      })

      const data2 = await r2.json().catch(() => ({} as any))
      if (!r2.ok || data2?.ok === false) {
        setSuccessText(copy.okCreatedSignIn)
        router.replace(`/login?email=${encodeURIComponent(e1)}`)
        return
      }

      setSuccessText(copy.okCreated)
      router.replace("/profile")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  function goLogin() {
    const e1 = email.trim()
    router.push(e1 ? `/login?email=${encodeURIComponent(e1)}` : "/login")
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center px-4 py-10">
      <Card className="w-full">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex items-center justify-center">
            <BrandMark size={36} />
          </div>
          <CardTitle className="text-3xl">{copy.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{copy.desc}</p>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="fullName">{copy.fullName}</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                placeholder={copy.namePh}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{copy.email}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder={copy.emailPh}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{copy.password}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </div>

            {errorText ? <p className="text-sm text-red-600">{errorText}</p> : null}
            {successText ? <p className="text-sm text-green-600">{successText}</p> : null}

            <Button type="submit" variant="outline" className="w-full" disabled={loading}>
              {loading ? copy.creating : copy.signUp}
            </Button>

            <div className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground">
              <span>{copy.hasAccount}</span>
              <Button type="button" variant="outline" onClick={goLogin}>
                {copy.signIn}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
