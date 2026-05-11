"use client"

import { useEffect, useState } from "react"
import { BrandMark } from "@/components/brand/BrandMark"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase-client"

type PageState =
  | "loading"   // parsing hash + calling setSession
  | "ready"     // session set, show password form
  | "invalid"   // missing/expired token
  | "submitting"
  | "success"

const copy = {
  title: "Set new password",
  subtitle: "Enter your new password below.",
  newPassword: "New password",
  confirmPassword: "Confirm password",
  submit: "Update password",
  success: "Password updated successfully. You can now return to the TurbotaAI app.",
  errorInvalid: "This reset link is invalid or has expired. Please request a new password reset from the app.",
  errorSupabase: "Supabase is not configured. Contact support.",
  errorMinLength: "Password must be at least 8 characters.",
  errorMatch: "Passwords do not match.",
  errorUpdate: "Could not update password. The link may have expired.",
}

export default function ResetPasswordPage() {
  const [pageState, setPageState] = useState<PageState>("loading")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Parse the Supabase recovery hash and establish a session.
  // Supabase password-reset emails append the tokens to the URL hash:
  //   #access_token=...&refresh_token=...&type=recovery
  useEffect(() => {
    if (!supabase) {
      setPageState("invalid")
      setError(copy.errorSupabase)
      return
    }

    const hash = typeof window !== "undefined" ? window.location.hash : ""
    const params = new URLSearchParams(hash.replace(/^#/, ""))
    const accessToken = params.get("access_token")
    const refreshToken = params.get("refresh_token")

    if (!accessToken || !refreshToken) {
      setPageState("invalid")
      setError(copy.errorInvalid)
      return
    }

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: sessionErr }) => {
        if (sessionErr) {
          setPageState("invalid")
          setError(copy.errorInvalid)
        } else {
          setPageState("ready")
        }
      })
      .catch(() => {
        setPageState("invalid")
        setError(copy.errorInvalid)
      })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(copy.errorMinLength)
      return
    }
    if (password !== confirm) {
      setError(copy.errorMatch)
      return
    }
    if (!supabase) {
      setError(copy.errorSupabase)
      return
    }

    setPageState("submitting")
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    if (updateErr) {
      setPageState("ready")
      setError(copy.errorUpdate)
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
          <CardTitle className="text-2xl">TurbotaAI</CardTitle>
          <p className="text-sm text-muted-foreground">{copy.title}</p>
        </CardHeader>

        <CardContent>
          {/* Loading state */}
          {pageState === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Verifying reset link…</p>
            </div>
          )}

          {/* Invalid / expired link */}
          {pageState === "invalid" && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-4 text-center">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Success */}
          {pageState === "success" && (
            <div className="rounded-md border border-green-500/40 bg-green-50 px-4 py-4 text-center dark:bg-green-950/30">
              <p className="text-sm text-green-700 dark:text-green-400">{copy.success}</p>
            </div>
          )}

          {/* Password form */}
          {(pageState === "ready" || pageState === "submitting") && (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <p className="text-sm text-muted-foreground">{copy.subtitle}</p>

              <div className="space-y-2">
                <Label htmlFor="password">{copy.newPassword}</Label>
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
                <Label htmlFor="confirm">{copy.confirmPassword}</Label>
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
                {pageState === "submitting" ? "Updating…" : copy.submit}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
