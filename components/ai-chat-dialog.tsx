"use client"

import { useEffect, useRef, useState } from "react"
import { Send, Loader2, Sparkles } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"

type Props = {
  isOpen: boolean
  onClose: () => void
  webhookUrl?: string
}

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
}

const TURBOTA_AGENT_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_TURBOTA_AGENT_WEBHOOK_URL || ""

const FALLBACK_CHAT_API = "/api/chat"

function extractAnswer(data: any): string {
  if (!data) return ""

  if (typeof data === "string") {
    return data.trim()
  }

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] ?? {}

    return (
      first.text ||
      first.response ||
      first.output ||
      first.message ||
      first.content ||
      first.result ||
      JSON.stringify(first)
    )?.toString().trim()
  }

  if (typeof data === "object") {
    return (
      data.text ||
      data.response ||
      data.output ||
      data.message ||
      data.content ||
      data.result ||
      JSON.stringify(data)
    )?.toString().trim()
  }

  return ""
}

export default function AIChatDialog({ isOpen, onClose, webhookUrl }: Props) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setMessages([])
      setInput("")
      setError(null)
      setIsSending(false)
      setKeyboardOffset(0)
    }
  }, [isOpen])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (!isOpen) return
    if (typeof window === "undefined") return

    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardOffset(offset)
    }

    update()
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)

    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [isOpen])

  const nudgeToComposer = () => {
    if (typeof window === "undefined") return
    window.setTimeout(() => {
      textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    }, 60)
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isSending) return

    const resolvedWebhook =
      (webhookUrl && webhookUrl.trim()) ||
      TURBOTA_AGENT_WEBHOOK_URL.trim() ||
      FALLBACK_CHAT_API

    setError(null)
    setIsSending(true)
    setInput("")

    const langCode =
      typeof (currentLanguage as any) === "string"
        ? ((currentLanguage as any) as string)
        : (currentLanguage as any)?.code || "uk"

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text,
    }

    setMessages((prev) => [...prev, userMessage])

    try {
      const res = await fetch(resolvedWebhook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: text,
          language: langCode,
          email: user?.email ?? null,
          mode: "chat",
        }),
      })
if (res.status === 402) {
  window.location.href = "/pricing"
  return
}


      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`)
      }

      const raw = await res.text()
      let data: any = raw

      try {
        data = JSON.parse(raw)
      } catch {
        // строка
      }

      console.log("Chat raw response:", data)

      let answer = extractAnswer(data)

      if (!answer) {
        answer = t("I'm sorry, I couldn't process your message. Please try again.")
      }

      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: answer,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      console.error("Chat error:", err)
      setError(
        t("AI assistant is temporarily unavailable. Please try again a bit later."),
      )
    } finally {
      setIsSending(false)
      nudgeToComposer()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void sendMessage()
  }

  const __props: any = (typeof arguments !== "undefined" ? (arguments as any)[0] : undefined)
  const controlledOpen: boolean | undefined = typeof __props?.open === "boolean" ? __props.open : undefined
  const extOnOpenChange: ((v: boolean) => void) | undefined = typeof __props?.onOpenChange === "function" ? __props.onOpenChange : undefined


  return (
    <Dialog open={controlledOpen ?? isOpen} onOpenChange={(v) => { extOnOpenChange?.(v); if (!v) { if (typeof onClose === "function") onClose(); } }}>
      <DialogContent
        style={keyboardOffset > 0 ? ({ bottom: keyboardOffset } as any) : undefined}
        className="border-none bg-transparent p-0 w-[calc(100vw-1.5rem)] max-w-[520px] sm:w-full sm:max-w-xl"
      >
        <div className="mx-auto w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/10 ">
          <DialogHeader className="border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 pt-5 pb-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  {t("Chat with AI companion")}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-indigo-100">
                  {t(
                    "Describe what is happening in your own words. The assistant will answer in a few short, structured messages.",
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex h-[500px] flex-col md:h-[540px]">
            <ScrollArea className="flex-1 px-5 pt-4 pb-2">
              <div ref={scrollRef} className="max-h-full space-y-3 pr-1">
                {messages.length === 0 && (
                  <div className="rounded-2xl bg-indigo-50/70 px-3 py-3 text-xs text-slate-700">
                    <p className="font-medium text-slate-900">{t("How to start")}</p>
                    <p className="mt-1">
                      {t(
                        "You can start with one sentence: for example, 'I feel anxious and can't sleep', 'I can't concentrate', or 'I don't know what to do in a relationship'.",
                      )}
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs md:text-sm ${
                        msg.role === "user"
                          ? "rounded-br-sm bg-slate-900 text-white shadow-sm"
                          : "rounded-bl-sm bg-slate-50 text-slate-900 shadow-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {error && <div className="px-5 pb-1 text-xs text-red-600">{error}</div>}

            <form onSubmit={handleSubmit} className="border-t border-slate-100">
              <div className="space-y-2 px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
                <Textarea
                  ref={textareaRef}
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={nudgeToComposer}
                  placeholder={t("Write here what is happening to you...")}
                  className="resize-none text-sm"
                />

                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-slate-400">
                    {t(
                      "In crisis situations, please contact local emergency services immediately.",
                    )}
                  </p>

                  <Button
                    type="submit"
                    size="icon"
                    disabled={isSending || !input.trim()}
                    aria-label={isSending ? t("Sending") : t("Send")}
                    title={isSending ? t("Sending") : t("Send")}
                    className="h-10 w-10 rounded-full bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 disabled:opacity-70"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
