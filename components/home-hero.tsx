"use client"

import Image from "next/image"
import { MessageSquare, PhoneCall, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RainbowButton } from "@/components/ui/rainbow-button"
import { useLanguage } from "@/lib/i18n/language-context"

export function HomeHero() {
  const { t } = useLanguage()

  const scrollToSection = (sectionId: string) => {
    const element = document.querySelector(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-16 md:py-24 lg:py-32">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />

      <div className="container relative mx-auto px-4">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm backdrop-blur-sm">
              <span className="text-slate-300">Платформа Myitra · AI + психология</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-bold leading-tight tracking-tighter text-white md:text-5xl lg:text-6xl">
                Живая психологическая поддержка,{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                  усиленная нейросетью
                </span>
              </h1>
              <p className="text-lg text-slate-300 md:text-xl">
                Лицензированные психологи с поддержкой AI-ассистентов. Помогаем собрать анамнез, вести дневник и
                напоминаем о сессиях.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <RainbowButton
                onClick={() => scrollToSection("#assistant")}
                className="h-12 px-8 text-base"
              >
                Поговорить сейчас
              </RainbowButton>
              <Button
                variant="outline"
                className="h-12 border-white/20 bg-transparent px-8 text-base text-white hover:bg-white/10"
                onClick={() => scrollToSection("#programs")}
              >
                Посмотреть программы
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <MessageSquare className="h-5 w-5 text-blue-400" />
                </div>
                <span className="text-sm text-slate-400">AI-чат 24/7</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                  <PhoneCall className="h-5 w-5 text-purple-400" />
                </div>
                <span className="text-sm text-slate-400">Голосовые созвоны</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
                  <Video className="h-5 w-5 text-cyan-400" />
                </div>
                <span className="text-sm text-slate-400">Видеосессии</span>
              </div>
            </div>
          </div>

          <div className="relative mt-8 lg:mt-0">
            <div className="relative aspect-[4/5] w-full max-w-md mx-auto overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40 shadow-2xl">
              <Image
                src="/ai-psychology-hero.png"
                alt="Психологическая сессия Myitra"
                fill
                className="object-cover"
                priority
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/0 to-slate-950/30" />

              <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/20 bg-slate-950/80 p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">3 режима ассистента</p>
                    <p className="text-xs text-slate-400">чат · голос · видео</p>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-blue-400"></div>
                    <div className="h-2 w-2 rounded-full bg-purple-400"></div>
                    <div className="h-2 w-2 rounded-full bg-cyan-400"></div>
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
