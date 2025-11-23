"use client"

import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n/language-context"

export function HomeHero() {
  const { t } = useLanguage()

  const scrollToAssistant = () => {
    if (typeof document === "undefined") return
    const element = document.querySelector("#assistant")
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const chips = [
    t("When it feels bad right now"),
    t("Anxiety & stress programs"),
    t("Gentle long-term support"),
  ]

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-50">
      {/* Мягкий свет справа, без жёсткой рамки */}
      <div className="pointer-events-none absolute inset-y-[-140px] right-[-160px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(15,23,42,0.12),_transparent_70%)]" />

      <div className="container mx-auto px-4 md:px-6 lg:px-10 py-10 md:py-14 lg:py-16">
        <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* ЛЕВАЯ ЧАСТЬ */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>{t("AI-psychologist nearby 24/7")}</span>
            </div>

            <h1 className="mt-6 text-3xl sm:text-4xl md:text-5xl lg:text-[3.1rem] font-bold tracking-tight text-slate-900">
              {t("Live psychological support,")}
              <br />
              {t("powered by AI")}
            </h1>

            <p className="mt-4 max-w-xl text-sm sm:text-base md:text-lg leading-relaxed text-slate-600">
              {t(
                "Talk to an AI-powered psychologist when you feel exhausted, anxious or alone. They listen, ask clarifying questions and gently guide you with exercises — in chat, voice or video.",
              )}
            </p>

            {/* Кнопки: на мобиле на всю ширину */}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Button
                size="lg"
                onClick={scrollToAssistant}
                className="w-full sm:w-auto rounded-full bg-slate-900 px-8 text-base font-semibold text-white shadow-[0_18px_45px_rgba(15,23,42,0.25)] hover:bg-slate-800 hover:shadow-[0_14px_30px_rgba(15,23,42,0.25)] transition-shadow"
              >
                {t("Talk Now")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full sm:w-auto rounded-full border-slate-200 bg-white/80 px-8 text-base font-semibold text-slate-900 hover:bg-slate-100"
              >
                <a href="/programs">{t("Programs")}</a>
              </Button>
            </div>

            {/* Чипы-подсказки */}
            <div className="mt-5 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <div
                  key={chip}
                  className="rounded-full border border-slate-200 bg-white/70 px-3.5 py-1 text-xs sm:text-sm text-slate-600 shadow-sm"
                >
                  {chip}
                </div>
              ))}
            </div>
          </div>

          {/* ПРАВАЯ ЧАСТЬ – только девушка + плавающий бейдж */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative h-[320px] w-[230px] sm:h-[360px] sm:w-[260px] lg:h-[420px] lg:w-[300px]">
              <Image
                src="/images/psychologist.png"
                alt={t("Calm female psychologist looking at the camera")}
                fill
                priority
                sizes="(min-width:1024px) 300px, (min-width:640px) 40vw, 60vw"
                className="object-contain drop-shadow-[0_26px_60px_rgba(15,23,42,0.35)]"
              />
            </div>

            {/* Плашка про 3 режима ассистента */}
            <div className="absolute -bottom-2 sm:bottom-2 left-1/2 flex w-[min(100%,320px)] -translate-x-1/2 items-center gap-3 rounded-full border border-slate-100 bg-white/95 px-4 py-3 shadow-[0_20px_40px_rgba(15,23,42,0.16)] backdrop-blur-md">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#6366F1] to-[#EC4899]">
                <span className="text-lg leading-none text-white">✺</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-medium text-slate-900">
                  {t("3 assistant modes · chat · voice · video")}
                </span>
                <span className="text-[11px] sm:text-xs text-slate-500">
                  {t("Choose how it's more comfortable for you to talk.")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
