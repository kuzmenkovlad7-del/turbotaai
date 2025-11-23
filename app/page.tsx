"use client"

import { Button } from "@/components/ui/button"
import { PhoneCall, MessageSquare, Video } from "lucide-react"
import ServiceFeatures from "@/components/service-features"
import { HomeHero } from "@/components/home-hero"
import ContactSection from "@/components/contact-section"
import { useLanguage } from "@/lib/i18n/language-context"
import { keyframes } from "@emotion/react"
import styled from "@emotion/styled"
import { useState } from "react"
import AIChatDialog from "@/components/ai-chat-dialog"
import VoiceCallDialog from "@/components/voice-call-dialog"
import VideoCallDialog from "@/components/video-call-dialog"

const phoneRingKeyframes = keyframes`
  0% { transform: rotate(0deg); }
  10% { transform: rotate(-10deg); }
  20% { transform: rotate(10deg); }
  30% { transform: rotate(-10deg); }
  40% { transform: rotate(10deg); }
  50% { transform: rotate(-10deg); }
  60% { transform: rotate(10deg); }
  70% { transform: rotate(-10deg); }
  80% { transform: rotate(10deg); }
  90% { transform: rotate(-10deg); }
  100% { transform: rotate(0deg); }
`

const typingDotsKeyframes = keyframes`
  0%, 100% {
    opacity: 0.2;
  }
  33% {
    opacity: 1;
  }
`

const cameraDrawKeyframes = keyframes`
  0% { transform: scale(1) rotate(0deg); }
  25% { transform: scale(0.9) rotate(-5deg); }
  50% { transform: scale(1.1) rotate(5deg); }
  75% { transform: scale(0.95) rotate(-3deg); }
  100% { transform: scale(1) rotate(0deg); }
`

const AnimatedContainer = styled.div`
  .phone-container:hover .phone-icon {
    animation: ${phoneRingKeyframes} 1.5s ease-in-out;
    animation-iteration-count: infinite;
  }
  
  .chat-container:hover .chat-icon {
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .chat-container:hover .typing-dots {
    opacity: 1;
    transition: opacity 0.3s ease;
  }
  
  .chat-container .typing-dot:nth-child(1) {
    animation: ${typingDotsKeyframes} 1.4s infinite 0s;
  }
  
  .chat-container .typing-dot:nth-child(2) {
    animation: ${typingDotsKeyframes} 1.4s infinite 0.2s;
  }
  
  .chat-container .typing-dot:nth-child(3) {
    animation: ${typingDotsKeyframes} 1.4s infinite 0.4s;
  }
  
  .video-container:hover .video-icon {
    animation: ${cameraDrawKeyframes} 2.5s ease-in-out;
    animation-iteration-count: infinite;
  }
`

export default function Home() {
  const { t } = useLanguage()
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false)
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false)

  return (
    <AnimatedContainer>
      <div>
        <HomeHero />

        <section id="assistant" className="py-16 px-4 md:px-6 lg:px-8 bg-slate-50">
            <div className="max-w-6xl mx-auto">
              <div className="bg-white backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-slate-200">
                <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-slate-900">
                  {t("How would you like to connect?")}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="phone-container flex flex-col items-center p-8 rounded-xl bg-gradient-to-br from-white to-slate-50 shadow-md hover:shadow-xl transition-all border border-slate-100">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6 shadow-lg">
                      <PhoneCall className="h-8 w-8 text-white phone-icon" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-slate-900">{t("Call an AI Psychologist")}</h3>
                    <p className="text-slate-600 text-center mb-6">
                      {t("Speak directly with our AI psychologist for immediate support.")}
                    </p>
                    <Button
                      className="bg-gradient-to-r from-primary to-accent text-primary-foreground w-full shadow-md hover:shadow-lg transition-all"
                      onClick={() => {
                        if (
                          typeof window !== "undefined" &&
                          !window.SpeechRecognition &&
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
                    >
                      {t("Start Voice Call")}
                    </Button>
                  </div>

                  <div className="chat-container flex flex-col items-center p-8 rounded-xl bg-gradient-to-br from-white to-slate-50 shadow-md hover:shadow-xl transition-all border border-slate-100">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6 relative shadow-lg">
                      <MessageSquare className="h-8 w-8 text-white chat-icon transition-opacity duration-300" />
                      <div className="typing-dots absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300">
                        <div className="typing-dot h-2 w-2 bg-white rounded-full mx-1"></div>
                        <div className="typing-dot h-2 w-2 bg-white rounded-full mx-1"></div>
                        <div className="typing-dot h-2 w-2 bg-white rounded-full mx-1"></div>
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-slate-900">{t("Chat with AI")}</h3>
                    <p className="text-slate-600 text-center mb-6">
                      {t("Text-based conversation with our AI for support at your own pace.")}
                    </p>
                    <Button
                      className="bg-gradient-to-r from-primary to-accent text-primary-foreground w-full shadow-md hover:shadow-lg transition-all"
                      onClick={() => setIsChatOpen(true)}
                    >
                      {t("Start Chat")}
                    </Button>
                  </div>

                  <div className="video-container flex flex-col items-center p-8 rounded-xl bg-gradient-to-br from-white to-slate-50 shadow-md hover:shadow-xl transition-all border border-slate-100">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6 shadow-lg">
                      <Video className="h-8 w-8 text-white video-icon" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-slate-900">{t("Video Call with AI")}</h3>
                    <p className="text-slate-600 text-center mb-6">
                      {t("Face-to-face session with our 3D animated AI psychologist.")}
                    </p>
                    <Button
                      className="bg-gradient-to-r from-primary to-accent text-primary-foreground w-full shadow-md hover:shadow-lg transition-all"
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
                    >
                      {t("Start Video Call")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

        <ServiceFeatures />
        <section id="contacts">
          <ContactSection />
        </section>

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
    </AnimatedContainer>
  )
}
