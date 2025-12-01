"use client"

import { useLanguage } from "@/lib/i18n/language-context"

export default function TermsOfUsePage() {
  const { t } = useLanguage()

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-4xl rounded-3xl bg-card p-8 shadow-lg md:p-12">
        <h1 className="mb-8 text-4xl font-bold text-foreground">
          {t("Terms of Use")}
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          {t("Last Updated: November 2025")}
        </p>

        <div className="space-y-8 text-muted-foreground">
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-foreground">
              {t("Acceptance of Terms")}
            </h2>
            <div className="space-y-4">
              <p>
                By accessing or using TurbotaAI&apos;s AI psychology services,
                you agree to be bound by these Terms of Use and all applicable
                laws and regulations. If you do not agree with any of these
                terms, you are prohibited from using or accessing this service.
              </p>
              <p>
                These terms constitute a legally binding agreement between you
                and TurbotaAI Psychology Services. Your continued use of our
                platform constitutes ongoing acceptance of these terms,
                including any modifications we may make from time to time.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-foreground">
              {t("Eligibility")}
            </h2>
            <div className="space-y-4">
              <p>To use our services, you must:</p>
              <ul className="ml-2 list-inside list-disc space-y-2">
                <li>Be at least 18 years of age</li>
                <li>Have the legal capacity to enter into binding contracts</li>
                <li>
                  Not be prohibited from using our services under any applicable
                  laws
                </li>
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your account credentials</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-foreground">
              {t("Use of Services")}
            </h2>
            <div className="space-y-4">
              <p>
                Our AI psychology services are designed to provide supportive
                conversations and psychological insights. However, you
                acknowledge and understand that:
              </p>
              <ul className="ml-2 list-inside list-disc space-y-2">
                <li>
                  Our AI service is not a substitute for professional medical or
                  psychiatric treatment
                </li>
                <li>The AI cannot diagnose medical or mental health conditions</li>
                <li>
                  In case of emergency or crisis, you should immediately contact
                  emergency services or a crisis hotline
                </li>
                <li>
                  Our service is intended for informational and support purposes
                  only
                </li>
                <li>
                  Any actions you take based on interactions with our AI are at
                  your own discretion and risk
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-foreground">
              {t("User Responsibilities")}
            </h2>
            <div className="space-y-4">
              <p>As a user of our services, you agree to:</p>
              <ul className="ml-2 list-inside list-disc space-y-2">
                <li>
                  Provide accurate, current, and complete information during
                  registration
                </li>
                <li>
                  Maintain the confidentiality of your account credentials
                </li>
                <li>
                  Notify us immediately of any unauthorized access to your
                  account
                </li>
                <li>
                  Use the service only for lawful purposes and in accordance
                  with these terms
                </li>
                <li>
                  Not attempt to interfere with, compromise, or disrupt our
                  services
                </li>
                <li>
                  Not use automated systems to access or interact with our
                  services without authorization
                </li>
                <li>Not share, sell, or transfer your account to any third party</li>
                <li>
                  Respect the intellectual property rights of TurbotaAI and
                  third parties
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-foreground">
              {t("Prohibited Activities")}
            </h2>
            <div className="space-y-4">
              <p>You expressly agree not to:</p>
              <ul className="ml-2 list-inside list-disc space-y-2">
                <li>Use the service for any illegal or unauthorized purpose</li>
                <li>
                  Attempt to gain unauthorized access to our systems or networks
                </li>
                <li>
                  Reverse engineer, decompile, or disassemble any part of our
                  service
                </li>
                <li>Collect or harvest personal information about other users</li>
                <li>Transmit viruses, malware, or other harmful code</li>
                <li>
                  Impersonate any person or entity or misrepresent your
                  affiliation
                </li>
                <li>Interfere with or disrupt the service or servers</li>
                <li>Use the service to harass, abuse, or harm others</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-foreground">
              {t("Intellectual Property")}
            </h2>
            <div className="space-y-4">
              <p>
                All content, features, and functionality of our service,
                including but not limited to text, graphics, logos, icons,
                images, audio clips, and software, are the exclusive property of
                TurbotaAI Psychology Services and are protected by international
                copyright, trademark, and other intellectual property laws.
              </p>
              <p>
                You are granted a limited, non-exclusive, non-transferable
                license to access and use our services for personal,
                non-commercial purposes. This license does not include any
                rights to:
              </p>
              <ul className="ml-2 list-inside list-disc space-y-2">
                <li>
                  Reproduce or copy our content without written permission
                </li>
                <li>
                  Modify or create derivative works based on our service
                </li>
                <li>
                  Distribute, transmit, or publicly display our content
                </li>
                <li>
                  Use our service for commercial purposes without authorization
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-foreground">
              {t("Payment and Billing")}
            </h2>
            <div className="space-y-4">
              <p>
                Our pricing structure is clearly displayed on our platform. By
                purchasing our services, you agree to:
              </p>
              <ul className="ml-2 list-inside list-disc space-y-2">
                <li>Pay all applicable fees as described at the time of purchase</li>
                <li>Provide accurate and complete billing information</li>
                <li>
                  Authorize us to charge your payment method for all applicable
                  fees
                </li>
                <li>Pay any applicable taxes</li>
              </ul>
              <p className="mt-4">
                We reserve the right to modify our pricing at any time. Changes
                will be communicated in advance and will not affect active
                subscriptions until renewal.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-foreground">
              {t("Cancellation and Refunds")}
            </h2>
            <div className="space-y-4">
              <p>
                You may cancel your subscription at any time through your
                account settings. Cancellations will take effect at the end of
                your current billing period.
              </p>
              <p>
                Refunds are provided on a case-by-case basis at our sole
                discretion. Generally:
              </p>
              <ul className="ml-2 list-inside list-disc space-y-2">
                <li>Unused credits may be eligible for prorated refunds</li>
                <li>
                  Technical issues preventing service access may warrant refunds
                </li>
                <li>
                  Refund requests must be submitted within 14 days of the charge
                </li>
                <li>We do not provide refunds for services already rendered</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-foreground">
              {t("Limitation of Liability")}
            </h2>
            <div className="space-y-4">
              <p>
                To the fullest extent permitted by applicable law, TurbotaAI
                Psychology Services shall not be liable for:
              </p>
              <ul className="ml-2 list-inside list-disc space-y-2">
                <li>
                  Indirect, incidental, special, consequential, or punitive
                  damages
                </li>
                <li>Loss of profits, revenue, data, or use</li>
                <li>Service interruptions or technical failures</li>
                <li>
                  Any damages arising from your use or inability to use our
                  service
                </li>
                <li>Unauthorized access to or alteration of your data</li>
                <li>Actions or content of third parties</li>
              </ul>
              <p className="mt-4">
                Our total liability for any claims arising from your use of the
                service shall not exceed the amount you paid to us in the twelve
                months preceding the claim.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-foreground">
              {t("Disclaimer of Warranties")}
            </h2>
            <div className="space-y-4">
              <p>
                Our services are provided &quot;as is&quot; and &quot;as
                available&quot; without warranties of any kind, either express
                or implied, including but not limited to:
              </p>
              <ul className="ml-2 list-inside list-disc space-y-2">
                <li>Warranties of merchantability</li>
                <li>Fitness for a particular purpose</li>
                <li>Non-infringement</li>
                <li>Accuracy, reliability, or completeness of information</li>
                <li>Uninterrupted or error-free service</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-foreground">
              {t("Indemnification")}
            </h2>
            <div className="space-y-4">
              <p>
                You agree to indemnify, defend, and hold harmless TurbotaAI
                Psychology Services, its affiliates, officers, directors,
                employees, and agents from and against any claims, liabilities,
                damages, losses, costs, or expenses arising from:
              </p>
              <ul className="ml-2 list-inside list-disc space-y-2">
                <li>Your use or misuse of our services</li>
                <li>Your violation of these Terms of Use</li>
                <li>Your violation of any rights of another party</li>
                <li>Your violation of any applicable laws or regulations</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-foreground">
              {t("Termination")}
            </h2>
            <div className="space-y-4">
              <p>
                We reserve the right to suspend or terminate your account and
                access to our services at our sole discretion, without notice,
                for conduct that we believe:
              </p>
              <ul className="ml-2 list-inside list-disc space-y-2">
                <li>Violates these Terms of Use</li>
                <li>Is harmful to other users or our business</li>
                <li>Exposes us to legal liability</li>
                <li>Is otherwise inappropriate or unlawful</li>
              </ul>
              <p className="mt-4">
                Upon termination, your right to use the service will immediately
                cease, but provisions regarding intellectual property, disclaimer
                of warranties, limitation of liability, and indemnification will
                survive.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-foreground">
              {t("Governing Law and Dispute Resolution")}
            </h2>
            <div className="space-y-4">
              <p>
                These Terms of Use shall be governed by and construed in
                accordance with the laws of the jurisdiction in which TurbotaAI
                Psychology Services operates, without regard to conflict of law
                principles.
              </p>
              <p>
                Any disputes arising from these terms or your use of our
                services shall be resolved through binding arbitration in
                accordance with applicable arbitration rules, except where
                prohibited by law.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-foreground">
              {t("Changes to Terms")}
            </h2>
            <div className="space-y-4">
              <p>
                We reserve the right to modify or replace these Terms of Use at
                any time at our sole discretion. Material changes will be
                notified through:
              </p>
              <ul className="ml-2 list-inside list-disc space-y-2">
                <li>Email notification to your registered address</li>
                <li>Prominent notice on our platform</li>
                <li>In-app notifications</li>
              </ul>
              <p className="mt-4">
                Your continued use of our services after such modifications
                constitutes your acceptance of the updated terms. We encourage
                you to review these terms periodically.
              </p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-foreground">
              {t("Severability")}
            </h2>
            <div className="space-y-4">
              <p>
                If any provision of these Terms of Use is found to be
                unenforceable or invalid, that provision will be limited or
                eliminated to the minimum extent necessary so that these terms
