"use client"

import { Mail, Globe, Shield, Clock } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { AutoTranslate } from "./auto-translate"
import ContactForm from "./contact-form"

export default function ContactSection() {
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
      <section
        id="contacts"
        className="border-t border-slate-100 bg-white px-4 py-16 md:px-6 lg:px-8 lg:py-20"
      >
        <div className="mx-auto max-w-6xl">
          {/* Заголовок + мини-статы */}
          <div className="mb-10 text-center md:mb-12">
            <h2 className="mb-3 text-3xl font-bold text-slate-900 md:text-4xl">
              {t("Contact the MyITRA team")}
            </h2>
            <p className="mx-auto max-w-3xl text-sm text-slate-600 sm:text-base">
              {t(
                "If you have questions about how the AI-psychologist works, payments, access or want to discuss partnership — send us a message, and we will reply as soon as possible.",
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
          </div>

          {/* Левая колонка — контакты / правая — форма */}
          <div className="grid items-start gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)]">
            {/* Контактные карточки */}
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
                        <Icon className="contact-icon h-5 w-5" />
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

            {/* Форма */}
            <div className="rounded-2xl bg-slate-50/70 p-4 shadow-sm ring-1 ring-slate-200 sm:p-6 md:p-7 lg:p-8">
              <h3 className="mb-6 text-center text-xl font-semibold text-slate-900 md:text-2xl">
                {t("Send us a message")}
              </h3>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </AutoTranslate>
  )
}
