"use client"

import type React from "react"
import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"
import { Mail, Phone, MapPin } from "lucide-react"
import ContactForm from "./contact-form"
import { useLanguage } from "@/lib/i18n/language-context"
import { AutoTranslate } from "./auto-translate"

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

const AnimatedContactContainer = styled.div`
  .contact-card {
    transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);

    &:hover {
      animation: ${cardRiseKeyframes} 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;

      .contact-icon-container {
        animation: ${glowKeyframes} 2.5s infinite cubic-bezier(0.45, 0.05, 0.55, 0.95);
      }

      .contact-icon {
        animation: ${iconPulseKeyframes} 2.5s infinite cubic-bezier(0.45, 0.05, 0.55, 0.95);
      }

      .contact-title {
        color: rgb(30, 64, 175);
        transition: color 0.3s ease;
      }

      .contact-details {
        color: rgb(37, 99, 235);
        transition: color 0.3s ease;
      }
    }
  }
`

export default function ContactSection() {
  const { t } = useLanguage()

  const contactInfo = [
    {
      icon: <Mail className="h-6 w-6 contact-icon" />,
      title: t("Email us"),
      details: "support@myitra.app",
      description: t("For questions about the service, payments or technical issues."),
    },
    {
      icon: <Phone className="h-6 w-6 contact-icon" />,
      title: t("Call us"),
      details: "+380 00 000 00 00",
      description: t("On business days, 10:00–18:00 (Kyiv time)."),
    },
    {
      icon: <MapPin className="h-6 w-6 contact-icon" />,
      title: t("Office"),
      details: t("Remote-first team based in Ukraine and EU"),
      description: t("Meetings are held online by appointment."),
    },
  ]

  return (
    <AnimatedContactContainer>
      <AutoTranslate>
        <section className="bg-gradient-to-b from-slate-50 to-white px-4 py-16 md:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="p-6 sm:p-8">
              <div className="mb-12 text-center">
                <h2 className="mb-4 text-3xl font-bold text-slate-900 md:text-4xl">
                  {t("Contact MyITRA team")}
                </h2>
                <p className="mx-auto max-w-3xl text-base text-slate-600">
                  {t(
                    "Have questions about how the AI-psychologist works, want to discuss partnership or need help with your account? Leave a request — we will answer as soon as possible.",
                  )}
                </p>
              </div>

              <div className="mb-12 grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
                {contactInfo.map((item, index) => (
                  <div
                    key={index}
                    className="contact-card flex flex-col items-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-md"
                  >
                    <div className="contact-icon-container mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-600">
                      {item.icon}
                    </div>
                    <h3 className="contact-title mb-2 text-xl font-semibold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="contact-details mb-2 font-medium text-blue-600">{item.details}</p>
                    <p className="text-slate-500">{item.description}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md sm:p-6 md:p-8">
                <h3 className="mb-6 text-center text-2xl font-bold text-slate-900">
                  {t("Send us a message")}
                </h3>
                <ContactForm />
              </div>
            </div>
          </div>
        </section>
      </AutoTranslate>
    </AnimatedContactContainer>
  )
}
