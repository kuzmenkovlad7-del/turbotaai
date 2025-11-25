// app/programs/page.tsx
"use client"

import { CheckCircle2, Clock, HeartPulse, Brain } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { AutoTranslate } from "@/components/auto-translate"

type Program = {
  id: string
  name: string
  tag: string
  description: string
  suitsFor: string[]
  format: string
}

export default function ProgramsPage() {
  const { t } = useLanguage()

  const programs: Program[] = [
    {
      id: "crisis",
      name: t("When it feels bad right now"),
      tag: t("Single support session"),
      description: t(
        "One-time session when it feels very bad and you need support right now without waiting.",
      ),
      suitsFor: [
        t("Sudden anxiety, panic, difficult evening or night."),
        t("You want to share what is happening, but there is no safe person nearby."),
      ],
      format: t("Chat or voice, about 30–40 minutes."),
    },
    {
      id: "monthly",
      name: t("Regular support program"),
      tag: t("Monthly subscription"),
      description: t(
        "Format for those who want to track their condition, receive small tasks and not be alone with emotions.",
      ),
      suitsFor: [
        t("Chronic stress, burnout, long-term anxiety."),
        t("You want to build habits and routines, not just survive crises."),
      ],
      format: t("Several short sessions per week + small daily steps."),
    },
    {
      id: "organizations",
      name: t("For clinics, NGOs and companies"),
      tag: t("Corporate access"),
      description: t(
        "Access to TurbotaAI for teams and organizations that want to support employees or clients.",
      ),
      suitsFor: [
        t("Medical and psychological centers."),
        t("NGOs and initiatives that work with vulnerable groups."),
        t("Companies that care about emotional state of employees."),
      ],
      format: t("Team access, admin panel and separate support line."),
    },
  ]

  const iconById: Record<string, typeof CheckCircle2> = {
    crisis: HeartPulse,
    monthly: Clock,
    organizations: Brain,
  }

  return (
    <AutoTranslate>
      <main className="w-full bg-gradient-to-b from-slate-50 to-white">
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mb-10 text-center">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {t("Flexible programs for different life situations")}
            </p>
            <h1 className="mb-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
              {t("Programs")}
            </h1>
            <p className="mx-auto max-w-2xl text-base text-slate-600 sm:text-lg">
              {t(
                "You can start with a one-time session and later switch to regular support or a program for your team.",
              )}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {programs.map((program) => {
              const Icon = iconById[program.id] || CheckCircle2
              return (
                <article
                  key={program.id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                    <Icon className="h-4 w-4 text-blue-500" />
                    <span>{program.tag}</span>
                  </div>

                  <h2 className="mb-3 text-xl font-semibold text-slate-900">
                    {program.name}
                  </h2>

                  <p className="mb-4 text-sm text-slate-600">
                    {program.description}
                  </p>

                  <div className="mt-auto space-y-2 text-sm text-slate-700">
                    <p className="font-semibold">
                      {t("Good when:")}
                    </p>
                    <ul className="list-disc space-y-1 pl-5">
                      {program.suitsFor.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>

                    <p className="mt-3 text-xs text-slate-500">
                      {t("Format")}: {program.format}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>

          <p className="mt-10 text-center text-xs text-slate-500">
            {t(
              "Payment integration will be configured together with you. Now we focus on the quality of support and the scenarios of the assistant.",
            )}
          </p>
        </section>
      </main>
    </AutoTranslate>
  )
}
