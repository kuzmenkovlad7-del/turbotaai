"use client"

import React, { useMemo } from "react"
import { useLanguage } from "@/lib/i18n/language-context"

const copy = {
  title: {
    uk: "Умови використання",
    ru: "Условия использования",
    en: "Terms of Use",
  },
  lastUpdated: {
    uk: "Останнє оновлення: лютий 2026",
    ru: "Последнее обновление: февраль 2026",
    en: "Last Updated: February 2026",
  },

  /* ── Acceptance of Terms ── */
  acceptanceTitle: {
    uk: "Прийняття умов",
    ru: "Принятие условий",
    en: "Acceptance of Terms",
  },
  acceptanceP1: {
    uk: 'Отримуючи доступ або використовуючи психологічні послуги TurbotaAI на базі ШІ ("Сервіс"), ви погоджуєтесь дотримуватися цих Умов використання та всіх чинних законів і нормативних актів. Якщо ви не згодні з будь-якою частиною цих Умов, ви не маєте права користуватися Сервісом.',
    ru: 'Получая доступ или используя психологические услуги TurbotaAI на базе ИИ ("Сервис"), вы соглашаетесь соблюдать настоящие Условия использования, а также все применимые законы и нормативные акты. Если вы не согласны с какой-либо частью настоящих Условий, вы не должны использовать Сервис.',
    en: 'By accessing or using TurbotaAI AI psychology services (the "Service"), you agree to be bound by these Terms of Use and all applicable laws and regulations. If you do not agree with any part of these Terms, you must not use the Service.',
  },
  acceptanceP2: {
    uk: "Ці Умови є юридично обов\u2019язковою угодою між вами та оператором TurbotaAI Psychology Services. Продовження використання Сервісу після публікації оновлень означає, що ви приймаєте переглянуті Умови.",
    ru: "Настоящие Условия являются юридически обязывающим соглашением между вами и оператором TurbotaAI Psychology Services. Продолжение использования Сервиса после публикации обновлений означает, что вы принимаете обновлённые Условия.",
    en: "These Terms constitute a legally binding agreement between you and the operator of TurbotaAI Psychology Services. Your continued use of the Service after we publish updates means that you accept the revised Terms.",
  },

  /* ── Eligibility ── */
  eligibilityTitle: {
    uk: "Право на використання",
    ru: "Право на использование",
    en: "Eligibility",
  },
  eligibilityIntro: {
    uk: "Для використання Сервісу ви підтверджуєте, що:",
    ru: "Для использования Сервиса вы подтверждаете, что:",
    en: "To use the Service, you confirm that you:",
  },
  eligibilityAge: {
    uk: "вам виповнилося щонайменше 18 років;",
    ru: "вам исполнилось не менее 18 лет;",
    en: "are at least 18 years of age;",
  },
  eligibilityCapacity: {
    uk: "ви маєте правоздатність для укладення договору;",
    ru: "вы обладаете правоспособностью для заключения договора;",
    en: "have the legal capacity to enter into a contract;",
  },
  eligibilityLaws: {
    uk: "вам не заборонено користуватися онлайн-сервісами згідно з чинним законодавством;",
    ru: "вам не запрещено пользоваться онлайн-сервисами в соответствии с действующим законодательством;",
    en: "are not prohibited from using online services under any applicable laws;",
  },
  eligibilityAccurate: {
    uk: "ви надаєте точну та актуальну інформацію, коли це вимагається для реєстрації чи ідентифікації;",
    ru: "вы предоставляете точную и актуальную информацию, когда это требуется для регистрации или идентификации;",
    en: "provide accurate and up-to-date information when requested for registration or identification;",
  },
  eligibilityAccount: {
    uk: "ви несете відповідальність за збереження конфіденційності облікових даних (якщо обліковий запис створено) та за всю активність у вашому обліковому записі.",
    ru: "вы несёте ответственность за сохранение конфиденциальности учётных данных (если учётная запись создана) и за всю активность в вашей учётной записи.",
    en: "are responsible for maintaining the confidentiality of your account credentials (if an account is created) and for all activity that occurs under your account.",
  },

  /* ── Use of Services ── */
  useTitle: {
    uk: "Використання Сервісу",
    ru: "Использование Сервиса",
    en: "Use of Services",
  },
  useP1: {
    uk: "TurbotaAI надає інструменти психологічної підтримки на основі ШІ. Сервіс не є медичним закладом і не надає послуг, які кваліфікуються як медичне чи психіатричне лікування.",
    ru: "TurbotaAI предоставляет инструменты психологической поддержки на основе ИИ. Сервис не является медицинским учреждением и не оказывает услуг, квалифицируемых как медицинское или психиатрическое лечение.",
    en: "TurbotaAI provides AI-based psychological support tools. The Service is not a medical facility and does not provide services that qualify as medical or psychiatric treatment.",
  },
  useP2: {
    uk: "Ви погоджуєтесь використовувати Сервіс лише в особистих, некомерційних цілях, якщо інше не погоджено з нами в окремій письмовій угоді. Ви не маєте права:",
    ru: "Вы соглашаетесь использовать Сервис только в личных, некоммерческих целях, если иное не согласовано с нами в отдельном письменном соглашении. Вы не имеете права:",
    en: "You agree to use the Service only for personal, non-commercial purposes, unless otherwise agreed with us in a separate written agreement. You must not:",
  },
  useCopy: {
    uk: "копіювати, модифікувати або розповсюджувати Сервіс;",
    ru: "копировать, модифицировать или распространять Сервис;",
    en: "copy, modify or distribute the Service;",
  },
  useUnauthorized: {
    uk: "намагатися отримати несанкціонований доступ до наших систем або даних інших користувачів;",
    ru: "пытаться получить несанкционированный доступ к нашим системам или данным других пользователей;",
    en: "attempt to gain unauthorized access to our systems or other users\u2019 data;",
  },
  useHate: {
    uk: "використовувати Сервіс для пропаганди ненависті, переслідування, самоушкодження або шкоди іншим;",
    ru: "использовать Сервис для пропаганды ненависти, преследования, самоповреждения или причинения вреда другим;",
    en: "use the Service to promote hate, harassment, self-harm or harm to others;",
  },
  useIllegal: {
    uk: "використовувати Сервіс у будь-який спосіб, що може порушити закон або права третіх осіб.",
    ru: "использовать Сервис любым способом, который может нарушить закон или права третьих лиц.",
    en: "use the Service in any way that may violate the law or the rights of third parties.",
  },
  useUpdates: {
    uk: "Сервіс може час від часу оновлюватись, і ми можемо змінювати функції, дизайн або доступність без попереднього повідомлення.",
    ru: "Сервис может время от времени обновляться, и мы можем изменять функции, дизайн или доступность без предварительного уведомления.",
    en: "The Service may be updated from time to time, and we may modify features, design or availability without prior notice.",
  },

  /* ── User Responsibilities ── */
  responsibilitiesTitle: {
    uk: "Відповідальність користувача",
    ru: "Ответственность пользователя",
    en: "User Responsibilities",
  },
  responsibilitiesP1: {
    uk: "Ви несете відповідальність за інформацію, яку ви вирішите повідомити Сервісу. Не розкривайте дані, зберігання яких у цифровій формі вас не влаштовує, якщо інше не зазначено в нашій Політиці конфіденційності.",
    ru: "Вы несёте ответственность за информацию, которую решите сообщить Сервису. Не раскрывайте данные, хранение которых в цифровой форме вас не устраивает, если иное не указано в нашей Политике конфиденциальности.",
    en: "You are responsible for the information you choose to share with the Service. Do not disclose data that you are not comfortable storing in digital form, unless otherwise stated in our Privacy Policy.",
  },
  responsibilitiesP2: {
    uk: "Ви зобов\u2019язуєтесь не використовувати Сервіс для надсилання образ, погроз, спаму, реклами або будь-якого іншого небажаного чи незаконного контенту.",
    ru: "Вы обязуетесь не использовать Сервис для отправки оскорблений, угроз, спама, рекламы или любого другого нежелательного или незаконного контента.",
    en: "You agree not to use the Service to send insults, threats, spam, advertising or any other unwanted or illegal content.",
  },
  responsibilitiesP3: {
    uk: "Якщо ви порушите ці Умови або якщо ми обґрунтовано вважатимемо, що ваша поведінка може завдати шкоди Сервісу чи іншим користувачам, ми можемо тимчасово обмежити або припинити ваш доступ до Сервісу.",
    ru: "Если вы нарушите настоящие Условия или если мы обоснованно посчитаем, что ваше поведение может нанести ущерб Сервису или другим пользователям, мы можем временно ограничить или прекратить ваш доступ к Сервису.",
    en: "If you violate these Terms, or if we reasonably believe that your behaviour may harm the Service or other users, we may temporarily restrict or terminate your access to the Service.",
  },

  /* ── Payment and Subscription ── */
  paymentTitle: {
    uk: "Оплата та підписка",
    ru: "Оплата и подписка",
    en: "Payment and Subscription",
  },
  paymentP1: {
    uk: "TurbotaAI працює за моделлю щомісячної підписки. Платежі обробляються через платіжну систему WayForPay — ліцензованого оператора платіжних послуг.",
    ru: "TurbotaAI работает по модели ежемесячной подписки. Платежи обрабатываются через платёжную систему WayForPay — лицензированного оператора платёжных услуг.",
    en: "TurbotaAI operates on a monthly subscription model. Payments are processed through WayForPay — a licensed payment service provider.",
  },
  paymentP2: {
    uk: "Ви можете скасувати підписку в будь-який момент. Після скасування ваш доступ до платних функцій зберігатиметься до кінця поточного оплаченого періоду. Автоматичне списання за наступний період не відбудеться.",
    ru: "Вы можете отменить подписку в любой момент. После отмены ваш доступ к платным функциям сохранится до конца текущего оплаченного периода. Автоматическое списание за следующий период не произойдёт.",
    en: "You can cancel your subscription at any time. After cancellation, your access to paid features will remain active until the end of the current billing period. No further charges will be made.",
  },
  paymentP3: {
    uk: "Якщо ви вважаєте, що маєте право на повернення коштів, зверніться до нашої служби підтримки за адресою support@turbotaai.com. Кожен запит розглядається індивідуально.",
    ru: "Если вы считаете, что имеете право на возврат средств, обратитесь в нашу службу поддержки по адресу support@turbotaai.com. Каждый запрос рассматривается индивидуально.",
    en: "If you believe you are entitled to a refund, please contact our support team at support@turbotaai.com. Each request is reviewed on a case-by-case basis.",
  },
  paymentP4: {
    uk: "TurbotaAI не зберігає дані вашої банківської картки. Вся платіжна інформація обробляється та зберігається виключно на стороні WayForPay відповідно до стандартів безпеки PCI DSS.",
    ru: "TurbotaAI не хранит данные вашей банковской карты. Вся платёжная информация обрабатывается и хранится исключительно на стороне WayForPay в соответствии со стандартами безопасности PCI DSS.",
    en: "TurbotaAI does not store your card data. All payment information is processed and stored exclusively by WayForPay in accordance with PCI DSS security standards.",
  },

  /* ── Limitation of Liability ── */
  liabilityTitle: {
    uk: "Обмеження відповідальності",
    ru: "Ограничение ответственности",
    en: "Limitation of Liability",
  },
  liabilityP1: {
    uk: 'Сервіс TurbotaAI надається "як є" без будь-яких явних чи неявних гарантій щодо його точності, повноти або придатності для ваших конкретних цілей. Ми прагнемо підтримувати стабільність Сервісу, але не гарантуємо його безперебійну роботу без помилок.',
    ru: 'Сервис TurbotaAI предоставляется "как есть" без каких-либо явных или подразумеваемых гарантий относительно его точности, полноты или пригодности для ваших конкретных целей. Мы стремимся поддерживать стабильность Сервиса, но не гарантируем его бесперебойную работу без ошибок.',
    en: 'The TurbotaAI Service is provided "as is" without any express or implied warranties regarding its accuracy, completeness or fitness for your particular purposes. We aim to keep the Service stable but do not guarantee that it will be available without interruptions or errors.',
  },
  liabilityP2: {
    uk: "TurbotaAI не є службою екстреної допомоги та не замінює консультації лікаря, психіатра чи іншого ліцензованого медичного фахівця. Якщо вам загрожує небезпека або ви можете завдати шкоди собі чи іншим, негайно зверніться до служби екстреної допомоги або до спеціаліста.",
    ru: "TurbotaAI не является службой экстренной помощи и не заменяет консультации врача, психиатра или другого лицензированного медицинского специалиста. Если вам угрожает опасность или вы можете причинить вред себе или другим, немедленно обратитесь в службу экстренной помощи или к специалисту.",
    en: "TurbotaAI is not an emergency service and does not replace consultations with a doctor, psychiatrist or other licensed healthcare professional. If you are in danger or may harm yourself or others, you must immediately contact emergency services or a human specialist.",
  },
  liabilityP3: {
    uk: "У максимальному обсязі, дозволеному законом, ми не несемо відповідальності за будь-які прямі, непрямі, випадкові, штрафні або побічні збитки, що виникають у зв\u2019язку з використанням або неможливістю використання Сервісу.",
    ru: "В максимальной степени, допускаемой законом, мы не несём ответственности за любые прямые, косвенные, случайные, штрафные или побочные убытки, возникающие в связи с использованием или невозможностью использования Сервиса.",
    en: "To the maximum extent permitted by law, we shall not be liable for any direct, indirect, incidental, punitive or consequential damages arising out of or in connection with your use of, or inability to use, the Service.",
  },

  /* ── Changes to Terms ── */
  changesTitle: {
    uk: "Зміни до Умов",
    ru: "Изменения Условий",
    en: "Changes to Terms",
  },
  changesP1: {
    uk: "Ми можемо час від часу оновлювати ці Умови. Дата останнього оновлення зазначена у верхній частині цієї сторінки. У разі суттєвих змін ми можемо додатково повідомити вас через Сервіс або електронною поштою (якщо доступно).",
    ru: "Мы можем время от времени обновлять настоящие Условия. Дата последнего обновления указана в верхней части этой страницы. В случае существенных изменений мы можем дополнительно уведомить вас через Сервис или по электронной почте (если доступно).",
    en: "We may update these Terms from time to time. The date of the latest update is indicated at the top of this page. In case of material changes, we may additionally notify you through the Service or by e-mail (if available).",
  },
  changesP2: {
    uk: "Продовжуючи використовувати Сервіс після набрання чинності нових Умов, ви погоджуєтесь з оновленими Умовами. Якщо ви не згодні зі змінами, ви повинні припинити використання Сервісу.",
    ru: "Продолжая использовать Сервис после вступления в силу новых Условий, вы соглашаетесь с обновлёнными Условиями. Если вы не согласны с изменениями, вы должны прекратить использование Сервиса.",
    en: "By continuing to use the Service after the new Terms come into effect, you agree to the updated Terms. If you do not agree with the changes, you must stop using the Service.",
  },

  /* ── Contact Information ── */
  contactTitle: {
    uk: "Контактна інформація",
    ru: "Контактная информация",
    en: "Contact Information",
  },
  contactP1: {
    uk: "Якщо у вас є запитання щодо цих Умов використання, ви можете зв\u2019язатися з нами через контактну форму на сайті або за електронною адресою, зазначеною в розділі Контакти.",
    ru: "Если у вас есть вопросы относительно настоящих Условий использования, вы можете связаться с нами через контактную форму на сайте или по электронной почте, указанной в разделе Контакты.",
    en: "If you have any questions about these Terms of Use, you can contact us via the contact form on the website or by using the e-mail address listed in the Contact section.",
  },
} as const

