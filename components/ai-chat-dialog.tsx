"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, Send, Bot, User, Loader2, Globe } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useAuth } from "@/lib/auth/auth-context"

interface Message {
  id: string
  content: string
  sender: "user" | "ai"
  timestamp: Date
  language: string
}

interface AIChatDialogProps {
  isOpen: boolean
  onClose: () => void
  onError?: (error: Error) => void
}

export default function AIChatDialog({ isOpen, onClose, onError }: AIChatDialogProps) {
  const { t, currentLanguage } = useLanguage()
  const { user } = useAuth()

  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Фокус при открытии
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Приветствие при первом открытии / смене языка
  useEffect(() => {
    if (!isOpen) return

    if (messages.length === 0) {
      const greetings: Record<string, string> = {
        en: "Hello! I'm your AI psychologist. How can I help you today?",
        ru: "Здравствуйте! Я ваш ИИ-психолог. Как я могу помочь вам сегодня?",
        uk: "Вітаю! Я ваш ШІ-психолог. Як я можу допомогти вам сьогодні?",
      }

      const code = currentLanguage.code as "en" | "ru" | "uk"
      const greeting = greetings[code] || greetings.en

      setMessages([
        {
          id: "initial",
          content: greeting,
          sender: "ai",
          timestamp: new Date(),
          language: currentLanguage.code,
        },
      ])
    }
  }, [isOpen, messages.length, currentLanguage.code])

  // Вызов нашего API `/api/chat`
  const processMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return

      setIsLoading(true)
      setIsTyping(true)

      try {
        console.log(
          `📤 Sending chat message in ${currentLanguage.name} (${currentLanguage.code}):`,
          message,
        )

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: message,
            language: currentLanguage.code,
            email: user?.email || null,
          }),
        })

        if (!res.ok) {
          throw new Error(`Chat API error: ${res.status}`)
        }

        const data = await res.json()
        const aiText: string =
          (data && (data.text as string)) ||
          t("I'm sorry, I couldn't process your message. Please try again.")

        const aiMessage: Message = {
          id: `${Date.now()}-ai`,
          content: aiText,
          sender: "ai",
          timestamp: new Date(),
          language: currentLanguage.code,
        }

        setMessages((prev) => [...prev, aiMessage])
      } catch (error: any) {
        console.error("Error processing chat message:", error)
        const errorMessage = t("I'm sorry, I couldn't process your message. Please try again.")

        const aiMessage: Message = {
          id: `${Date.now()}-error`,
          content: errorMessage,
          sender: "ai",
          timestamp: new Date(),
          language: currentLanguage.code,
        }

        setMessages((prev) => [...prev, aiMessage])

        if (onError) onError(error)
      } finally {
        setIsLoading(false)
        setIsTyping(false)
      }
    },
    [currentLanguage.code, currentLanguage.name, user?.email, t, onError],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!inputValue.trim() || isLoading) return

      const trimmed = inputValue.trim()

      const userMessage: Message = {
        id: `${Date.now()}-user`,
        content: trimmed,
        sender: "user",
        timestamp: new Date(),
        language: currentLanguage.code,
      }

      setMessages((prev) => [...prev, userMessage])
      setInputValue("")

      await processMessage(trimmed)
    },
    [inputValue, isLoading, currentLanguage.code, processMessage],
  )

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSubmit(e as any)
      }
    },
    [handleSubmit],
  )

  const formatTime = useCallback(
    (date: Date) =>
      date.toLocaleTimeString(currentLanguage.code, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [currentLanguage.code],
  )

  if (!isOpen) return null

  const guestLabels: Record<string, string> = {
    en: "Guest (not signed in)",
    ru: "Гость (без входа)",
    uk: "Гість (без входу)",
  }

  const userEmailDisplay = user?.email || guestLabels[currentLanguage.code] || guestLabels.en

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col h-[80vh] max-h-[600px] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-primary-600 text-white rounded-t-xl">
          <div className="flex flex-col">
            <h3 className="font-bold text-lg">{t("AI Psychologist Chat")}</h3>
            <div className="text-xs text-slate-200">
              {t("User")}: {userEmailDisplay}
            </div>
            <div className="text-xs text-slate-200 mt-1 flex items-center">
              <Globe className="h-3 w-3 mr-1" />
              {t("Language")}: {currentLanguage.name} {currentLanguage.flag}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-primary-700"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Subtitle */}
        <div className="px-4 py-2 bg-slate-50 border-b">
          <p className="text-sm text-slate-700 text-center">
            {t("Chat communication in {{language}}", { language: currentLanguage.name })} •{" "}
            {t("AI will understand and respond in this language")}
          </p>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`flex max-w-[80%] ${
                    message.sender === "user" ? "flex-row-reverse" : "flex-row"
                  } items-start space-x-2`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.sender === "user"
                        ? "bg-primary-600 text-white ml-2"
                        : "bg-slate-200 text-slate-600 mr-2"
                    }`}
                  >
                    {message.sender === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      message.sender === "user"
                        ? "bg-primary-600 text-white"
                        : "bg-slate-100 text-slate-900"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p
                        className={`text-xs ${
                          message.sender === "user"
                            ? "text-primary-200"
                            : "text-slate-500"
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </p>
                      {message.language && (
                        <span
                          className={`text-xs ml-2 px-1 py-0.5 rounded ${
                            message.sender === "user"
                              ? "bg-primary-700 text-primary-200"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {message.language.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center mr-2">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-slate-100 rounded-lg px-4 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" />
                      <div
                        className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"
                        style={{ animationDelay: "0.2s" }}
                      />
                      <div
                        className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"
                        style={{ animationDelay: "0.4s" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t bg-slate-50">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t("Type your message in {{language}}...", {
                language: currentLanguage.name,
              })}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="bg-primary-600 hover:bg-primary-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="text-xs text-slate-500 mt-2 text-center">
            {t("Press Enter to send • AI responds in {{language}}", {
              language: currentLanguage.name,
            })}
          </p>
        </div>
      </div>
    </div>
  )
}
