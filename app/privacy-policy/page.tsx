"use client"

import { useLanguage } from "@/lib/i18n/language-context"

export default function PrivacyPolicyPage() {
  const { t } = useLanguage()

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto bg-card rounded-3xl shadow-lg p-8 md:p-12">
        <h1 className="text-4xl font-bold mb-8 text-foreground">{t("Privacy Policy")}</h1>
        <p className="text-sm text-muted-foreground mb-8">Last Updated: November 2024</p>

        <div className="space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">{t("Information We Collect")}</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">Personal Information</h3>
                <p>When you create an account, we collect your name, email address, and authentication credentials. This information is necessary to provide our services and maintain your account security.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">Session Data</h3>
                <p>During your interactions with our AI psychologist, we collect conversation transcripts, voice recordings (when using voice/video features), and session metadata such as duration and timestamps.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">Technical Information</h3>
                <p>We automatically collect device information, IP addresses, browser types, and usage patterns to improve our service and ensure platform security.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">{t("How We Use Your Information")}</h2>
            <div className="space-y-4">
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Providing personalized AI psychology support tailored to your needs</li>
                <li>Maintaining conversation history to improve continuity across sessions</li>
                <li>Analyzing aggregate data to enhance our AI models and service quality</li>
                <li>Sending service updates, security alerts, and important notifications</li>
                <li>Ensuring platform security and preventing fraudulent activities</li>
                <li>Complying with legal obligations and responding to lawful requests</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">{t("Data Security")}</h2>
            <div className="space-y-4">
              <p>We implement enterprise-grade security measures to protect your information:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li><strong>End-to-End Encryption:</strong> All conversations are encrypted during transmission and at rest</li>
                <li><strong>Secure Authentication:</strong> Password protection with modern hashing algorithms</li>
                <li><strong>Access Controls:</strong> Strict internal policies limiting data access to authorized personnel only</li>
                <li><strong>Regular Audits:</strong> Periodic security assessments and vulnerability testing</li>
                <li><strong>Data Isolation:</strong> Your data is isolated and never mixed with other users</li>
              </ul>
              <p className="mt-4">While we take extensive precautions, no internet transmission is completely secure. We encourage you to protect your account credentials and contact us immediately if you suspect unauthorized access.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">{t("Your Rights")}</h2>
            <div className="space-y-4">
              <p>You have comprehensive rights regarding your personal data:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li><strong>Access:</strong> Request a copy of all personal data we hold about you</li>
                <li><strong>Rectification:</strong> Correct inaccurate or incomplete information</li>
                <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
                <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format</li>
                <li><strong>Objection:</strong> Object to certain types of data processing</li>
                <li><strong>Restriction:</strong> Request restriction of processing in specific circumstances</li>
              </ul>
              <p className="mt-4">To exercise any of these rights, please contact us at privacy@myitra.com. We will respond to your request within 30 days.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">Data Retention</h2>
            <div className="space-y-4">
              <p>We retain your data only as long as necessary to provide our services:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Active account data is retained while your account remains active</li>
                <li>Session transcripts are retained for 12 months to enable continuity of care</li>
                <li>Deleted accounts are fully purged within 90 days, except where retention is required by law</li>
                <li>Anonymous usage analytics may be retained indefinitely for service improvement</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">Third-Party Services</h2>
            <div className="space-y-4">
              <p>We work with trusted third-party services to deliver our platform:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Cloud infrastructure providers for secure data storage</li>
                <li>Payment processors for transaction handling (we never store payment card details)</li>
                <li>Analytics services for understanding service usage patterns</li>
              </ul>
              <p className="mt-4">All third-party providers are bound by strict data protection agreements and only process data on our behalf.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">International Data Transfers</h2>
            <div className="space-y-4">
              <p>Your data may be processed in countries outside your residence. We ensure adequate protection through:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Standard contractual clauses approved by regulatory authorities</li>
                <li>Verification that receiving countries provide adequate data protection</li>
                <li>Additional safeguards where required by applicable law</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">Children's Privacy</h2>
            <div className="space-y-4">
              <p>Our services are not intended for individuals under 18 years of age. We do not knowingly collect personal information from children. If you believe we have inadvertently collected such information, please contact us immediately so we can delete it.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">Changes to This Policy</h2>
            <div className="space-y-4">
              <p>We may update this Privacy Policy periodically to reflect changes in our practices or legal requirements. We will notify you of significant changes via email or through prominent notice on our platform. Continued use of our services after such notification constitutes acceptance of the updated policy.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">{t("Contact Us")}</h2>
            <div className="space-y-4">
              <p>If you have questions about this Privacy Policy or our data practices, please contact us:</p>
              <div className="ml-2 mt-4">
                <p><strong>Email:</strong> privacy@myitra.com</p>
                <p><strong>Address:</strong> Myitra Psychology Services</p>
                <p className="ml-16">123 AI Avenue</p>
                <p className="ml-16">Tech City, TC 12345</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
