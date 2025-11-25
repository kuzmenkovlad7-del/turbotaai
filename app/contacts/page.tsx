// app/contacts/page.tsx
"use client"

import { Mail, Clock, Globe, Shield } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import ContactForm from "@/components/contact-form"
import { AutoTranslate } from "@/components/auto-translate"

export default function ContactsPage() {
  const { t } = useLanguage()

  const contactInfo = [
    {
      icon: Mail,
      title: t("Email us"),
      details: "support@aipsychologist.com",
      description: t(
        "All questions about the service, payments, access to the assistant or cooperation — please write to this address.",
      ),
    },
  ]

  const stats = [
    {
      icon: Clock,
      label: t("Average reply time"),
      value: t("within 24 hours"),
    },
    {
      icon: Globe,
      label: t("Languages"),
      value: t("Ukrainian · Russian · English (other later)"),
    },
    {
      icon: Shield,
      label: t("Privacy"),
      value: t("encrypted conversations"),
    },
  ]

  return (
    <AutoTranslate>
      <main className="min-h-[calc(100vh-96px)] bg-gradient-to-b from-white via-slate-50 to-white">
        <section className="px-4 py-16 md:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-6xl">
            {/* Hero */}
            <header className="mb-10 text-center md:mb-14">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {t("Support, partnerships and press")}
              </div>

              <h1 className="mb-3 text-3xl font-bold text-slate-900 sm:text-4xl md:text-5xl">
                {t("Contact MyITRA team")}
              </h1>
              <p className="mx-auto max-w-3xl text-sm text-slate-600 sm:text-base">
                {t(
                  "Have questions about how the AI-psychologist works, want to discuss partnership or need help with your account? Leave a request — we will answer as soon as possible.",
                )}
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {stats.map((item) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={item.label}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-600 ring-1 ring-slate-200"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="font-medium">{item.label} ·</span>
                      <span className="text-slate-500">{item.value}</span>
                    </div>
                  )
                })}
              </div>
            </header>

            {/* Content grid */}
            <div className="grid items-start gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)]">
              {/* Left: contact card + note */}
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  {contactInfo.map((item) => {
                    const Icon = item.icon
                    return (
                      <div
                        key={item.title}
                        className="flex h-full flex-col rounded-2xl bg-slate-50/80 p-5 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:bg-white hover:shadow-md hover:shadow-indigo-100/60"
                      >
                        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h3 className="mb-1 text-base font-semibold text-slate-900">
                          {item.title}
                        </h3>
                        <p className="mb-1 text-sm font-medium text-indigo-600">
                          {item.details}
                        </p>
                        <p className="text-xs text-slate-600 sm:text-sm">
                          {item.description}
                        </p>
                      </div>
                    )
                  })}
                </div>

                <div className="rounded-2xl bg-slate-50/70 p-5 text-sm text-slate-600 ring-1 ring-slate-200">
                  {t(
                    "For urgent situations, please contact local emergency services or a crisis line in your country. MyITRA is not a substitute for emergency medical help.",
                  )}
                </div>
              </div>

              {/* Right: form */}
              <div className="rounded-2xl bg-slate-50/80 p-4 shadow-sm ring-1 ring-slate-200 sm:p-6 md:p-7 lg:p-8">
                <h2 className="mb-6 text-center text-xl font-semibold text-slate-900 md:text-2xl">
                  {t("Send us a message")}
                </h2>
                <ContactForm />
              </div>
            </div>
          </div>
        </section>
      </main>
    </AutoTranslate>
  )
}
