"use client"

import Image from "next/image"
import Link from "next/link"
import { HandHeart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n/language-context"

export function HomeHero() {
  const { t } = useLanguage()

  const scrollToSection = (sectionId: string) => {
    if (typeof document === "undefined") return
    const element = document.querySelector(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-br from-white via-accent/5 to-accent/10">
      <div className="container relative mx-auto px-4 py-12 md:py-16 lg:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Левая колонка */}
          <div className="space-y-6">
            {/* Маленький бейдж про 24/7 */}
            <div className="inline-flex items-center rounded-full bg-[hsl(var(--brand-indigo)/0.06)] px-3 py-1 text-xs font-medium text-[hsl(var(--brand-indigo))] shadow-sm ring-1 ring-[hsl(var(--brand-indigo)/0.15)]">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[hsl(var(--brand-violet))] animate-pulse" />
              {t("AI-psychologist nearby 24/7")}
            </div>

            <h1 className="text-4xl font-bold leading-tight text-foreground md:text-5xl lg:text-6xl">
              {t("Live psychological support,")}
              <br className="hidden sm:block" /> {t("powered by AI")}
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              {t(
                "Talk to an AI-powered psychologist when you feel exhausted, anxious or alone. They listen, ask clarifying questions and gently guide you with exercises — in chat, voice or video.",
              )}
            </p>

            {/* Три сценария, как в ТЗ */}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-white/80 px-3 py-1 shadow-sm ring-1 ring-slate-200">
                {t("When it feels bad right now")}
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 shadow-sm ring-1 ring-slate-200">
                {t("Anxiety & stress programs")}
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 shadow-sm ring-1 ring-slate-200">
                {t("Gentle long-term support")}
              </span>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button
                onClick={() => scrollToSection("#assistant")}
                size="lg"
                className="rounded-full bg-slate-900 px-8 text-white shadow-lg hover:bg-slate-800 animate-pulse-glow-violet"
              >
                {t("Talk Now")}
              </Button>

              <Link href="/programs">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full border-gray-300 px-8 text-slate-900 hover:border-accent hover:bg-accent/10"
                >
                  {t("Programs")}
                </Button>
              </Link>
            </div>
          </div>

          {/* Правая колонка — карточка с персонажем */}
          <div className="relative mt-8 lg:mt-0">
            <div className="relative mx-auto flex aspect-[4/5] w-full max-w-md items-center justify-center overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-white to-accent/10 shadow-xl">
              <Image
                src="/ai-psychology-hero.png"
                alt={t("Calm psychologist talking to a client")}
                fill
                className="object-cover"
                priority
              />

              {/* Нижняя пилюля — теперь кнопка */}
              <button
                type="button"
                onClick={() => scrollToSection("#assistant")}
                className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-full border border-accent/20 bg-white/95 px-4 py-3 text-left shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg"
              >
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--brand-indigo))] to-[hsl(var(--brand-violet))]">
                  <HandHeart className="z-10 h-5 w-5 text-white" />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[hsl(var(--brand-indigo))] to-[hsl(var(--brand-violet))] animate-pulse-circle" />
                </div>

                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {t("3 assistant modes")} · {t("chat · voice · video")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("Choose how it’s more comfortable for you to talk.")}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
