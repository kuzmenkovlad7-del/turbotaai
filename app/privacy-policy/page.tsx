"use client"

import { useLanguage } from "@/lib/i18n/language-context"

export default function PrivacyPolicyPage() {
  const { t } = useLanguage()

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto bg-card rounded-3xl shadow-lg p-8 md:p-12">
        <h1 className="text-4xl font-bold mb-8 text-foreground">
          {t("Privacy Policy")}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {t("Last Updated")}: November 2025
        </p>

        <div className="space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Information We Collect")}
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {t("Personal Information")}
                </h3>
                <p>
                  When you create an account, we collect your name, email
                  address, and authentication credentials. This information is
                  necessary to provide our services and maintain your account
                  security.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {t("Session Data")}
                </h3>
                <p>
                  During your interactions with our AI psychologist, we collect
                  conversation transcripts, voice recordings (when using
                  voice/video features), and session metadata such as duration
                  and timestamps.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {t("Technical Information")}
                </h3>
                <p>
                  We automatically collect device information, IP addresses,
                  browser types, and usage patterns to improve our service and
                  ensure platform security.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("How We Use Your Information")}
            </h2>
            {/* остальной текст как есть */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Data Security")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Your Rights")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Data Retention")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Third-Party Services")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("International Data Transfers")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Children's Privacy")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Changes to This Policy")}
            </h2>
            {/* ... */}
          </section>
        </div>
      </div>
    </div>
  )
}
