// components/home-hero.tsx
"use client"

import type React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { RainbowButton } from "@/components/ui/rainbow-button"
import { useLanguage } from "@/lib/i18n/language-context"

export function HomeHero() {
  const { t } = useLanguage()

  const chips = [
    t("For calm conversations"),
    t("For inner balance"),
    t("For moments when support matters"),
  ]

  return (
    <section
      className="
        relative overflow-hidden
        bg-gradient-to-r from-slate-50 via-slate-50 to-indigo-50/35
      "
    >
      {/* мягкий фон справа */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-full max-w-xl bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.6),transparent_60%)]" />

      <div
        className="
          relative mx-auto flex max-w-6xl flex-col items-start
          px-4 pt-10 pb-16
          md:px-6 lg:px-8
          md:grid md:grid-cols-2 md:items-center
          lg:pt-16 lg:pb-20
          min-h-[calc(100vh-88px)]
        "
      >
        {/* Левая колонка: текст + кнопки */}
        <div className="relative z-10 max-w-xl">
          {/* бейджик статуса */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.35)]" />
            {t("AI companion nearby 24/7")}
          </div>

          <h1 className="mb-5 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl md:text-5xl">
            {t("AI companion that is always nearby")}
          </h1>

          <p className="mb-7 max-w-lg text-sm text-slate-600 sm:text-base">
            {t("A calm and safe space for conversation. Talk, calm down and feel support from AI designed for emotional care.")}
          </p>

          {/* Кнопки */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <a href="#assistant">
              <RainbowButton className="h-12 rounded-full px-7 text-sm font-semibold text-white">
                <span>{t("Talk to AI")}</span>
                <ArrowRight className="h-4 w-4" />
              </RainbowButton>
            </a>
          </div>

          {/* чипы под кнопками */}
          <div className="flex flex-wrap gap-3">
            {chips.map((chip) => (
              <span
                key={chip}
                className="
                  inline-flex items-center rounded-full
                  border border-slate-200 bg-white px-4 py-1
                  text-xs text-slate-600 shadow-sm
                "
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        {/* Правая колонка: психолог + бейдж ассистентов */}
        <div className="relative mt-10 flex justify-center md:mt-0">
          {/* большая мягкая "аура" */}
          <div className="pointer-events-none absolute inset-0 translate-x-4 bg-[radial-gradient(circle_at_top,_rgba(165,180,252,0.75),transparent_65%)]" />

          {/* фотография психолога без рамки */}
          <div className="relative z-10 flex items-end">
            <Image
              src="/ai-psychology-hero.png"
              alt={t("TurbotaAI — AI companion")}
              width={520}
              height={720}
              priority
              className="h-auto w-full max-w-sm md:max-w-md object-contain drop-shadow-2xl"
            />
          </div>

          {/* карточка 3 assistant modes */}
          <div
            className="
              absolute bottom-6 right-2 z-20
              w-full max-w-xs
              rounded-3xl bg-white/95 px-5 py-3
              shadow-[0_18px_45px_rgba(15,23,42,0.25)]
              ring-1 ring-slate-200/70
              backdrop-blur-md
            "
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-white shadow-lg">
                💬
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-900">
                  {t("Your AI companion in any format — text, voice or video")}
                </p>
                <p className="text-[11px] text-slate-500">
                  {t("Just start")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HomeHero
