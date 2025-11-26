// app/login/page.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth/auth-context"

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const { signInDemo, loading } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Демо-логика: просто "логиним" по email в локальном сторе
    await signInDemo(email || "guest@demo.turbotaai.com")
    setMessage(
      "Зараз платформа працює в демо-режимі. Ви вже можете тестувати чат, дзвінки та відео без оплати."
    )
    // Можно сразу вернуть на главную:
    setTimeout(() => router.push("/"), 800)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 md:p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold mb-2">TurbotaAI</h1>
          <p className="text-slate-500 text-sm">
            На етапі тестування сервісу ви можете користуватися платформою без входу.
          </p>
        </div>

        <div className="flex mb-4 rounded-full bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 text-sm py-2 rounded-full ${
              mode === "signin" ? "bg-primary-600 text-white" : "text-slate-600"
            }`}
          >
            Вхід
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 text-sm py-2 rounded-full ${
              mode === "signup" ? "bg-primary-600 text-white" : "text-slate-600"
            }`}
          >
            Реєстрація
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">E-mail</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {mode === "signin" && (
            <div>
              <label className="block text-sm font-medium mb-1">Пароль (поки не обов'язковий)</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}

          {mode === "signup" && (
            <p className="text-xs text-slate-500">
              На етапі тестування повноцінна реєстрація ще не потрібна — достатньо ввести e-mail,
              щоб отримати демо-доступ.
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-primary-600 hover:bg-primary-700">
            {mode === "signin" ? "Увійти (демо)" : "Зареєструватися (демо)"}
          </Button>
        </form>

        <div className="mt-4 text-xs text-slate-500 text-center">
          Або просто поверніться на головну і оберіть формат: чат, дзвінок або відео — зараз доступно
          без входу.
        </div>

        {message && (
          <div className="mt-4 text-xs text-emerald-600 text-center bg-emerald-50 rounded-lg p-2">
            {message}
          </div>
        )}
      </div>
    </div>
  )
}
