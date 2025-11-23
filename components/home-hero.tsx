// components/home-hero.tsx
"use client"

import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { RainbowButton } from "@/components/ui/rainbow-button"
import { useLanguage } from "@/lib/i18n/language-context"

export function HomeHero() {
  const { t } = useLanguage()

  const scrollToAssistant = () => {
    if (typeof window === "undefined") return
    const el = document.getElementById("assistant")
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <section className="relative overflow-hidden bg-soft-grid">
      <div className="mx-auto flex min-h-[calc(100vh-88px)] max-w-6xl flex-col gap-10 px-4 py-10 md:flex-row md:items-center md:px-6 lg:px-8 lg:py-14">
        {/* ЛЕВАЯ ЧАСТЬ */}
        <div className="relative z-10 flex-1">
          {/* бейдж сверху */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.25)]" />
            <span>{t("AI-psychologist nearby 24/7")}</span>
          </div>

          <h1 className="mt-6 text-4xl font-semibold leading-tight text-slate-900 md:text-5xl lg:text-[52px] lg:leading-[1.05]">
            {t("Live psychological support, powered by AI")}
          </h1>

          <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate-600 md:text-base">
            {t(
              "Talk to an AI-powered psychologist when you feel exhausted, anxious or alone. They listen, ask clarifying questions and gently guide you with exercises — in chat, voice or video.",
            )}
          </p>

          {/* КНОПКИ */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {/* ГЛАВНАЯ РАДУЖНАЯ КНОПКА */}
            <RainbowButton
              type="button"
              onClick={scrollToAssistant}
              className="hero-cta shadow-[0_20px_45px_rgba(15,23,42,0.35)]"
            >
              <span>{t("Talk now")}</span>
              <ArrowRight className="h-4 w-4" />
            </RainbowButton>

            {/* ВТОРАЯ КНОПКА — БЕЗ БАГА С БЕЛЫМ ТЕКСТОМ */}
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("programs")
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
              }}
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-7 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              {t("Programs")}
            </button>
          </div>

          {/* ЧИПЫ */}
          <div className="mt-6 flex flex-wrap gap-3 text-xs md:text-sm">
            <span className="inline-flex items-center rounded-full bg-white px-4 py-2 text-slate-600 shadow-sm ring-1 ring-slate-200">
              {t("When it feels bad right now")}
            </span>
            <span className="inline-flex items-center rounded-full bg-white px-4 py-2 text-slate-600 shadow-sm ring-1 ring-slate-200">
              {t("Anxiety & stress programs")}
            </span>
            <span className="inline-flex items-center rounded-full bg-white px-4 py-2 text-slate-600 shadow-sm ring-1 ring-slate-200">
              {t("Gentle long-term support")}
            </span>
          </div>
        </div>

        {/* ПРАВАЯ ЧАСТЬ С ПСИХОЛОГОМ */}
        <div className="relative flex flex-1 items-end justify-center md:justify-end">
          <div className="relative h-[430px] w-[320px] overflow-hidden rounded-[40px] bg-gradient-to-b from-indigo-100 via-sky-100 to-purple-100 shadow-[0_32px_80px_rgba(15,23,42,0.24)] md:h-[460px] md:w-[340px]">
            {/* Сам фон с fade вверху */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0_0,rgba(255,255,255,0.9),transparent_55%),radial-gradient(circle_at_100%_0,rgba(191,219,254,0.9),transparent_55%)] opacity-70" />

            {/* ФОТО ПСИХОЛОГА */}
            <div className="relative z-10 flex h-full items-end justify-center">
              <Image
                src="/ai-psychology-hero.png"
                alt="MyITRA AI psychologist"
                width={520}
                height={640}
                priority
                className="h-[390px] w-auto object-contain md:h-[420px]"
              />
            </div>

            {/* БЕЙДЖ 3 assistant modes — ЛЕЖИТ ВНИЗУ КАРТОЧКИ */}
            <div className="pointer-events-none absolute inset-x-6 bottom-5 z-20">
              <div className="flex items-center gap-3 rounded-full bg-white/95 px-4 py-3 text-xs shadow-[0_14px_40px_rgba(15,23,42,0.35)] ring-1 ring-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-fuchsia-500 via-purple-500 to-sky-500 text-white shadow-[0_0_0_4px_rgba(129,140,248,0.35)]">
                  <span className="text-lg leading-none">💬</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-slate-800 sm:text-xs">
                    {t("3 assistant modes · chat · voice · video")}
                  </span>
                  <span className="text-[10px] text-slate-500 sm:text-[11px]">
                    {t("Choose how it’s more comfortable for you to talk.")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HomeHero
