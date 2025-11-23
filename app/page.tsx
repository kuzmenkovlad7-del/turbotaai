"use client"

import { useState } from "react"
import { PhoneCall, MessageSquare, Video } from "lucide-react"

import { HomeHero } from "@/components/home-hero"
import ServiceFeatures from "@/components/service-features"
import ContactSection from "@/components/contact-section"
import { ContactMethodCard } from "@/components/contact-method-card"
import AIChatDialog from "@/components/ai-chat-dialog"
import VoiceCallDialog from "@/components/voice-call-dialog"
import VideoCallDialog from "@/components/video-call-dialog"
import { useLanguage } from "@/lib/i18n/language-context"

export default function Home() {
  const { t } = useLanguage()

  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false)
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false)

  return (
    <div className="bg-slate-50">
      <HomeHero />

      {/* Contact Methods Section */}
      <section
        id="assistant"
        className="relative -mt-6 bg-gradient-to-b from-slate-50 via-slate-50 to-white pb-20 pt-14 md:-mt-10 md:pt-20"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-slate-100/60 to-transparent" />
        <div className="relative z-10 mx-auto max-w-6xl px-4 md:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <p className="mb-3 inline-flex items-center rounded-full bg-white px-4 py-1 text-xs font-medium text-slate-500 shadow-sm ring-1 ring-slate-200">
              💬 {t("Choose how you want to talk")}
            </p>
            <h2 className="mb-4 text-3xl font-bold text-slate-900 md:text-4xl">
              {t("How would you like to contact us?")}
            </h2>
            <p className="mx-auto max-w-2xl text-sm text-slate-600 md:text-base">
              {t(
                "Start with a quick chat, a voice call or a video session with our AI-psychologist — choose the format that feels safest right now.",
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <ContactMethodCard
              icon={MessageSquare}
              title={t("Chat with AI-psychologist")}
              description={t(
                "Text support at any moment when you need to talk and sort out your thoughts.",
              )}
              buttonText={t("Start chat")}
              onClick={() => setIsChatOpen(true)}
            />

            <ContactMethodCard
              icon={PhoneCall}
              title={t("Call AI-psychologist")}
              description={t(
                "Voice format for more lively support when you want to hear a calm voice.",
              )}
              buttonText={t("Start voice call")}
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  // @ts-ignore
                  !window.SpeechRecognition &&
                  // @ts-ignore
                  !window.webkitSpeechRecognition &&
                  !navigator.mediaDevices
                ) {
                  alert(
                    t(
                      "Your browser may not fully support voice features. For the best experience, please use Chrome, Edge, or Safari.",
                    ),
                  )
                }
                setIsVoiceCallOpen(true)
              }}
            />

            <ContactMethodCard
              icon={Video}
              title={t("Video session with AI")}
              description={t(
                "Face-to-face session with a 3D-avatar when you want to feel presence and eye contact.",
              )}
              buttonText={t("Start video call")}
              onClick={() => {
                if (typeof window !== "undefined" && !navigator.mediaDevices) {
                  alert(
                    t(
                      "Your browser may not fully support video features. For the best experience, please use Chrome, Edge, or Safari.",
                    ),
                  )
                }
                setIsVideoCallOpen(true)
              }}
            />
          </div>
        </div>
      </section>

      <ServiceFeatures />

      <section id="contacts">
        <ContactSection />
      </section>

      {/* Модальные окна ассистентов */}
      <AIChatDialog
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        webhookUrl="https://nzzsd.app.n8n.cloud/webhook/coachai"
      />

      <VoiceCallDialog
        isOpen={isVoiceCallOpen}
        onClose={() => setIsVoiceCallOpen(false)}
        webhookUrl="https://nzzsd.app.n8n.cloud/webhook/02949f8d-c062-463b-a664-7dc7a78f5472"
        openAiApiKey=""
        onError={(error) => {
          console.error("Voice call error:", error)
          alert(t("There was an issue with the voice call. Please try again."))
          setIsVoiceCallOpen(false)
        }}
      />

      <VideoCallDialog
        isOpen={isVideoCallOpen}
        onClose={() => setIsVideoCallOpen(false)}
        webhookUrl="https://nzzsd.app.n8n.cloud/webhook/43103f8d-d98d-418d-8351-9a05241a3f4d"
        openAiApiKey=""
        onError={(error) => {
          console.error("Video call error:", error)
          alert(t("There was an issue with the video call. Please try again."))
          setIsVideoCallOpen(false)
        }}
      />
    </div>
  )
}
