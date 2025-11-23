"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Check, Star, Sparkles } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Program {
  id: string
  name: string
  price: string
  period: string
  features: string[]
  description: string
  popular?: boolean
}

export default function ProgramsPage() {
  const { t } = useLanguage()

  const programs: Program[] = [
    {
      id: "single",
      name: t("Single Session"),
      price: t("Program Price - Single"),
      period: t("per session"),
      features: [
        t("One-time consultation"),
        t("All communication modes"),
        t("Session recording"),
      ],
      description: t(
        "For those who want to try the assistant or need support in a specific situation.",
      ),
    },
    {
      id: "monthly",
      name: t("Monthly Subscription"),
      price: t("Program Price - Monthly"),
      period: t("per month"),
      features: [
        t("Unlimited sessions"),
        t("Priority support"),
        t("Progress tracking"),
        t("Personalized recommendations"),
      ],
      description: t(
        "Optimal format for regular support, tracking your state and working with long-term goals.",
      ),
      popular: true,
    },
    {
      id: "corporate",
      name: t("Corporate Program"),
      price: t("Program Price - Corporate"),
      period: t("per team"),
      features: [
        t("Team access"),
        t("Admin dashboard"),
        t("Custom integrations"),
        t("Dedicated support"),
      ],
      description: t(
        "For clinics, NGOs and companies that want to provide emotional support for employees or clients.",
      ),
    },
  ]

  const cardVariants = {
    initial: { opacity: 0, y: 40 },
    animate: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.7,
        delay: 0.12 * index,
        ease: [0.16, 1, 0.3, 1],
      },
    }),
  }

  return (
    <main className="w-full bg-gradient-to-b from-slate-50 to-white">
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            <Sparkles className="h-4 w-4 text-blue-500" />
            <span>{t("Flexible programs for different life situations")}</span>
          </div>

          <h1 className="mb-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            {t("Our Programs")}
          </h1>
          <p className="mx-auto max-w-2xl text-base text-slate-600 sm:text-lg">
            {t(
              "Choose the format that fits you best. You can start with a single session and later switch to a monthly plan.",
            )}
          </p>
        </div>

        {/* Cards */}
        <div className="grid gap-8 md:grid-cols-3">
          {programs.map((program, index) => (
            <motion.article
              key={program.id}
              custom={index}
              variants={cardVariants}
              initial="initial"
              animate="animate"
              whileHover={{
                y: -8,
                boxShadow:
                  "0 20px 40px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(148, 163, 184, 0.2)",
              }}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-white p-8 shadow-sm transition-all",
                program.popular
                  ? "border-blue-600 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/15"
                  : "border-slate-200",
              )}
            >
              {program.popular && (
                <div className="absolute -top-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-md">
                  <Star className="h-3 w-3 fill-current" />
                  <span>{t("Popular")}</span>
                </div>
              )}

              <h2 className="mb-2 text-xl font-semibold text-slate-900">
                {program.name}
              </h2>
              <p className="mb-4 text-sm text-slate-500">{program.period}</p>

              <p className="mb-6 text-3xl font-bold text-slate-900">
                {program.price}
              </p>

              <ul className="mb-8 flex flex-1 flex-col gap-3 text-sm text-slate-700">
                {program.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="/register" className="mt-auto block">
                <Button
                  className={cn(
                    "w-full rounded-full py-5 text-sm font-semibold",
                    program.popular
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50",
                  )}
                >
                  {t("Choose Program")}
                </Button>
              </Link>

              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                {program.description}
              </p>
            </motion.article>
          ))}
        </div>

        {/* Примечание под тарифами (можно потом заменить на реальный текст про оплату) */}
        <div className="mt-10 text-center text-xs text-slate-500">
          {t(
            "You will be able to change or cancel your plan later in your account. Payment integration will be finalized together with you.",
          )}
        </div>
      </section>
    </main>
  )
}
