"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BrandMark } from "@/components/brand/BrandMark"

export default function LoginPage() {
  const { currentLanguage } = useLanguage()
  const router = useRouter()
  const sp = useSearchParams()

  const lang = useMemo(() => {
    const code = String(currentLanguage?.code || "uk").toLowerCase()
    return code.startsWith("ru") ? "ru" : code.startsWith("en") ? "en" : "uk"
  }, [currentLanguage?.code])

  const copy = useMemo(() => {
    const c = {
      uk: {
        title: "Вхід",
        desc: "Увійдіть, щоб керувати доступом та історією",
        email: "Email",
        password: "Пароль",
        login: "Увійти",
        loading: "Входимо...",
        noAcc: "Немає акаунта?",
        reg: "Реєстрація",
        back: "Назад",
        error: "Не вдалося увійти",
      },
      ru: {
        title: "Вход",
        desc: "Войдите, чтобы управлять доступом и историей",
        email: "Email",
        password: "Пароль",
        login: "Войти",
        loading: "Входим...",
        noAcc: "Нет аккаунта?",
        reg: "Регистрация",
        back: "Назад",
        error: "Не удалось войти",
      },
      en: {
        title: "Sign in",
        desc: "Sign in to manage access and history",
        email: "Email",
        password: "Password",
        login: "Sign in",
        loading: "Signing in...",
        noAcc: "No account?",
        reg: "Create one",
        back: "Back",
        error: "Login failed",
      },
    }
    return c[lang as "uk" | "ru" | "en"]
  }, [lang])

  const next = useMemo(() => {
    const n = sp.get("next")
    return n && n.startsWith("/") ? n : "/profile"
  }, [sp])

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function doLogin() {
    setMsg(null)
    setBusy(true)
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })
      const d: any = await r.json().catch(() => ({}))
      if (!r.ok || d?.ok === false) {
        throw new Error(d?.error || copy.error)
      }

      router.refresh()
      router.push(next)
    } catch (e: any) {
      setMsg(e?.message || copy.error)
    } finally {
      setBusy(false)
    }
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
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              doLogin()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">{copy.email}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="name@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{copy.password}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>

            {msg ? <p className="text-sm text-red-600">{msg}</p> : null}

            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={busy || !email || !password}
            >
              {busy ? copy.loading : copy.login}
            </Button>

            <div className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground">
              <span>{copy.noAcc}</span>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  router.push(`/register?next=${encodeURIComponent(next)}`)
                }
              >
                {copy.reg}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
