// app/page.tsx
"use client"

import { useState } from "react"
import { PhoneCall, MessageSquare, Video, ArrowRight } from "lucide-react"

import { HomeHero } from "@/components/home-hero"
import ServiceFeatures from "@/components/service-features"
import ContactSection from "@/components/contact-section"
import { ContactMethodCard } from "@/components/contact-method-card"
import AIChatDialog from "@/components/ai-chat-dialog"
import VoiceCallDialog from "@/components/voice-call-dialog"
import VideoCallDialog from "@/components/video-call-dialog"
import { useLanguage } from "@/lib/i18n/language-context"
import { ShineBorder } from "@/components/ui/shine-border"
import { RainbowButton } from "@/components/ui/rainbow-button"

// webhooks ассистентов берём из .env
const CHAT_WEBHOOK =
  process.env.NEXT_PUBLIC_N8N_CHAT_WEBHOOK_URL || ""
const VOICE_WEBHOOK =
  process.env.NEXT_PUBLIC_N8N_VOICE_WEBHOOK_URL || ""
const VIDEO_WEBHOOK =
  process.env.NEXT_PUBLIC_N8N_VIDEO_WEBHOOK_URL || ""

export default function Home() {
  const { t } = useLanguage()

  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false)
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false)

  const openChat = () => {
    if (!CHAT_WEBHOOK) {
      alert(
        t(
          "Chat assistant is temporarily unavailable. Webhook is not configured yet.",
        ),
      )
      return
    }
    setIsChatOpen(true)
  }

  const openVoice = () => {
    if (!VOICE_WEBHOOK) {
      alert(
        t(
          "Voice assistant is temporarily unavailable. Webhook is not configured yet.",
        ),
      )
      return
    }

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
  }

  const openVideo = () => {
    if (!VIDEO_WEBHOOK) {
      alert(
        t(
          "Video assistant is temporarily unavailable. Webhook is not configured yet.",
        ),
      )
      return
    }

    if (typeof window !== "undefined" && !navigator.mediaDevices) {
      alert(
        t(
          "Your browser may not fully support video features. For the best experience, please use Chrome, Edge, or Safari.",
        ),
      )
    }

    setIsVideoCallOpen(true)
  }

  return (
    <div className="bg-slate-50">
      <HomeHero />

      {/* Contact Methods Section */}
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
                  💬 {t("Choose how you want to talk")}
                </p>
                <h2 className="mb-3 text-3xl font-semibold text-slate-900 md:text-4xl">
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
                    "Write what is happening in your own words and get structured support in a few minutes.",
                  )}
                  benefits={[
                    t(
                      "Best when you need privacy and want to stay silent around other people.",
                    ),
                    t(
                      "You can return to the conversation history and exercises at any time.",
                    ),
                  ]}
                  buttonText={t("Start chat")}
                  onClick={openChat}
                />

                <ContactMethodCard
                  icon={PhoneCall}
                  title={t("Call AI-psychologist")}
                  description={t(
                    "Voice format for more lively support when you want to hear a calm voice.",
                  )}
                  benefits={[
                    t("Helps reduce the feeling of loneliness in difficult moments."),
                    t(
                      "Suitable when emotions are strong and you need to speak out quickly.",
                    ),
                  ]}
                  buttonText={t("Start voice call")}
                  onClick={openVoice}
                />

                <ContactMethodCard
                  icon={Video}
                  title={t("Video session with AI")}
                  description={t(
                    "Face-to-face session with a 3D-avatar when you want to feel presence and eye contact.",
                  )}
                  benefits={[
                    t(
                      "Gives a stronger feeling that someone is really next to you.",
                    ),
                    t(
                      "Best for deeper work, body reactions and long-term processes.",
                    ),
                  ]}
                  buttonText={t("Start video call")}
                  onClick={openVideo}
                />
              </div>

              {/* Общий радужный CTA под карточками */}
              <div className="mt-10 flex justify-center">
                <RainbowButton
                  type="button"
                  onClick={openChat}
                  className="h-11 px-8 shadow-xl shadow-indigo-500/30"
                >
                  {t("Not sure which format? Start with a safe chat")}
                  <ArrowRight className="h-4 w-4" />
                </RainbowButton>
              </div>
            </div>
          </ShineBorder>
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
        webhookUrl={CHAT_WEBHOOK}
      />

      <VoiceCallDialog
        isOpen={isVoiceCallOpen}
        onClose={() => setIsVoiceCallOpen(false)}
        webhookUrl={VOICE_WEBHOOK}
        openAiApiKey="" // OpenAI остаётся в n8n
        onError={(error) => {
          console.error("Voice call error:", error)
          alert(
            t(
              "There was an issue with the voice call. Please try again.",
            ),
          )
          setIsVoiceCallOpen(false)
        }}
      />

      <VideoCallDialog
        isOpen={isVideoCallOpen}
        onClose={() => setIsVideoCallOpen(false)}
        webhookUrl={VIDEO_WEBHOOK}
        openAiApiKey="" // OpenAI остаётся в n8n
        onError={(error) => {
          console.error("Video call error:", error)
          alert(
            t(
              "There was an issue with the video call. Please try again.",
            ),
          )
          setIsVideoCallOpen(false)
        }}
      />
    </div>
  )
}
