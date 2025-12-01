import { Translatable } from "@/components/translatable";

export default function TermsOfUsePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <article className="rounded-3xl bg-white/80 shadow-sm border border-slate-100 px-4 py-8 sm:px-10 sm:py-10">
          <header className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              <Translatable>Terms of Use</Translatable>
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              <Translatable>Last Updated: November 2025</Translatable>
            </p>
          </header>

          <div className="space-y-8 text-[15px] leading-relaxed text-slate-800">
            {/* Acceptance of Terms */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Translatable>Acceptance of Terms</Translatable>
              </h2>
              <p>
                <Translatable>
                  {
                    "By accessing or using TurbotaAI's AI psychology services (the \"Service\"), you agree to be bound by these Terms of Use and all applicable laws and regulations. If you do not agree with any part of these Terms, you must not use the Service."
                  }
                </Translatable>
              </p>
              <p>
                <Translatable>
                  {
                    "These Terms constitute a legally binding agreement between you and the operator of TurbotaAI Psychology Services. Your continued use of the Service after we publish updates means that you accept the revised Terms."
                  }
                </Translatable>
              </p>
            </section>

            {/* Eligibility */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Translatable>Eligibility</Translatable>
              </h2>
              <p>
                <Translatable>
                  {"To use the Service, you confirm that you:"}
                </Translatable>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <Translatable>are at least 18 years of age;</Translatable>
                </li>
                <li>
                  <Translatable>
                    have the legal capacity to enter into a contract;
                  </Translatable>
                </li>
                <li>
                  <Translatable>
                    are not prohibited from using online services under any
                    applicable laws;
                  </Translatable>
                </li>
                <li>
                  <Translatable>
                    provide accurate and up-to-date information when requested
                    for registration or identification;
                  </Translatable>
                </li>
                <li>
                  <Translatable>
                    are responsible for maintaining the confidentiality of your
                    account credentials (if an account is created) and for all
                    activity that occurs under your account.
                  </Translatable>
                </li>
              </ul>
            </section>

            {/* Use of Services */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Translatable>Use of Services</Translatable>
              </h2>
              <p>
                <Translatable>
                  {
                    "TurbotaAI provides AI-based psychological support tools. The Service is not a medical facility and does not provide services that qualify as medical or psychiatric treatment."
                  }
                </Translatable>
              </p>
              <p>
                <Translatable>
                  {
                    "You agree to use the Service only for personal, non-commercial purposes, unless otherwise agreed with us in a separate written agreement. You must not:"
                  }
                </Translatable>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <Translatable>
                    copy, modify or distribute the Service;
                  </Translatable>
                </li>
                <li>
                  <Translatable>
                    attempt to gain unauthorized access to our systems or other
                    users' data;
                  </Translatable>
                </li>
                <li>
                  <Translatable>
                    use the Service to promote hate, harassment, self-harm or
                    harm to others;
                  </Translatable>
                </li>
                <li>
                  <Translatable>
                    use the Service in any way that may violate the law or the
                    rights of third parties.
                  </Translatable>
                </li>
              </ul>
              <p>
                <Translatable>
                  {
                    "The Service may be updated from time to time, and we may modify features, design or availability without prior notice."
                  }
                </Translatable>
              </p>
            </section>

            {/* User Responsibilities */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Translatable>User Responsibilities</Translatable>
              </h2>
              <p>
                <Translatable>
                  {
                    "You are responsible for the information you choose to share with the Service. Do not disclose data that you are not comfortable storing in digital form, unless otherwise stated in our Privacy Policy."
                  }
                </Translatable>
              </p>
              <p>
                <Translatable>
                  {
                    "You agree not to use the Service to send insults, threats, spam, advertising or any other unwanted or illegal content."
                  }
                </Translatable>
              </p>
              <p>
                <Translatable>
                  {
                    "If you violate these Terms, or if we reasonably believe that your behaviour may harm the Service or other users, we may temporarily restrict or terminate your access to the Service."
                  }
                </Translatable>
              </p>
            </section>

            {/* Payment and Billing */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Translatable>Payment and Billing</Translatable>
              </h2>
              <p>
                <Translatable>
                  {
                    "During the testing phase, some features of TurbotaAI may be provided free of charge or with limited access. Information about pricing, subscriptions and one-time sessions will be published separately in the Service interface and/or on the website."
                  }
                </Translatable>
              </p>
              <p>
                <Translatable>
                  {
                    "If you purchase a paid subscription or a one-time service, you agree to the applicable payment terms displayed on the pricing page. Payments may be processed via third-party payment providers."
                  }
                </Translatable>
              </p>
              <p>
                <Translatable>
                  {
                    "Refund conditions (if available) will be described in a separate section of the pricing page or in our refund policy. Please review these terms carefully before making a payment."
                  }
                </Translatable>
              </p>
            </section>

            {/* Limitation of Liability */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Translatable>Limitation of Liability</Translatable>
              </h2>
              <p>
                <Translatable>
                  {
                    'The TurbotaAI Service is provided "as is" without any express or implied warranties regarding its accuracy, completeness or fitness for your particular purposes. We aim to keep the Service stable but do not guarantee that it will be available without interruptions or errors.'
                  }
                </Translatable>
              </p>
              <p>
                <Translatable>
                  {
                    "TurbotaAI is not an emergency service and does not replace consultations with a doctor, psychiatrist or other licensed healthcare professional. If you are in danger or may harm yourself or others, you must immediately contact emergency services or a human specialist."
                  }
                </Translatable>
              </p>
              <p>
                <Translatable>
                  {
                    "To the maximum extent permitted by law, we shall not be liable for any direct, indirect, incidental, punitive or consequential damages arising out of or in connection with your use of, or inability to use, the Service."
                  }
                </Translatable>
              </p>
            </section>

            {/* Changes to Terms */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Translatable>Changes to Terms</Translatable>
              </h2>
              <p>
                <Translatable>
                  {
                    "We may update these Terms from time to time. The date of the latest update is indicated at the top of this page. In case of material changes, we may additionally notify you through the Service or by e-mail (if available)."
                  }
                </Translatable>
              </p>
              <p>
                <Translatable>
                  {
                    "By continuing to use the Service after the new Terms come into effect, you agree to the updated Terms. If you do not agree with the changes, you must stop using the Service."
                  }
                </Translatable>
              </p>
            </section>

            {/* Contact Information */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                <Translatable>Contact Information</Translatable>
              </h2>
              <p>
                <Translatable>
                  {
                    'If you have any questions about these Terms of Use, you can contact us via the contact form on the website or by using the e-mail address listed in the "Contact" section.'
                  }
                </Translatable>
              </p>
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}
