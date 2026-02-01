// components/service-features.tsx
"use client"

import {
  CreditCard,
  UserCircle,
  MessageSquare,
  BarChart,
  Shield,
  Zap,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

export default function ServiceFeatures() {
  const { t } = useLanguage()

  const features = [
    {
      icon: UserCircle,
      title: t("Like a calm talk with someone nearby"),
      description: t(
        "TurbotaAI listens carefully, asks gentle questions, and helps you find the next steps at your pace.",
      ),
    },
    {
      icon: MessageSquare,
      title: t("Choose your format"),
      description: t(
        "Type in chat, talk by voice, or use video. Pick what feels most comfortable right now.",
      ),
    },
    {
      icon: BarChart,
      title: t("From a conversation to personal support"),
      description: t(
        "Short talks, gentle exercises, and simple suggestions adapt to you during the dialogue.",
      ),
    },
    {
      icon: Shield,
      title: t("Private and safe space"),
      description: t(
        "Your conversations stay between you and TurbotaAI. They are not used for advertising, and you decide what to keep.",
      ),
    },
    {
      icon: CreditCard,
      title: t("Start for free"),
      description: t(
        "Try it at your pace. Continue if it fits, with no hidden charges.",
      ),
    },
    {
      icon: Zap,
      title: t("Easy to begin"),
      description: t(
        "No waiting and no complex forms. Open TurbotaAI and choose chat, voice, or video.",
      ),
    },
  ]

  return (
    <section className="bg-gradient-to-b from-white via-slate-50 to-white px-4 py-16 sm:py-20 md:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center sm:mb-14">
          <h2 className="mb-3 text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl">
            {t("TurbotaAI — when you need a conversation")}
          </h2>
          <p className="mx-auto max-w-3xl px-2 text-sm text-slate-600 sm:text-base">
            {t(
              "TurbotaAI is made for moments when it matters to know you are not alone. This is a space where you can feel real support.",
            )}
          </p>
          <p className="mx-auto mt-2 max-w-3xl px-2 text-sm text-slate-600 sm:text-base">
            {t(
              "Start a conversation when you truly need it, without waiting and complicated forms.",
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
