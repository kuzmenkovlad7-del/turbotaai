"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n/language-context"

export function HomeHero() {
  const { t } = useLanguage()

  const scrollToAssistant = () => {
    if (typeof window === "undefined") return
    const element = document.querySelector("#assistant")
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-gradient-to-br from-white via-slate-50 to-slate-100"
    >
      {/* лёгкое свечение справа, чтобы был плавный переход вниз */}
      <div className="pointer-events-none absolute -right-40 top-10 hidden h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.35),transparent_60%)] blur-3xl lg:block" />

      <div className="container mx-auto px-4 md:px-6 lg:px-10 pt-16 pb-20 lg:pt-20 lg:pb-28">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          {/* Левая колонка: текст */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>{t("AI-psychologist nearby 24/7")}</span>
            </div>

            <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
              Live psychological
              <br />
              support, powered by AI
            </h1>

            <p className="mt-4 max-w-xl text-base text-slate-600 sm:text-lg">
              Talk to an AI-powered psychologist when you feel exhausted,
              anxious or alone. They listen, ask clarifying questions and gently
              guide you with exercises — in chat, voice or video.
            </p>

            {/* Кнопки: на мобиле обе на всю ширину, основная пульсирует */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                size="lg"
                onClick={scrollToAssistant}
                className="w-full sm:w-auto rounded-full bg-slate-900 px-8 py-6 text-base font-semibold text-white shadow-[0_18px_45px_rgba(15,23,42,0.35)] transition-all hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-[0_22px_60px_rgba(15,23,42,0.45)] animate-pulse"
              >
                {t("Talk Now")}
              </Button>

              <Link href="/programs" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full rounded-full border-slate-300 bg-white/80 px-8 py-6 text-base font-semibold text-slate-900 hover:bg-slate-100"
                >
                  Programs
                </Button>
              </Link>
            </div>

            {/* Чипы-состояния как на макете */}
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="inline-flex items-center rounded-full bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm">
                When it feels bad right now
              </span>
              <span className="inline-flex items-center rounded-full bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm">
                Anxiety & stress programs
              </span>
              <span className="inline-flex items-center rounded-full bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm">
                Gentle long-term support
              </span>
            </div>
          </div>

          {/* Правая колонка: фото психолога без рамки */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative">
              {/* мягкий ореол за фигурой */}
              <div className="pointer-events-none absolute inset-[-18%] rounded-[999px] bg-[radial-gradient(circle_at_top,_rgba(148,163,253,0.45),transparent_65%)] blur-2xl" />

              <div className="relative h-[320px] w-[230px] sm:h-[360px] sm:w-[260px] md:h-[420px] md:w-[310px] lg:h-[460px] lg:w-[340px] xl:h-[500px] xl:w-[380px]">
                <Image
                  // ЕСЛИ у тебя картинка лежит в другом месте,
                  // просто поменяй путь здесь.
                  src="/psychologist.png"
                  alt={t("MyITRA AI psychologist")}
                  fill
                  priority
                  sizes="(min-width: 1024px) 380px, 60vw"
                  className="object-contain"
                />
              </div>

              {/* Бейдж с 3 режимами ассистента */}
              <div className="absolute -bottom-7 left-1/2 w-[260px] -translate-x-1/2 rounded-3xl bg-white/95 px-4 py-3 shadow-xl shadow-slate-300/60 backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 text-white shadow-md">
                    💬
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-900">
                      3 assistant modes · chat · voice · video
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Choose how it&apos;s more comfortable for you to talk.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
