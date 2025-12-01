// app/about/page.tsx
"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { AutoTranslate } from "@/components/auto-translate"

export default function AboutPage() {
  const { t } = useLanguage()

  return (
    <AutoTranslate>
      <div className="bg-slate-50">
        {/* Hero */}
        <section className="border-b border-slate-100 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-400">
              {t("About the product")}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              {t(
                "TurbotaAI — AI-psychologist that stays nearby when it feels hard",
              )}
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-slate-600 md:text-base">
              {t(
                "TurbotaAI is a digital assistant built on psychological literature and modern AI. It does not replace a live therapist, but gives gentle, structured support when it is difficult to reach someone or when you need to talk right now — in chat, voice or video.",
              )}
            </p>
          </div>
        </section>

        {/* 3 колонки: кому, как работает, чем не является */}
        <section className="border-b border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 lg:px-8">
            <div className="grid gap-8 md:grid-cols-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {t("Who TurbotaAI is for")}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {t(
                    "On the first versions we focus on people who need emotional support in everyday life — without stigma and without long waiting.",
                  )}
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                  <li>
                    {t(
                      "• Women who feel stress, anxiety, burnout or loneliness.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• Teenagers 12–18 who need a safe space to talk about emotions and self-esteem.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• People who are alone or feel isolated and want to be heard.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• Later — veterans and their families as a separate module.",
                    )}
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {t("How the assistant works")}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {t(
                    "The assistant listens first, asks clarifying questions and only then offers recommendations — step by step, without pressure.",
                  )}
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                  <li>
                    {t(
                      "• Chat, voice or video — you choose the format.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• Clarifying questions instead of 20 tips at once — the assistant tries to understand your state.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• Breathing, grounding, short exercises, diary of emotions, small daily steps.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• Short programs for 7–21 days to gently change habits and support you regularly.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• Answers are based on selected psychological books and materials that were tested with a psychologist.",
                    )}
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {t("What TurbotaAI is not")}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {t(
                    "It is important to be honest about the limits of technology.",
                  )}
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                  <li>
                    {t(
                      "• TurbotaAI is not a doctor and not a psychiatrist.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• It does not make diagnoses and does not replace emergency help.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• In crisis or risk of harm to yourself or others, you should contact emergency services or a human specialist.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• The assistant is a supportive tool that can live alongside individual or group therapy.",
                    )}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Как работают сессии и оплата */}
        <section className="bg-white">
          <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 lg:px-8">
            <div className="grid items-start gap-8 md:grid-cols-[1.4fr,1fr]">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {t("Sessions, test period and subscription")}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {t(
                    "On the first launch we plan to test the service with a free period, so that users can safely try the assistant and we can see how people really use TurbotaAI.",
                  )}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {t(
                    "After testing you can keep a small free part (for example, a few questions) and then switch to a simple paid model: a monthly subscription for regular support and a one-time access option for those who want to try a single extended session.",
                  )}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {t(
                    "All payments will be processed through a certified payment provider, and refunds will be handled manually through support e-mail if something goes wrong.",
                  )}
                </p>
              </div>

              <div className="rounded-3xl bg-slate-900 px-6 py-6 text-slate-50 shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
                  {t("On launch in Ukraine")}
                </p>
                <p className="mt-3 text-sm text-slate-100">
                  {t(
                    "The first versions of TurbotaAI will be tested on the Ukrainian market with support for several languages. This will allow us to refine the quality of answers, tone of communication and scenarios before scaling to other countries.",
                  )}
                </p>
                <p className="mt-3 text-xs text-slate-300">
                  {t(
                    "The goal is a safe, respectful assistant that you can open at any moment when you need to talk — without stigma and overcomplicated interfaces.",
                  )}
                </p>

                <Link
                  href="/"
                  className="mt-5 inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
                >
                  {t("Back to main page")}
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AutoTranslate>
  )
}
