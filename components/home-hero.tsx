"use client"

import Image from "next/image"
import { MessageSquare, PhoneCall, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
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
    <section className="relative w-full overflow-hidden bg-gradient-to-br from-white via-slate-50 to-slate-100 py-16 md:py-24 lg:py-32">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-30" />

      <div className="container relative mx-auto px-4">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 text-sm backdrop-blur-sm shadow-sm">
              <span className="text-slate-600 font-medium">{t("Myitra Platform · AI + Psychology")}</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-bold leading-tight tracking-tighter text-slate-900 md:text-5xl lg:text-6xl">
                {t("Live Psychological Support,")}{" "}
                <span className="text-accent">
                  {t("AI-Enhanced")}
                </span>
              </h1>
              <p className="text-lg text-slate-600 md:text-xl">
                {t("Licensed psychologists supported by AI assistants. We help gather history, maintain journals, and remind about sessions.")}
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Button
                onClick={() => scrollToSection("#assistant")}
                className="h-12 px-8 text-base bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-xl animate-pulse-soft hover:shadow-2xl transition-shadow"
              >
                {t("Talk Now")}
              </Button>
              <Button
                variant="outline"
                className="h-12 border-primary bg-white px-8 text-base text-primary hover:bg-primary/5 shadow-sm"
                onClick={() => scrollToSection("#assistant")}
              >
                {t("View Services")}
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 border border-blue-100">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-sm text-slate-600 font-medium">{t("AI Chat 24/7")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 border border-cyan-100">
                  <PhoneCall className="h-5 w-5 text-cyan-600" />
                </div>
                <span className="text-sm text-slate-600 font-medium">{t("Voice Calls")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lavender-50 border border-lavender-100">
                  <Video className="h-5 w-5 text-lavender-600" />
                </div>
                <span className="text-sm text-slate-600 font-medium">{t("Video Sessions")}</span>
              </div>
            </div>
          </div>

          <div className="relative mt-8 lg:mt-0">
            <div className="relative aspect-[4/5] w-full max-w-md mx-auto overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <Image
                src="/ai-psychology-hero.png"
                alt={t("Myitra Psychology Session")}
                fill
                className="object-cover"
                priority
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/60 via-transparent to-white/20" />

              <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-slate-200 bg-white/90 p-4 backdrop-blur-xl shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t("3 Assistant Modes")}</p>
                    <p className="text-xs text-slate-600">{t("chat · voice · video")}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    <div className="h-2 w-2 rounded-full bg-cyan-500"></div>
                    <div className="h-2 w-2 rounded-full bg-lavender-500"></div>
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
