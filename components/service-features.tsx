"use client"

import type React from "react"
import { Clock, CreditCard, UserCircle, Globe, BarChart, Shield } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"

const iconPulseKeyframes = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
`

const cardRiseKeyframes = keyframes`
  0% { transform: translateY(0); box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
  100% { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.1); }
`

const glowKeyframes = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
  50% { box-shadow: 0 0 12px 3px rgba(59, 130, 246, 0.15); }
  100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
`

const AnimatedFeatureContainer = styled.div`
  .feature-card {
    transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);

    &:hover {
      animation: ${cardRiseKeyframes} 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;

      .feature-icon-container {
        animation: ${glowKeyframes} 2.5s infinite cubic-bezier(0.45, 0.05, 0.55, 0.95);
      }

      .feature-icon {
        animation: ${iconPulseKeyframes} 2.5s infinite cubic-bezier(0.45, 0.05, 0.55, 0.95);
      }

      .feature-title {
        color: rgb(30, 64, 175);
        transition: color 0.3s ease;
      }

      .feature-description {
        color: rgb(51, 65, 85);
        transition: color 0.3s ease;
      }
    }
  }
`

export default function ServiceFeatures() {
  const { t } = useLanguage()

  const features = [
    {
      icon: <Clock className="h-6 w-6 feature-icon" />,
      title: t("Support in minutes, not weeks"),
      description: t(
        "Open chat, voice or video exactly when it feels bad — without waiting lists, schedules or registration forms.",
      ),
    },
    {
      icon: <UserCircle className="h-6 w-6 feature-icon" />,
      title: t("Feels like a calm human conversation"),
      description: t(
        "The assistant listens, asks gentle clarifying questions and offers exercises instead of generic advice.",
      ),
    },
    {
      icon: <Globe className="h-6 w-6 feature-icon" />,
      title: t("Ukrainian, Russian and English"),
      description: t(
        "MyITRA automatically adapts to your language and can switch during the conversation if you change it.",
      ),
    },
    {
      icon: <BarChart className="h-6 w-6 feature-icon" />,
      title: t("Helps notice your progress"),
      description: t(
        "Session history and mood dynamics help you see small steps forward, even when it feels like nothing changes.",
      ),
    },
    {
      icon: <Shield className="h-6 w-6 feature-icon" />,
      title: t("Safe and confidential space"),
      description: t(
        "Your conversations are encrypted and not used for advertising. You decide what to share and when to delete it.",
      ),
    },
    {
      icon: <CreditCard className="h-6 w-6 feature-icon" />,
      title: t("Transparent pricing without subscriptions"),
      description: t(
        "First minutes are free; after that you only pay for the time you actually use. No hidden fees or long-term contracts.",
      ),
    },
  ]

  return (
    <AnimatedFeatureContainer>
      <section className="bg-gradient-to-b from-slate-50 to-white px-4 py-12 sm:py-16 md:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="p-6 sm:p-8">
            <h2 className="mb-3 text-center text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl">
              {t("Why people choose MyITRA")}
            </h2>
            <p className="mx-auto mb-8 max-w-3xl px-4 text-center text-sm text-slate-600 sm:mb-12 sm:text-base">
              {t(
                "MyITRA is built for moments when you have no strength to search for a therapist or wait for an appointment, but really need someone to talk to right now.",
              )}
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="feature-card touch-manipulation rounded-xl border border-slate-200 bg-white p-5 shadow-md sm:p-6"
                >
                  <div className="feature-icon-container mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-600">
                    {feature.icon}
                  </div>
                  <h3 className="feature-title mb-2 text-lg font-semibold text-slate-900 sm:text-xl">
                    {feature.title}
                  </h3>
                  <p className="feature-description text-sm leading-relaxed text-slate-600 sm:text-base">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </AnimatedFeatureContainer>
  )
}
