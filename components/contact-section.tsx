"use client"

// Import the necessary animation libraries at the top of the file
import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"
import type React from "react"
import { Mail, Phone, MapPin } from "lucide-react"
import ContactForm from "./contact-form"
import { useLanguage } from "@/lib/i18n/language-context"
import { AutoTranslate } from "./auto-translate"

// Update the keyframes definitions to be smoother
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

// Update the styled component with smoother animations
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
        color: rgb(30, 58, 138);
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
      title: t("Email Us"),
      details: "support@aipsychologist.com",
      description: t("For general inquiries and support"),
    },
    {
      icon: <Phone className="h-6 w-6 contact-icon" />,
      title: t("Call Us"),
      details: "+7 (800) 123-4567",
      description: t("Monday to Friday, 9am to 5pm"),
    },
    {
      icon: <MapPin className="h-6 w-6 contact-icon" />,
      title: t("Visit Us"),
      details: t("123 AI Avenue, Tech City"),
      description: t("By appointment only"),
    },
  ]

  return (
    <AnimatedContactContainer>
      <AutoTranslate>
        <section
          id="contact"
          className="py-16 px-4 md:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white"
        >
          <div className="max-w-6xl mx-auto">
            <div className="p-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{t("Contact Us")}</h2>
                <p className="text-lg text-slate-600 max-w-3xl mx-auto">
                  {t(
                    "Have questions or need assistance? Reach out to our support team and we'll get back to you as soon as possible.",
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-12">
                {contactInfo.map((item, index) => (
                  <div
                    key={index}
                    className="bg-white p-6 rounded-xl shadow-md border border-slate-200 flex flex-col items-center text-center contact-card"
                  >
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center mb-4 text-blue-600 contact-icon-container">
                      {item.icon}
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-slate-900 contact-title">{item.title}</h3>
                    <p className="text-blue-600 font-medium mb-2 contact-details">{item.details}</p>
                    <p className="text-slate-500">{item.description}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 sm:p-6 md:p-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-6 text-center">{t("Send Us a Message")}</h3>
                <ContactForm />
              </div>
            </div>
          </div>
        </section>
      </AutoTranslate>
    </AnimatedContactContainer>
  )
}
