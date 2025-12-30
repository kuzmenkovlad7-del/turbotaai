"use client"

import { useLanguage } from "@/lib/i18n/language-context"
import { AutoTranslate } from "@/components/auto-translate"
import {
  TestimonialsColumn,
  type Testimonial,
} from "@/components/ui/testimonials-columns-1"
import { ExpandableCard } from "@/components/ui/expandable-card"

interface StorySection {
  heading: string
  text: string
}

interface Story {
  id: string
  name: string
  badge: string
  shortQuote: string
  avatar: string
  context: string
  sections: StorySection[]
}

export default function ClientStoriesPage() {
  const { t } = useLanguage()

  // Эти 3 истории (раскрывающиеся) оставляем как были
  const stories: Story[] = [
    {
      id: "relocation-burnout",
      name: t("Anna, 27 — product designer"),
      badge: t("Night chat instead of endless scrolling"),
      shortQuote: t(
        "“After a week with TurbotaAI I finally slept through the night without panic thoughts.”",
      ),
      avatar:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80",
      context: t("Burnout after relocation & anxiety before sleep"),
      sections: [
        {
          heading: t("Before TurbotaAI"),
          text: t(
            "For several months Anna had been falling asleep at 3–4 a.m. She moved to another city, changed jobs and constantly replayed conversations in her head. She was too tired to look for a therapist, fill in forms or wait for an appointment.",
          ),
        },
        {
          heading: t("How the sessions looked"),
          text: t(
            "Anna opened the chat when it felt worst — usually late at night. The assistant helped her name what was happening, notice body sensations and try short breathing and grounding exercises. When she wanted, they switched to Ukrainian from English without losing the thread.",
          ),
        },
        {
          heading: t("What changed after 3 weeks"),
          text: t(
            "She started going to bed earlier and noticed that panic peaks became shorter. Anna still plans to work with a human therapist, but now she feels she has a safe backup option in her pocket for nights when everything “collapses” again.",
          ),
        },
      ],
    },
    {
      id: "meetings-panic",
      name: t("Max, 35 — team lead in IT"),
      badge: t("Voice calls on the way to work"),
      shortQuote: t(
        "“Talking to a calm voice for ten minutes before stand-up is easier than pretending that everything is fine.”",
      ),
      avatar:
        "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=800&q=80",
      context: t("Panic before meetings & fear of mistakes"),
      sections: [
        {
          heading: t("Before TurbotaAI"),
          text: t(
            "Max had started avoiding calls, postponing 1:1s and checking messages dozens of times. He felt that any question from colleagues meant he had already failed.",
          ),
        },
        {
          heading: t("Support format he chose"),
          text: t(
            "On difficult days Max launched a short voice session on the way to the office. Together with the assistant they unpacked what exactly he was afraid of in upcoming meetings and rehearsed several phrases that would help him stay in the adult position.",
          ),
        },
        {
          heading: t("Small but visible progress"),
          text: t(
            "After a month he noticed that he no longer cancelled calls at the last moment and could say “I need time to think about it” instead of freezing in silence. These are small steps, but they gave him back a feeling of control.",
          ),
        },
      ],
    },
    {
      id: "uni-adaptation",
      name: t("Sofia, 19 — first-year student"),
      badge: t("From “no one understands me” to small routines"),
      shortQuote: t(
        "“It’s easier to write to the AI first and only then to friends — when I understand what I really feel.”",
      ),
      avatar:
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
      context: t("Loneliness, adaptation to university & dorm life"),
      sections: [
        {
          heading: t("What was happening"),
          text: t(
            "Sofia moved from a small town to another city to study. In the dorm she felt lonely, ashamed of “weakness” and did not want to burden her parents with her worries.",
          ),
        },
        {
          heading: t("How she used TurbotaAI"),
          text: t(
            "Several times a week Sofia wrote about what had happened during the day: conflicts with roommates, fear of exams, difficulties with new people. The assistant helped her separate thoughts from facts and suggested simple experiments — for example, one small step toward someone safe in the group.",
          ),
        },
        {
          heading: t("Results after the first month"),
          text: t(
            "Sofia found two people with whom she now goes to classes, and created a small evening routine instead of doomscrolling. She still experiences anxiety, but she no longer feels completely alone with it.",
          ),
        },
      ],
    },
  ]

  // Крутящиеся плитки: делаем больше историй, чтобы не повторялись
  const rotatingTestimonials: Testimonial[] = [
    // 1–6
    {
      text: t(
        "“After a week with TurbotaAI I finally slept through the night without panic thoughts.”",
      ),
      image:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80",
      name: t("Anna, 27 — product designer"),
      role: t("Burnout after relocation & anxiety before sleep"),
    },
    {
      text: t(
        "“Talking to a calm voice for ten minutes before stand-up is easier than pretending that everything is fine.”",
      ),
      image:
        "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=800&q=80",
      name: t("Max, 35 — team lead in IT"),
      role: t("Panic before meetings & fear of mistakes"),
    },
    {
      text: t(
        "“It’s easier to write to the AI first and only then to friends — when I understand what I really feel.”",
      ),
      image:
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
      name: t("Sofia, 19 — first-year student"),
      role: t("Loneliness, adaptation to university & dorm life"),
    },
    {
      text: t(
        "“I stopped rewriting messages ten times. Now I send them — and breathe.”",
      ),
      image:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
      name: t("Dmytro, 28 — marketing specialist"),
      role: t("Social anxiety & perfectionism"),
    },
    {
      text: t(
        "“When the panic starts, I have a 3-minute grounding routine that actually works.”",
      ),
      image:
        "https://images.unsplash.com/photo-1548142813-c348350df52b?auto=format&fit=crop&w=800&q=80",
      name: t("Iryna, 32 — entrepreneur"),
      role: t("Panic episodes & body sensations"),
    },
    {
      text: t(
        "“I learned to name the feeling first — and only then decide what to do.”",
      ),
      image:
        "https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?auto=format&fit=crop&w=800&q=80",
      name: t("Kateryna, 29 — teacher"),
      role: t("Overwhelm & emotional regulation"),
    },

    // 7–12
    {
      text: t(
        "“A short evening check-in helped me stop scrolling and go to sleep earlier.”",
      ),
      image:
        "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=800&q=80",
      name: t("Andrii, 41 — operations manager"),
      role: t("Stress, insomnia & constant tension"),
    },
    {
      text: t(
        "“I didn’t need a perfect plan. I needed one small next step — and I got it.”",
      ),
      image:
        "https://images.unsplash.com/photo-1546961329-78bef0414d7c?auto=format&fit=crop&w=800&q=80",
      name: t("Oksana, 24 — junior designer"),
      role: t("Self-doubt & job search"),
    },
    {
      text: t(
        "“Instead of catastrophizing, I wrote down facts. The fear got smaller.”",
      ),
      image:
        "https://images.unsplash.com/photo-1525134479668-1bee5c7c6845?auto=format&fit=crop&w=800&q=80",
      name: t("Artem, 22 — student"),
      role: t("Overthinking & exam anxiety"),
    },
    {
      text: t(
        "“I can finally say ‘I need time to think’ without freezing.”",
      ),
      image:
        "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=800&q=80",
      name: t("Yulia, 30 — QA engineer"),
      role: t("Fear of mistakes & pressure at work"),
    },
    {
      text: t(
        "“Before talking to family, I talk here — and it becomes easier.”",
      ),
      image:
        "https://images.unsplash.com/photo-1541519481457-763224276691?auto=format&fit=crop&w=800&q=80",
      name: t("Natalia, 37 — HR"),
      role: t("Relationship stress & boundaries"),
    },
    {
      text: t(
        "“I stopped avoiding tough conversations. I started preparing calmly.”",
      ),
      image:
        "https://images.unsplash.com/photo-1545996124-0501ebae84d0?auto=format&fit=crop&w=800&q=80",
      name: t("Bohdan, 26 — founder"),
      role: t("Decision fatigue & burnout risk"),
    },

    // 13–18
    {
      text: t(
        "“The breathing + grounding combo saved me on days when everything felt ‘too much’.”",
      ),
      image:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80",
      name: t("Viktoriia, 31 — project manager"),
      role: t("Anxiety spikes & overload"),
    },
    {
      text: t(
        "“I don’t chase motivation anymore. I follow a simple routine — and it helps.”",
      ),
      image:
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
      name: t("Svitlana, 33 — analyst"),
      role: t("Low energy & procrastination"),
    },
    {
      text: t(
        "“I stopped blaming myself for stress. I started supporting myself.”",
      ),
      image:
        "https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?auto=format&fit=crop&w=800&q=80",
      name: t("Olena, 27 — customer support"),
      role: t("Burnout & self-criticism"),
    },
    {
      text: t(
        "“Ten minutes of voice support before bed — and my sleep got deeper.”",
      ),
      image:
        "https://images.unsplash.com/photo-1548142813-c348350df52b?auto=format&fit=crop&w=800&q=80",
      name: t("Roman, 39 — engineer"),
      role: t("Sleep issues & rumination"),
    },
    {
      text: t(
        "“I learned to separate thoughts from facts. That alone changed a lot.”",
      ),
      image:
        "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=800&q=80",
      name: t("Ihor, 34 — product lead"),
      role: t("Work stress & perfectionism"),
    },
    {
      text: t(
        "“The hardest part was starting. The assistant made it feel safe.”",
      ),
      image:
        "https://images.unsplash.com/photo-1541519481457-763224276691?auto=format&fit=crop&w=800&q=80",
      name: t("Marta, 25 — trainee"),
      role: t("First steps in therapy & anxiety"),
    },
  ]

  const firstColumn = rotatingTestimonials.slice(0, 6)
  const secondColumn = rotatingTestimonials.slice(6, 12)
  const thirdColumn = rotatingTestimonials.slice(12, 18)

  return (
    <AutoTranslate>
      <main className="min-h-[calc(100vh-96px)] bg-gradient-to-b from-white via-slate-50 to-white">
        <section className="px-4 py-16 md:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-6xl">
            {/* Hero */}
            <header className="mb-12 text-center md:mb-14">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                {t("Real experiences from beta users")}
              </div>
              <h1 className="mb-3 text-3xl font-bold text-slate-900 sm:text-4xl md:text-5xl">
                {t("Client stories")}
              </h1>
              <p className="mx-auto max-w-3xl text-sm text-slate-600 sm:text-base">
                {t(
                  "These stories show how people use TurbotaAI in different life situations — from night anxiety and burnout to adaptation after moving. Names and details are changed for privacy.",
                )}
              </p>
            </header>

            {/* Автопрокрутка коротких отзывов */}
            <div className="mx-auto max-w-5xl">
              <div className="flex justify-center gap-4 md:gap-6 [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)] max-h-[580px] overflow-hidden">
                <TestimonialsColumn testimonials={firstColumn} duration={22} />
                <TestimonialsColumn
                  testimonials={secondColumn}
                  duration={26}
                  className="hidden md:block"
                />
                <TestimonialsColumn
                  testimonials={thirdColumn}
                  duration={24}
                  className="hidden lg:block"
                />
              </div>
            </div>

            {/* Полные истории в раскрывающихся карточках */}
            <section className="mt-16 border-t border-slate-200 pt-12">
              <div className="mb-6 text-center md:mb-8">
                <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
                  {t("Read full stories")}
                </h2>
                <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
                  {t(
                    "Tap a card to open a detailed story in a calm, full-screen view. You can close it at any time with the button or the Escape key.",
                  )}
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {stories.map((story) => (
                  <ExpandableCard
                    key={story.id}
                    title={story.name}
                    src={story.avatar}
                    description={story.badge}
                    className="bg-white hover:bg-slate-50 border border-slate-200 shadow-sm"
                    classNameExpanded="bg-white sm:rounded-3xl [&_p]:text-slate-600 [&_h4]:text-slate-900 [&_h4]:text-base [&_h4]:font-semibold"
                  >
                    <div className="space-y-4">
                      {story.sections.map((section) => (
                        <div key={section.heading} className="space-y-1">
                          <h4>{section.heading}</h4>
                          <p>{section.text}</p>
                        </div>
                      ))}
                      <p className="mt-4 text-xs text-slate-400">
                        {t(
                          "Stories are based on real patterns from TurbotaAI testing, but names and details are changed. TurbotaAI does not replace emergency mental health care.",
                        )}
                      </p>
                    </div>
                  </ExpandableCard>
                ))}
              </div>
            </section>
          </div>
        </section>
      </main>
    </AutoTranslate>
  )
}
