import { Translatable } from "@/components/translatable"

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <article className="rounded-3xl bg-white/80 shadow-sm border border-slate-100 px-4 py-8 sm:px-10 sm:py-10">
          <header className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              <Translatable id="privacy.title">Privacy Policy</Translatable>
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              <Translatable id="privacy.lastUpdated">
                Last Updated: November 2025
              </Translatable>
            </p>
          </header>

          <div className="space-y-8 text-[15px] leading-relaxed text-slate-800">
            {/* Information We Collect */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Translatable id="privacy.info.title">
                  Information We Collect
                </Translatable>
              </h2>

              <p>
                <Translatable id="privacy.info.intro1">
                  {
                    "This Privacy Policy explains what information TurbotaAI collects, how we use it and how we protect it. We design the Service to respect your privacy and personal boundaries."
                  }
                </Translatable>
              </p>
              <p>
                <Translatable id="privacy.info.intro2">
                  {
                    "By using the Service, you agree to the terms of this Policy. If you do not agree, please do not use the Service."
                  }
                </Translatable>
              </p>

              <h3 className="font-semibold">
                <Translatable id="privacy.info.personal.title">
                  1. Personal and contact information
                </Translatable>
              </h3>
              <p>
                <Translatable id="privacy.info.personal.intro">
                  {"We may collect the following information:"}
                </Translatable>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <Translatable id="privacy.info.personal.item1">
                    your name or nickname that you provide;
                  </Translatable>
                </li>
                <li>
                  <Translatable id="privacy.info.personal.item2">
                    e-mail address if you submit it for contact or registration;
                  </Translatable>
                </li>
                <li>
                  <Translatable id="privacy.info.personal.item3">
                    {
                      "any other information you voluntarily provide in forms (for example, in the contact or sign-up form)."
                    }
                  </Translatable>
                </li>
              </ul>

              <h3 className="font-semibold">
                <Translatable id="privacy.info.sessions.title">
                  2. Session content and messages
                </Translatable>
              </h3>
              <p>
                <Translatable id="privacy.info.sessions.intro">
                  {
                    "When you use chat, voice or video assistant, we process the content of your messages, spoken input or text in order to generate responses and guidance. Depending on settings, some of this data may be temporarily stored to:"
                  }
                </Translatable>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <Translatable id="privacy.info.sessions.item1">
                    maintain a conversation history;
                  </Translatable>
                </li>
                <li>
                  <Translatable id="privacy.info.sessions.item2">
                    improve the quality of the assistant's replies;
                  </Translatable>
                </li>
                <li>
                  <Translatable id="privacy.info.sessions.item3">
                    analyse common patterns in anonymised or aggregated form.
                  </Translatable>
                </li>
              </ul>

              <h3 className="font-semibold">
                <Translatable id="privacy.info.technical.title">
                  3. Technical information
                </Translatable>
              </h3>
              <p>
                <Translatable id="privacy.info.technical.intro">
                  {"We may also collect technical data, such as:"}
                </Translatable>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <Translatable id="privacy.info.technical.item1">
                    IP address and approximate location;
                  </Translatable>
                </li>
                <li>
                  <Translatable id="privacy.info.technical.item2">
                    information about your device, browser and operating system;
                  </Translatable>
                </li>
                <li>
                  <Translatable id="privacy.info.technical.item3">
                    {
                      "cookies and similar technologies required for the Service to work and for analytics."
                    }
                  </Translatable>
                </li>
              </ul>
            </section>

            {/* How We Use Your Information */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Translatable id="privacy.use.title">
                  How We Use Your Information
                </Translatable>
              </h2>
              <p>
                <Translatable id="privacy.use.intro">
                  {"We use the collected data for the following purposes:"}
                </Translatable>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <Translatable id="privacy.use.item1">
                    to provide you with access to chat, voice and video
                    sessions;
                  </Translatable>
                </li>
                <li>
                  <Translatable id="privacy.use.item2">
                    to adapt the assistant's responses to your request and
                    language;
                  </Translatable>
                </li>
                <li>
                  <Translatable id="privacy.use.item3">
                    to maintain the Service, diagnose errors and ensure
                    security;
                  </Translatable>
                </li>
                <li>
                  <Translatable id="privacy.use.item4">
                    to analyse how the Service is used and improve our support
                    scenarios;
                  </Translatable>
                </li>
                <li>
                  <Translatable id="privacy.use.item5">
                    {
                      "to communicate with you (for example, responses to requests, important notifications)."
                    }
                  </Translatable>
                </li>
              </ul>
              <p>
                <Translatable id="privacy.use.nosale">
                  {
                    "We do not sell your personal data to third parties and do not use the content of your sessions for targeted advertising."
                  }
                </Translatable>
              </p>
            </section>

            {/* Data Security */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Translatable id="privacy.security.title">
                  Data Security
                </Translatable>
              </h2>
              <p>
                <Translatable id="privacy.security.p1">
                  {
                    "We apply technical and organisational security measures to protect data from unauthorised access, loss or misuse. These may include encryption, access controls, log audits and other cybersecurity practices."
                  }
                </Translatable>
              </p>
              <p>
                <Translatable id="privacy.security.p2">
                  {
                    "However, no online system can guarantee absolute security. You also play a role in keeping your data safe — for example, by not sharing your credentials with others and by using strong passwords (if user accounts are introduced)."
                  }
                </Translatable>
              </p>
            </section>

            {/* Data Retention */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Translatable id="privacy.retention.title">
                  Data Retention
                </Translatable>
              </h2>
              <p>
                <Translatable id="privacy.retention.p1">
                  {
                    "We retain data only for as long as necessary to fulfil the purposes described in this Policy or as required by law."
                  }
                </Translatable>
              </p>
              <p>
                <Translatable id="privacy.retention.p2">
                  {
                    "Conversation history and technical logs may be deleted or anonymised after a certain period of time. In the future the interface may include settings that allow you to delete your history yourself."
                  }
                </Translatable>
              </p>
            </section>

            {/* Third-Party Services */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Translatable id="privacy.thirdparty.title">
                  Third-Party Services
                </Translatable>
              </h2>
              <p>
                <Translatable id="privacy.thirdparty.p1">
                  {
                    "To operate the Service we may use third-party providers such as hosting companies, payment processors, video platforms or AI model providers."
                  }
                </Translatable>
              </p>
              <p>
                <Translatable id="privacy.thirdparty.p2">
                  {
                    "These providers may process your data on our behalf and in accordance with our instructions. We aim to work only with entities that follow appropriate data protection standards."
                  }
                </Translatable>
              </p>
              <p>
                <Translatable id="privacy.thirdparty.p3">
                  {
                    "Because infrastructure may be located in different countries, your data may sometimes be transferred outside the country where you live. We take steps to ensure that such transfers comply with applicable data protection laws."
                  }
                </Translatable>
              </p>
            </section>

            {/* Children's Privacy */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Translatable id="privacy.children.title">
                  Children's Privacy
                </Translatable>
              </h2>
              <p>
                <Translatable id="privacy.children.p1">
                  {
                    "TurbotaAI is not intended for independent use by children under the age of 13. If you are under 18, parental or guardian consent may be required under the laws of your country."
                  }
                </Translatable>
              </p>
              <p>
                <Translatable id="privacy.children.p2">
                  {
                    "If we become aware that we have collected personal data from a child without appropriate consent, we will take steps to delete such information."
                  }
                </Translatable>
              </p>
            </section>

            {/* Your Rights */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Translatable id="privacy.rights.title">
                  Your Rights
                </Translatable>
              </h2>
              <p>
                <Translatable id="privacy.rights.intro">
                  {
                    "Depending on the laws of your country, you may have the right to:"
                  }
                </Translatable>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <Translatable id="privacy.rights.item1">
                    request information about the data we hold about you;
                  </Translatable>
                </li>
                <li>
                  <Translatable id="privacy.rights.item2">
                    ask us to correct inaccurate information;
                  </Translatable>
                </li>
                <li>
                  <Translatable id="privacy.rights.item3">
                    request deletion of certain data (where we are not required
                    to keep it by law);
                  </Translatable>
                </li>
                <li>
                  <Translatable id="privacy.rights.item4">
                    object to or restrict certain types of processing; and
                  </Translatable>
                </li>
                <li>
                  <Translatable id="privacy.rights.item5">
                    lodge a complaint with a data protection supervisory
                    authority.
                  </Translatable>
                </li>
              </ul>
              <p>
                <Translatable id="privacy.rights.contact">
                  {
                    'To exercise your rights, you can contact us via the feedback form or the e-mail address listed in the "Contact" section.'
                  }
                </Translatable>
              </p>
            </section>

            {/* Changes to This Policy */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Translatable id="privacy.changes.title">
                  Changes to This Policy
                </Translatable>
              </h2>
              <p>
                <Translatable id="privacy.changes.p1">
                  {
                    "We may update this Privacy Policy from time to time. The date of the latest update is shown at the top of this page."
                  }
                </Translatable>
              </p>
              <p>
                <Translatable id="privacy.changes.p2">
                  {
                    "If we make material changes, we may additionally notify you through the Service or by e-mail (if available). By continuing to use the Service after the changes take effect, you agree to the updated Policy."
                  }
                </Translatable>
              </p>
            </section>

            {/* Contact Information */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Translatable id="privacy.contact.title">
                  Contact Information
                </Translatable>
              </h2>
              <p>
                <Translatable id="privacy.contact.p1">
                  {
                    'If you have any questions about this Privacy Policy or how we process your data, please contact us via the "Contact" page or the e-mail address provided there.'
                  }
                </Translatable>
              </p>
            </section>
          </div>
        </article>
      </div>
    </main>
  )
}
