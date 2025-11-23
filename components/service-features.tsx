"use client"

import {
  Clock,
  CreditCard,
  UserCircle,
  Globe,
  BarChart,
  Shield,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

export default function ServiceFeatures() {
  const { t } = useLanguage()

  const features = [
    {
      icon: Clock,
      title: t("Support in minutes, not weeks"),
      description: t(
        "Open chat, voice or video exactly when it feels bad — without waiting lists, schedules or registration forms.",
      ),
    },
    {
      icon: UserCircle,
      title: t("Feels like a calm human conversation"),
      description: t(
        "The assistant listens, asks gentle clarifying questions and offers exercises instead of generic advice.",
      ),
    },
    {
      icon: Globe,
      title: t("Ukrainian, Russian and English"),
      description: t(
        "MyITRA automatically adapts to your language and can switch during the conversation if you change it.",
      ),
    },
    {
      icon: BarChart,
      title: t("Helps notice your progress"),
      description: t(
        "Session history and mood dynamics help you see small steps forward, even when it feels like nothing changes.",
      ),
    },
    {
      icon: Shield,
      title: t("Safe and confidential space"),
      description: t(
        "Your conversations are encrypted and not used for advertising. You decide what to share and when to delete it.",
      ),
    },
    {
      icon: CreditCard,
      title: t("Transparent pricing without subscriptions"),
      description: t(
        "First minutes are free; after that you only pay for the time you actually use. No hidden fees or long-term contracts.",
      ),
    },
  ]

  return (
    <section className="bg-gradient-to-b from-white via-slate-50 to-white px-4 py-16 sm:py-20 md:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center sm:mb-14">
          <h2 className="mb-3 text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl">
            {t("Why people choose MyITRA")}
          </h2>
          <p className="mx-auto max-w-3xl px-2 text-sm text-slate-600 sm:text-base">
            {t(
              "MyITRA is built for moments when you have no strength to search for a therapist or wait for an appointment, but really need someone to talk to right now.",
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="flex h-full flex-col rounded-3xl bg-slate-50/80 p-5 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:bg-white hover:shadow-lg hover:shadow-indigo-100/70"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-slate-900 sm:text-lg">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
