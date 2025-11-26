"use client"

import { useState } from "react"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

const CONTACT_WEBHOOK =
  process.env.NEXT_PUBLIC_N8N_CONTACT_WEBHOOK_URL || ""

export default function ContactForm() {
  const { t } = useLanguage()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!CONTACT_WEBHOOK) {
      setError(
        t(
          "Contact form is temporarily unavailable. Webhook is not configured yet.",
        ),
      )
      return
    }

    if (!email || !message) {
      setError(t("Please fill in your email and message."))
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch(CONTACT_WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          message,
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to send")
      }

      setSuccess(
        t(
          "Your message has been sent. We will reply to you as soon as possible.",
        ),
      )
      setName("")
      setEmail("")
      setMessage("")
    } catch (err) {
      console.error("Contact form error:", err)
      setError(
        t(
          "Something went wrong while sending the message. Please try again a bit later.",
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800">
          {t("Your name")}
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("How can we address you?")}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800">
          {t("Your email")}
        </label>
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800">
          {t("Your message")}
        </label>
        <Textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("Briefly describe your request or idea.")}
          rows={5}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>{success}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="mt-2 w-full h-11 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 shadow-md shadow-primary-500/30 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("Sending...")}
          </span>
        ) : (
          t("Send message")
        )}
      </Button>
    </form>
  )
}
