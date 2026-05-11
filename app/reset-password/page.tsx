"use client"

import { useEffect, useState } from "react"
import { BrandMark } from "@/components/brand/BrandMark"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase-client"

type Lang = "en" | "uk" | "ru"

type PageState =
  | "loading"     // parsing hash + calling setSession
  | "ready"       // session set, show password form
  | "invalid"     // missing/expired/bad token
  | "submitting"
  | "success"

const COPY = {
  en: {
    brand: "TurbotaAI",
    title: "Set new password",
    subtitle: "Enter your new password below.",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    submit: "Update password",
    submitting: "Updating…",
    verifying: "Verifying reset link…",
    invalidTitle: "Invalid or expired link",
    invalidDesc:
      "This reset link is invalid or has expired. Please request a new password reset from the app.",
    invalidHint: "Request a new reset link from the app",
    success:
      "Password updated successfully. You can now return to the TurbotaAI app.",
    errorSupabase: "Service is not configured. Contact support.",
    errorMinLength: "Password must be at least 8 characters.",
    errorMatch: "Passwords do not match.",
    errorUpdate:
      "We could not update your password. The link may have expired, or the new password may be the same as your old password. Please try a different password or request a new reset link.",
  },
  uk: {
    brand: "TurbotaAI",
    title: "Встановити новий пароль",
    subtitle: "Введіть новий пароль нижче.",
    newPassword: "Новий пароль",
    confirmPassword: "Підтвердіть новий пароль",
    submit: "Оновити пароль",
    submitting: "Оновлення…",
    verifying: "Перевірка посилання…",
    invalidTitle: "Недійсне або застаріле посилання",
    invalidDesc:
      "Це посилання для відновлення недійсне або застаріло. Будь ласка, запросіть нове посилання у застосунку.",
    invalidHint: "Запросіть нове посилання у застосунку",
    success:
      "Пароль успішно оновлено. Тепер ви можете повернутися до застосунку TurbotaAI.",
    errorSupabase: "Сервіс не налаштовано. Зверніться до підтримки.",
    errorMinLength: "Пароль має містити щонайменше 8 символів.",
    errorMatch: "Паролі не збігаються.",
    errorUpdate:
      "Не вдалося оновити пароль. Посилання могло застаріти, або новий пароль збігається зі старим. Спробуйте інший пароль або запросіть нове посилання для відновлення.",
  },
  ru: {
    brand: "TurbotaAI",
    title: "Установить новый пароль",
    subtitle: "Введите новый пароль ниже.",
    newPassword: "Новый пароль",
    confirmPassword: "Подтвердите новый пароль",
    submit: "Обновить пароль",
    submitting: "Обновление…",
    verifying: "Проверка ссылки…",
    invalidTitle: "Недействительная или устаревшая ссылка",
    invalidDesc:
      "Эта ссылка для сброса пароля недействительна или устарела. Пожалуйста, запросите новую ссылку в приложении.",
    invalidHint: "Запросите новую ссылку в приложении",
    success:
      "Пароль успешно обновлëн. Теперь вы можете вернуться в приложение TurbotaAI.",
    errorSupabase: "Сервис не настроен. Обратитесь в поддержку.",
    errorMinLength: "Пароль должен содержать минимум 8 символов.",
    errorMatch: "Пароли не совпадают.",
    errorUpdate:
      "Не удалось изменить пароль. Возможно, ссылка истекла или новый пароль совпадает со старым. Попробуйте другой пароль или запросите новую ссылку заново.",
  },
} as const satisfies Record<Lang, Record<string, string>>

function detectLang(): Lang {
  if (typeof window === "undefined") return "en"
  const q = new URLSearchParams(window.location.search).get("lang")
  if (q === "uk" || q === "en" || q === "ru") return q
  const nav = (navigator.language || "").toLowerCase()
  if (nav.startsWith("uk")) return "uk"
  if (nav.startsWith("ru")) return "ru"
  return "en"
}

export default function ResetPasswordPage() {
  const [lang, setLang] = useState<Lang>("en")
  const [pageState, setPageState] = useState<PageState>("loading")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  // error is only set for inline form errors; invalid state uses c.invalidDesc
  const [error, setError] = useState<string | null>(null)

  // c is always up-to-date once lang is set (default "en" on server, corrected
  // to the detected locale after the first client render)
  const c = COPY[lang]

  // Detect language, then parse the Supabase recovery hash and establish session.
  // Supabase password-reset emails append tokens to the URL hash:
  //   #access_token=...&refresh_token=...&type=recovery
  useEffect(() => {
    const detectedLang = detectLang()
    setLang(detectedLang)
    const lc = COPY[detectedLang]

    if (!supabase) {
      setPageState("invalid")
      setError(lc.errorSupabase)
      return
    }

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const accessToken = params.get("access_token")
    const refreshToken = params.get("refresh_token")

    if (!accessToken || !refreshToken) {
      setPageState("invalid")
      return
    }

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: sessionErr }) => {
        setPageState(sessionErr ? "invalid" : "ready")
      })
      .catch(() => setPageState("invalid"))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(c.errorMinLength)
      return
    }
    if (password !== confirm) {
      setError(c.errorMatch)
      return
    }
    if (!supabase) {
      setError(c.errorSupabase)
      return
    }

    setPageState("submitting")
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    if (updateErr) {
      setPageState("ready")
      setError(c.errorUpdate)
    } else {
      setPageState("success")
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center px-4 py-10">
      <Card className="w-full">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex items-center justify-center">
            <BrandMark size={36} />
          </div>
          <CardTitle className="text-2xl">{c.brand}</CardTitle>
          <p className="text-sm text-muted-foreground">{c.title}</p>
        </CardHeader>

        <CardContent>
          {/* Loading */}
          {pageState === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">{c.verifying}</p>
            </div>
          )}

          {/* Invalid / expired link */}
          {pageState === "invalid" && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-5 text-center">
              <p className="text-sm font-semibold text-destructive">{c.invalidTitle}</p>
              <p className="mt-1 text-sm text-destructive/80">
                {error ?? c.invalidDesc}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">{c.invalidHint}</p>
            </div>
          )}

          {/* Success */}
          {pageState === "success" && (
            <div className="rounded-md border border-green-500/40 bg-green-50 px-4 py-4 text-center dark:bg-green-950/30">
              <p className="text-sm text-green-700 dark:text-green-400">{c.success}</p>
            </div>
          )}

          {/* Password form */}
          {(pageState === "ready" || pageState === "submitting") && (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <p className="text-sm text-muted-foreground">{c.subtitle}</p>

              <div className="space-y-2">
                <Label htmlFor="password">{c.newPassword}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={pageState === "submitting"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">{c.confirmPassword}</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  disabled={pageState === "submitting"}
                />
              </div>

              {error && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={pageState === "submitting"}
              >
                {pageState === "submitting" ? c.submitting : c.submit}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
