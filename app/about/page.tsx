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
                "TurbotaAI — a digital companion for moments when it matters to feel support",
              )}
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-slate-600 md:text-base">
              {t(
                "TurbotaAI is an AI companion built on modern technology and approaches to emotional support. It does not replace professional help, but creates a calm space where you can talk, calm down and take the next step — in chat, voice or video.",
              )}
            </p>
          </div>
        </section>

        {/* 3 columns */}
        <section className="border-b border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 lg:px-8">
            <div className="grid gap-8 md:grid-cols-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {t("Who TurbotaAI is for")}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {t(
                    "TurbotaAI is created for people who need support in everyday life — without complicated forms and long waiting.",
                  )}
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                  <li>
                    {t(
                      "• Anyone who feels stress, anxiety, burnout or loneliness.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• People who want a safe space to talk about what is happening.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• Those who are alone or feel isolated and want to be heard.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• Anyone who needs support right now — without waiting for an appointment.",
                    )}
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {t("How the companion works")}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {t(
                    "The companion listens first, asks gentle questions and only then suggests small steps — without pressure and at your pace.",
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
                      "• Gentle questions instead of a list of tips — the companion tries to understand you.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• Breathing, grounding, short exercises and small daily steps.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• Responses adapt to your state during the conversation.",
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
                    "It is important to be honest about the limits of the service.",
                  )}
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                  <li>
                    {t(
                      "• TurbotaAI is a support tool, not medical or psychiatric care.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• It does not make diagnoses and does not replace emergency help.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• In crisis or risk of harm, contact local emergency services or a specialist.",
                    )}
                  </li>
                  <li>
                    {t(
                      "• The companion can complement personal support, but is not a substitute for it.",
                    )}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Sessions and payment */}
        <section className="bg-white">
          <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 lg:px-8">
            <div className="grid items-start gap-8 md:grid-cols-[1.4fr,1fr]">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {t("Access and subscription")}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {t(
                    "You can start for free with several trial questions to feel how the companion works.",
                  )}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {t(
                    "After the trial you can continue with a monthly subscription for unlimited access to chat, voice and video.",
                  )}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {t(
                    "All payments are processed through a certified payment provider. Cancellation is available at any time — access stays active until the end of the paid period.",
                  )}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {t(
                    "If something goes wrong with a payment, contact us at support@turbotaai.com and we will help.",
                  )}
                </p>
              </div>

              <div className="rounded-3xl bg-slate-900 px-6 py-6 text-slate-50 shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
                  {t("Privacy and safety")}
                </p>
                <p className="mt-3 text-sm text-slate-100">
                  {t(
                    "Your conversations stay between you and TurbotaAI. They are not used for advertising and you decide what to keep.",
                  )}
                </p>
                <p className="mt-3 text-xs text-slate-300">
                  {t(
                    "TurbotaAI is designed for support but does not replace professional help. In emergency situations, contact local emergency services.",
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
