"use client"

import {
  useState } from "react"
import { PhoneCall,
  MessageSquare,
  Video,
  ArrowRight,
  MessageCircle,
} from "lucide-react"
import { HomeHero } from "@/components/home-hero"
import ServiceFeatures from "@/components/service-features"
import ContactSection from "@/components/contact-section"
import { ContactMethodCard } from "@/components/contact-method-card"
import AIChatDialog from "@/components/ai-chat-dialog"
import VoiceCallDialog from "@/components/voice-call-dialog"
import VideoCallDialog from "@/components/video-call-dialog"
import { useLanguage } from "@/lib/i18n/language-context"
import { trackStartChatClick, trackStartVoiceClick, trackStartVideoClick } from "@/lib/tracking"
import { ShineBorder } from "@/components/ui/shine-border"
import { RainbowButton } from "@/components/ui/rainbow-button"

export default function Home() {
  const { t } = useLanguage()

  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false)
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false)

  // Открываем модалки сразу
  const openChat = () => {
    trackStartChatClick()
    setIsChatOpen(true)
  }

  const openVoice = () => {
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

    trackStartVoiceClick()
    setIsVoiceCallOpen(true)
  }

  const openVideo = () => {
    if (typeof window !== "undefined" && !navigator.mediaDevices) {
      alert(
        t(
          "Your browser may not fully support video features. For the best experience, please use Chrome, Edge, or Safari.",
        ),
      )
    }

    trackStartVideoClick()
    setIsVideoCallOpen(true)
  }

  return (
    <div className="bg-slate-50">
      <HomeHero />

      {/* Блок с тремя форматами общения */}
      <section
        id="assistant"
        className="relative -mt-10 bg-gradient-to-b from-slate-50 via-slate-50 to-white pb-28 pt-20 md:-mt-16 md:pt-24"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-slate-100/70 to-transparent" />

        <div className="relative z-10 mx-auto max-w-6xl px-4 md:px-6 lg:px-8">
          <ShineBorder
            borderRadius={32}
            borderWidth={2}
            duration={18}
            color={["#6366F1", "#8B5CF6", "#22D3EE"]}
            className="bg-transparent"
          >
            <div className="rounded-[28px] bg-white/95 px-6 py-8 md:px-10 md:py-10 lg:px-12 lg:py-12">
              <div className="mb-10 text-center">
                <p className="mb-3 inline-flex items-center rounded-full bg-slate-50 px-4 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                  {t("Not sure where to start? Just start")}
                </p>
                <h2 className="mb-3 text-3xl font-semibold text-slate-900 md:text-4xl">
                  {t("How would you prefer to start a conversation?")}
                </h2>
                <p className="mx-auto max-w-2xl text-sm text-slate-600 md:text-base">
                  {t(
                    "You can write, talk or see your AI companion — choose what feels calmest for you right now.",
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <ContactMethodCard
                  icon={MessageSquare}
                  title={t("Chat with AI companion")}
                  description={t(
                    "Describe in your own words what is happening — and get gentle, clear support in a few minutes.",
                  )}
                  benefits={[
                    t("Private and without cameras"),
                    t("You can write at your own pace"),
                    t("AI will help structure your thoughts"),
                  ]}
                  buttonText={t("Start chat")}
                  onClick={openChat}
                />

                <ContactMethodCard
                  icon={PhoneCall}
                  title={t("Call AI companion")}
                  description={t(
                    "When you want to hear a calm voice and feel someone nearby.",
                  )}
                  benefits={[
                    t("A feeling of real presence"),
                    t("You can just talk and be heard"),
                  ]}
                  buttonText={t("Start voice call")}
                  onClick={openVoice}
                />

                <ContactMethodCard
                  icon={Video}
                  title={t("Video session with AI")}
                  description={t(
                    "A format when it matters to see and feel someone nearby.",
                  )}
                  benefits={[
                    t("A live interaction"),
                    t("Best for deeper conversations"),
                  ]}
                  buttonText={t("Start video call")}
                  onClick={openVideo}
                />
              </div>

              <div className="mt-10 flex justify-center">
                <RainbowButton
                  type="button"
                  onClick={openChat}
                  className="h-11 px-8 shadow-xl shadow-indigo-500/30"
                >
                  {t("Not sure where to start? Just begin")}
                  <ArrowRight className="h-4 w-4" />
                </RainbowButton>
              </div>
            </div>
          </ShineBorder>
        </div>
      </section>

      <ServiceFeatures />

      <ContactSection />

      {/* Модальные окна ассистентов */}
      <AIChatDialog
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      <VoiceCallDialog
        isOpen={isVoiceCallOpen}
        onClose={() => setIsVoiceCallOpen(false)}
        onError={(error) => {
          console.error("Voice call error:", error)
          alert(
            t("There was an issue with the voice call. Please try again."),
          )
          setIsVoiceCallOpen(false)
        }}
      />

      <VideoCallDialog
        isOpen={isVideoCallOpen}
        onClose={() => setIsVideoCallOpen(false)}
        // обязателен по типу, но внутри компонента не используется
        onError={(error) => {
          console.error("Video call error:", error)
          alert(
            t("There was an issue with the video call. Please try again."),
          )
          setIsVideoCallOpen(false)
        }}
      />
    </div>
  )
}
