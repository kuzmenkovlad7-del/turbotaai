"use client"

import { useLanguage } from "@/lib/i18n/language-context"

export default function TermsOfUsePage() {
  const { t } = useLanguage()

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto bg-card rounded-3xl shadow-lg p-8 md:p-12">
        <h1 className="text-4xl font-bold mb-8 text-foreground">
          {t("Terms of Use")}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {t("Last Updated")}: November 2025
        </p>

        <div className="space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Acceptance of Terms")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Eligibility")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Use of Services")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("User Responsibilities")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Prohibited Activities")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Intellectual Property")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Payment and Billing")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Cancellation and Refunds")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Limitation of Liability")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Disclaimer of Warranties")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Indemnification")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Termination")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Governing Law and Dispute Resolution")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Changes to Terms")}
            </h2>
            {/* ... */}
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">
              {t("Severability")}
            </h2>
            {/* ... */}
          </section>
        </div>
      </div>
    </div>
  )
}