type Lang = "uk" | "ru" | "en"

export default function TermsOfUsePage() {
  const { currentLanguage } = useLanguage()

  const lang = useMemo<Lang>(() => {
    const code = currentLanguage.code
    return code.startsWith("ru") ? "ru" : code.startsWith("en") ? "en" : "uk"
  }, [currentLanguage.code])

  const t = (key: keyof typeof copy) => copy[key][lang]

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <article className="rounded-3xl bg-white/80 shadow-sm border border-slate-100 px-4 py-8 sm:px-10 sm:py-10">
          <header className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {t("lastUpdated")}
            </p>
          </header>

          <div className="space-y-8 text-[15px] leading-relaxed text-slate-800">
            {/* Acceptance of Terms */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{t("acceptanceTitle")}</h2>
              <p>{t("acceptanceP1")}</p>
              <p>{t("acceptanceP2")}</p>
            </section>

            {/* Eligibility */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{t("eligibilityTitle")}</h2>
              <p>{t("eligibilityIntro")}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t("eligibilityAge")}</li>
                <li>{t("eligibilityCapacity")}</li>
                <li>{t("eligibilityLaws")}</li>
                <li>{t("eligibilityAccurate")}</li>
                <li>{t("eligibilityAccount")}</li>
              </ul>
            </section>

            {/* Use of Services */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{t("useTitle")}</h2>
              <p>{t("useP1")}</p>
              <p>{t("useP2")}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t("useCopy")}</li>
                <li>{t("useUnauthorized")}</li>
                <li>{t("useHate")}</li>
                <li>{t("useIllegal")}</li>
              </ul>
              <p>{t("useUpdates")}</p>
            </section>

            {/* User Responsibilities */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{t("responsibilitiesTitle")}</h2>
              <p>{t("responsibilitiesP1")}</p>
              <p>{t("responsibilitiesP2")}</p>
              <p>{t("responsibilitiesP3")}</p>
            </section>

            {/* Payment and Subscription */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{t("paymentTitle")}</h2>
              <p>{t("paymentP1")}</p>
              <p>{t("paymentP2")}</p>
              <p>{t("paymentP3")}</p>
              <p>{t("paymentP4")}</p>
            </section>

            {/* Limitation of Liability */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{t("liabilityTitle")}</h2>
              <p>{t("liabilityP1")}</p>
              <p>{t("liabilityP2")}</p>
              <p>{t("liabilityP3")}</p>
            </section>

            {/* Changes to Terms */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{t("changesTitle")}</h2>
              <p>{t("changesP1")}</p>
              <p>{t("changesP2")}</p>
            </section>

            {/* Contact Information */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{t("contactTitle")}</h2>
              <p>{t("contactP1")}</p>
            </section>
          </div>
        </article>
      </div>
    </main>
  )
}
