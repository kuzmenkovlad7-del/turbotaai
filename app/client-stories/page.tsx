"use client"

import { useLanguage } from "@/lib/i18n/language-context"
import { Quote } from "lucide-react"

export default function StoriesPage() {
  const { t } = useLanguage()

  const stories = [
    {
      name: t("Story 1 Name"),
      story: t("Story 1 Text"),
      initials: "АМ",
    },
    {
      name: t("Story 2 Name"),
      story: t("Story 2 Text"),
      initials: "ЕК",
    },
    {
      name: t("Story 3 Name"),
      story: t("Story 3 Text"),
      initials: "ДС",
    },
  ]

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground">{t("Client Stories")}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("Stories Page Description")}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {stories.map((story, index) => (
            <div key={index} className="bg-card rounded-2xl shadow-md border border-border p-6">
              <Quote className="h-8 w-8 text-accent mb-4" />
              <p className="text-muted-foreground mb-6 leading-relaxed">{story.story}</p>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  {story.initials}
                </div>
                <div>
                  <p className="font-medium text-foreground">{story.name}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
