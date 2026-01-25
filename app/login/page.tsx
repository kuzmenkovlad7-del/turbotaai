"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

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

      // если есть pending promo/purchase — обработка будет на странице назначения
      router.refresh()
      router.push(next)
    } catch (e: any) {
      setMsg(e?.message || copy.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6 lg:px-10">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-3xl">{copy.title}</CardTitle>
          <CardDescription>{copy.desc}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm text-slate-600">{copy.email}</div>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm text-slate-600">{copy.password}</div>
            <Input
              value={password}
              type="password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded-xl"
            />
          </div>

          <Button
            className="w-full rounded-full"
            disabled={busy || !email || !password}
            onClick={doLogin}
          >
            {busy ? copy.loading : copy.login}
          </Button>

          {msg ? <p className="text-sm text-red-600">{msg}</p> : null}

          <div className="flex items-center justify-between text-sm text-slate-600">
            <Link href={next ? `/pricing` : "/pricing"} className="underline">
              {copy.back}
            </Link>

            <div className="flex items-center gap-2">
              <span>{copy.noAcc}</span>
              <Link href={`/register?next=${encodeURIComponent(next)}`} className="underline">
                {copy.reg}
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
