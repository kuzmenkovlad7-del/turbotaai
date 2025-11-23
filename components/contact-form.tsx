"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/lib/i18n/language-context"
import { Send, CheckCircle } from "lucide-react"

export default function ContactForm() {
  const { t } = useLanguage()
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormState((prev) => ({ ...prev, [name]: value }))
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formState.name.trim()) {
      newErrors.name = t("Name is required")
    }

    if (!formState.email.trim()) {
      newErrors.email = t("Email is required")
    } else if (!/^\S+@\S+\.\S+$/.test(formState.email)) {
      newErrors.email = t("Please enter a valid email address")
    }

    if (!formState.subject.trim()) {
      newErrors.subject = t("Subject is required")
    }

    if (!formState.message.trim()) {
      newErrors.message = t("Message is required")
    } else if (formState.message.length < 10) {
      newErrors.message = t("Message must be at least 10 characters")
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    // Simulate API call
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setIsSubmitted(true)
      setFormState({
        name: "",
        email: "",
        subject: "",
        message: "",
      })
    } catch (error) {
      console.error("Error submitting form:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {isSubmitted ? (
        <div className="bg-primary/10 p-8 rounded-xl text-center">
          <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-primary mb-2">{t("Thank you for your message!")}</h3>
          <p className="text-foreground mb-4">
            {t("We've received your inquiry and will get back to you as soon as possible.")}
          </p>
          <Button onClick={() => setIsSubmitted(false)} className="bg-primary-600 hover:bg-primary-700 text-white">
            {t("Send another message")}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              {t("Your Name")} <span className="text-red-500">*</span>
            </label>
            <Input
              id="name"
              name="name"
              value={formState.name}
              onChange={handleChange}
              placeholder={t("Enter your full name")}
              className={`${errors.name ? "border-red-500" : "border-gray-300"}`}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
            {errors.name && (
              <p id="name-error" className="mt-1 text-sm text-red-600">
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              {t("Email Address")} <span className="text-red-500">*</span>
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formState.email}
              onChange={handleChange}
              placeholder={t("Enter your email address")}
              className={`${errors.email ? "border-red-500" : "border-gray-300"}`}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {errors.email && (
              <p id="email-error" className="mt-1 text-sm text-red-600">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
              {t("Subject")} <span className="text-red-500">*</span>
            </label>
            <Input
              id="subject"
              name="subject"
              value={formState.subject}
              onChange={handleChange}
              placeholder={t("Enter the subject of your message")}
              className={`${errors.subject ? "border-red-500" : "border-gray-300"}`}
              aria-invalid={!!errors.subject}
              aria-describedby={errors.subject ? "subject-error" : undefined}
            />
            {errors.subject && (
              <p id="subject-error" className="mt-1 text-sm text-red-600">
                {errors.subject}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
              {t("Your Message")} <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="message"
              name="message"
              value={formState.message}
              onChange={handleChange}
              placeholder={t("Type your message here...")}
              rows={6}
              className={`${errors.message ? "border-red-500" : "border-gray-300"} resize-none`}
              aria-invalid={!!errors.message}
              aria-describedby={errors.message ? "message-error" : undefined}
            />
            {errors.message && (
              <p id="message-error" className="mt-1 text-sm text-red-600">
                {errors.message}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary-700 hover:bg-primary-800 text-white px-8 py-6 text-lg flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  {t("Sending...")}
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  {t("Send Message")}
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
