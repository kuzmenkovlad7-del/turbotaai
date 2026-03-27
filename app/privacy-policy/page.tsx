"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useLanguage } from "@/lib/i18n/language-context"
import { APP_SUPPORT_EMAIL } from "@/lib/app-config"

export default function PrivacyPolicyPage() {
  const { currentLanguage } = useLanguage()

  const lang = useMemo(() => {
    const code = String(currentLanguage?.code || "uk").toLowerCase()
    return code.startsWith("ru") ? "ru" : code.startsWith("en") ? "en" : "uk"
  }, [currentLanguage?.code])

  const copy = useMemo(() => {
    const c = {
      uk: {
        title: "Політика конфіденційності",
        updated: "Останнє оновлення: лютий 2026",
        infoTitle: "Інформація, яку ми збираємо",
        infoP1: "Ця Політика конфіденційності пояснює, яку інформацію TurbotaAI збирає, як ми її використовуємо та як захищаємо. Ми створюємо Сервіс з повагою до вашої приватності та особистих меж.",
        infoP2: "Використовуючи Сервіс, ви погоджуєтесь з умовами цієї Політики. Якщо ви не згодні — будь ласка, не використовуйте Сервіс.",
        personal: "1. Персональна та контактна інформація",
        personalIntro: "Ми можемо збирати наступну інформацію:",
        personalI1: "ваше імʼя або нікнейм, який ви надаєте;",
        personalI2: "електронна адреса, якщо ви надаєте її для контакту або реєстрації;",
        personalI3: "будь-яка інша інформація, яку ви добровільно надаєте у формах.",
        sessions: "2. Зміст сесій та повідомлення",
        sessionsIntro: "Коли ви використовуєте чат, голосового або відео-компаньйона, ми обробляємо зміст ваших повідомлень для генерації відповідей. Деякі дані можуть тимчасово зберігатися для:",
        sessionsI1: "підтримки історії розмов;",
        sessionsI2: "покращення якості відповідей компаньйона;",
        sessionsI3: "аналізу загальних закономірностей в анонімізованій формі.",
        tech: "3. Технічна інформація",
        techIntro: "Ми також можемо збирати технічні дані:",
        techI1: "IP-адреса та приблизне місцезнаходження;",
        techI2: "інформація про ваш пристрій, браузер та ОС;",
        techI3: "файли cookie, необхідні для роботи Сервісу та аналітики.",
        useTitle: "Як ми використовуємо вашу інформацію",
        useIntro: "Ми використовуємо зібрані дані для:",
        useI1: "надання доступу до чату, голосових та відео-сесій;",
        useI2: "адаптації відповідей компаньйона до вашого запиту та мови;",
        useI3: "підтримки Сервісу, діагностики та забезпечення безпеки;",
        useI4: "аналізу використання Сервісу;",
        useI5: "звʼязку з вами (відповіді на запити, сповіщення).",
        useNoSale: "Ми не продаємо ваші дані третім особам і не використовуємо зміст сесій для реклами.",
        payTitle: "Оплата та підписка",
        payP1: "При оформленні підписки ваші платіжні дані обробляються сертифікованим платіжним провайдером (WayForPay). TurbotaAI не зберігає дані вашої банківської картки.",
        payP2: "Ми зберігаємо інформацію про статус оплати, дату підписки та ідентифікатор замовлення для надання доступу.",
        payP3: "Повернення коштів обробляються через support@turbotaai.com.",
        secTitle: "Безпека даних",
        secP1: "Ми застосовуємо технічні та організаційні заходи безпеки для захисту даних від несанкціонованого доступу.",
        secP2: "Проте жодна онлайн-система не може гарантувати абсолютну безпеку.",
        retTitle: "Зберігання даних",
        retP1: "Ми зберігаємо дані лише стільки, скільки необхідно для цілей цієї Політики або відповідно до вимог закону.",
        retP2: "Історія розмов може бути видалена або анонімізована через певний час.",
        thirdTitle: "Сторонні сервіси",
        thirdP1: "Для роботи Сервісу ми можемо використовувати сторонніх провайдерів (хостинг, платіжні процесори, відео-платформи, ШІ-провайдери).",
        thirdP2: "Ці провайдери обробляють ваші дані від нашого імені та відповідно до наших інструкцій.",
        thirdP3: "Ваші дані іноді можуть передаватися за межі країни проживання з дотриманням чинного законодавства.",
        childTitle: "Конфіденційність дітей",
        childP1: "TurbotaAI не призначений для самостійного використання дітьми до 13 років.",
        childP2: "Якщо нам стане відомо про збір даних дитини без згоди, ми вживемо заходів для їх видалення.",
        rightsTitle: "Ваші права",
        rightsIntro: "Залежно від законодавства вашої країни, ви можете мати право:",
        rightsI1: "запитати інформацію про дані, які ми зберігаємо;",
        rightsI2: "попросити виправити неточну інформацію;",
        rightsI3: "вимагати видалення певних даних;",
        rightsI4: "заперечити або обмежити обробку;",
        rightsI5: "подати скаргу до органу нагляду.",
        rightsContact: "Для реалізації прав зверніться через форму зворотнього звʼязку або на email підтримки.",
        deleteTitle: "Видалення облікового запису",
        deleteP1: "Ви маєте право надіслати запит на видалення вашого облікового запису та персональних даних.",
        deleteWhat: "Після підтвердженого запиту ми видалимо: обліковий запис і профіль, повну історію розмов, ідентифікатор пристрою та токени доступу.",
        deleteRetain: "Записи про платежі зберігаються відповідно до фінансового законодавства. Голосові та відеодані не зберігаються — вони обробляються в реальному часі та одразу видаляються.",
        deleteHow: "Щоб видалити обліковий запис, надішліть запит на ",
        deleteHowB: " або перейдіть на ",
        deleteHowC: "сторінку видалення облікового запису",
        deleteHowD: ".",
        changesTitle: "Зміни до цієї Політики",
        changesP1: "Ми можемо оновлювати цю Політику. Дата оновлення вказана вгорі сторінки.",
        changesP2: "Продовжуючи використовувати Сервіс після змін, ви погоджуєтесь з оновленою Політикою.",
        contactTitle: "Контактна інформація",
        contactP1: "Питання щодо Політики: сторінка Контакти або support@turbotaai.com.",
      },
      ru: {
        title: "Политика конфиденциальности",
        updated: "Последнее обновление: февраль 2026",
        infoTitle: "Информация, которую мы собираем",
        infoP1: "Эта Политика конфиденциальности объясняет, какую информацию TurbotaAI собирает, как мы её используем и как защищаем. Мы создаём Сервис с уважением к вашей приватности.",
        infoP2: "Используя Сервис, вы соглашаетесь с условиями этой Политики. Если вы не согласны — не используйте Сервис.",
        personal: "1. Персональная и контактная информация",
        personalIntro: "Мы можем собирать следующую информацию:",
        personalI1: "ваше имя или никнейм;",
        personalI2: "email, если вы предоставляете его для контакта или регистрации;",
        personalI3: "любая другая информация из форм.",
        sessions: "2. Содержание сессий и сообщения",
        sessionsIntro: "Когда вы используете чат, голосового или видео-компаньона, мы обрабатываем содержание ваших сообщений для генерации ответов. Некоторые данные могут временно храниться для:",
        sessionsI1: "поддержки истории разговоров;",
        sessionsI2: "улучшения качества ответов компаньона;",
        sessionsI3: "анализа общих закономерностей в анонимизированной форме.",
        tech: "3. Техническая информация",
        techIntro: "Мы также можем собирать технические данные:",
        techI1: "IP-адрес и приблизительное местоположение;",
        techI2: "информация о вашем устройстве, браузере и ОС;",
        techI3: "файлы cookie, необходимые для работы Сервиса и аналитики.",
        useTitle: "Как мы используем вашу информацию",
        useIntro: "Мы используем данные для:",
        useI1: "предоставления доступа к чату, голосовым и видео-сессиям;",
        useI2: "адаптации ответов к вашему запросу и языку;",
        useI3: "поддержки Сервиса, диагностики и безопасности;",
        useI4: "анализа использования Сервиса;",
        useI5: "связи с вами (ответы на запросы, уведомления).",
        useNoSale: "Мы не продаём данные третьим лицам и не используем содержание сессий для рекламы.",
        payTitle: "Оплата и подписка",
        payP1: "При оформлении подписки платёжные данные обрабатываются сертифицированным провайдером (WayForPay). TurbotaAI не хранит данные карты.",
        payP2: "Мы храним статус оплаты, дату подписки и ID заказа для предоставления доступа.",
        payP3: "Возврат средств — через support@turbotaai.com.",
        secTitle: "Безопасность данных",
        secP1: "Мы применяем технические и организационные меры для защиты данных от несанкционированного доступа.",
        secP2: "Однако ни одна система не гарантирует абсолютную безопасность.",
        retTitle: "Хранение данных",
        retP1: "Мы храним данные только столько, сколько необходимо для целей этой Политики или по закону.",
        retP2: "История разговоров может быть удалена или анонимизирована.",
        thirdTitle: "Сторонние сервисы",
        thirdP1: "Мы используем сторонних провайдеров (хостинг, платёжные процессоры, видео-платформы, ИИ-провайдеры).",
        thirdP2: "Они обрабатывают данные от нашего имени по нашим инструкциям.",
        thirdP3: "Данные могут передаваться за пределы вашей страны с соблюдением законодательства.",
        childTitle: "Конфиденциальность детей",
        childP1: "TurbotaAI не предназначен для детей до 13 лет.",
        childP2: "Если мы узнаем о сборе данных ребёнка без согласия, мы удалим их.",
        rightsTitle: "Ваши права",
        rightsIntro: "В зависимости от законодательства, вы можете:",
        rightsI1: "запросить информацию о хранимых данных;",
        rightsI2: "исправить неточную информацию;",
        rightsI3: "потребовать удаления данных;",
        rightsI4: "ограничить обработку;",
        rightsI5: "подать жалобу в надзорный орган.",
        rightsContact: "Для реализации прав — форма обратной связи или email поддержки.",
        deleteTitle: "Удаление учётной записи",
        deleteP1: "Вы вправе подать запрос на удаление учётной записи и персональных данных.",
        deleteWhat: "После подтверждённого запроса мы удалим: учётную запись и профиль, полную историю разговоров, идентификатор устройства и токены доступа.",
        deleteRetain: "Платёжные записи хранятся по финансовому законодательству. Голосовые и видеоданные не хранятся — они обрабатываются в реальном времени и немедленно удаляются.",
        deleteHow: "Для удаления учётной записи отправьте запрос на ",
        deleteHowB: " или перейдите на ",
        deleteHowC: "страницу удаления учётной записи",
        deleteHowD: ".",
        changesTitle: "Изменения Политики",
        changesP1: "Мы можем обновлять Политику. Дата обновления — вверху страницы.",
        changesP2: "Продолжая использовать Сервис после изменений, вы соглашаетесь с обновлённой Политикой.",
        contactTitle: "Контактная информация",
        contactP1: "Вопросы: страница Контакты или support@turbotaai.com.",
      },
      en: {
        title: "Privacy Policy",
        updated: "Last Updated: February 2026",
        infoTitle: "Information We Collect",
        infoP1: "This Privacy Policy explains what information TurbotaAI collects, how we use it and how we protect it. We design the Service to respect your privacy and personal boundaries.",
        infoP2: "By using the Service, you agree to the terms of this Policy. If you do not agree, please do not use the Service.",
        personal: "1. Personal and contact information",
        personalIntro: "We may collect the following information:",
        personalI1: "your name or nickname that you provide;",
        personalI2: "e-mail address if you submit it for contact or registration;",
        personalI3: "any other information you voluntarily provide in forms.",
        sessions: "2. Session content and messages",
        sessionsIntro: "When you use the chat, voice or video companion, we process the content of your messages to generate responses. Some data may be temporarily stored to:",
        sessionsI1: "maintain a conversation history;",
        sessionsI2: "improve the quality of the companion's replies;",
        sessionsI3: "analyse common patterns in anonymised form.",
        tech: "3. Technical information",
        techIntro: "We may also collect technical data:",
        techI1: "IP address and approximate location;",
        techI2: "information about your device, browser and OS;",
        techI3: "cookies required for the Service and analytics.",
        useTitle: "How We Use Your Information",
        useIntro: "We use the collected data for:",
        useI1: "providing access to chat, voice and video sessions;",
        useI2: "adapting the companion's responses to your request and language;",
        useI3: "maintaining the Service, diagnosing errors and ensuring security;",
        useI4: "analysing how the Service is used;",
        useI5: "communicating with you (responses, notifications).",
        useNoSale: "We do not sell your data to third parties and do not use session content for advertising.",
        payTitle: "Payment and Subscription",
        payP1: "When you subscribe, your payment details are processed by a certified payment provider (WayForPay). TurbotaAI does not store your bank card details.",
        payP2: "We store payment status, subscription date and order ID to provide access.",
        payP3: "Refunds are handled via support@turbotaai.com.",
        secTitle: "Data Security",
        secP1: "We apply technical and organisational measures to protect data from unauthorised access.",
        secP2: "No online system can guarantee absolute security.",
        retTitle: "Data Retention",
        retP1: "We retain data only as long as necessary for the purposes of this Policy or as required by law.",
        retP2: "Conversation history may be deleted or anonymised after a certain period.",
        thirdTitle: "Third-Party Services",
        thirdP1: "We may use third-party providers (hosting, payment processors, video platforms, AI model providers).",
        thirdP2: "They process your data on our behalf per our instructions.",
        thirdP3: "Your data may be transferred outside your country in compliance with applicable laws.",
        childTitle: "Children's Privacy",
        childP1: "TurbotaAI is not intended for children under 13.",
        childP2: "If we learn of data collected from a child without consent, we will delete it.",
        rightsTitle: "Your Rights",
        rightsIntro: "Depending on your country's laws, you may:",
        rightsI1: "request information about the data we hold;",
        rightsI2: "ask us to correct inaccurate information;",
        rightsI3: "request deletion of certain data;",
        rightsI4: "restrict certain types of processing;",
        rightsI5: "lodge a complaint with a supervisory authority.",
        rightsContact: "To exercise your rights, contact us via feedback form or support email.",
        deleteTitle: "Account Deletion",
        deleteP1: "You have the right to request deletion of your account and personal data.",
        deleteWhat: "Upon a confirmed request we will delete: your account and profile, your full conversation history, device identifier and access tokens.",
        deleteRetain: "Payment records are retained as required by financial law. Voice and video data are never stored — they are processed in real time and discarded immediately.",
        deleteHow: "To delete your account, send a request to ",
        deleteHowB: " or visit the ",
        deleteHowC: "account deletion page",
        deleteHowD: ".",
        changesTitle: "Changes to This Policy",
        changesP1: "We may update this Policy. The update date is at the top of this page.",
        changesP2: "By continuing to use the Service after changes, you agree to the updated Policy.",
        contactTitle: "Contact Information",
        contactP1: "Questions: Contact page or support@turbotaai.com.",
      },
    }
    return c[lang as "uk" | "ru" | "en"]
  }, [lang])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <article className="rounded-3xl bg-white/80 shadow-sm border border-slate-100 px-4 py-8 sm:px-10 sm:py-10">
          <header className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{copy.title}</h1>
            <p className="mt-2 text-sm text-slate-500">{copy.updated}</p>
          </header>

          <div className="space-y-8 text-[15px] leading-relaxed text-slate-800">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{copy.infoTitle}</h2>
              <p>{copy.infoP1}</p>
              <p>{copy.infoP2}</p>
              <h3 className="font-semibold">{copy.personal}</h3>
              <p>{copy.personalIntro}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{copy.personalI1}</li>
                <li>{copy.personalI2}</li>
                <li>{copy.personalI3}</li>
              </ul>
              <h3 className="font-semibold">{copy.sessions}</h3>
              <p>{copy.sessionsIntro}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{copy.sessionsI1}</li>
                <li>{copy.sessionsI2}</li>
                <li>{copy.sessionsI3}</li>
              </ul>
              <h3 className="font-semibold">{copy.tech}</h3>
              <p>{copy.techIntro}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{copy.techI1}</li>
                <li>{copy.techI2}</li>
                <li>{copy.techI3}</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{copy.useTitle}</h2>
              <p>{copy.useIntro}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{copy.useI1}</li>
                <li>{copy.useI2}</li>
                <li>{copy.useI3}</li>
                <li>{copy.useI4}</li>
                <li>{copy.useI5}</li>
              </ul>
              <p>{copy.useNoSale}</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{copy.payTitle}</h2>
              <p>{copy.payP1}</p>
              <p>{copy.payP2}</p>
              <p>{copy.payP3}</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{copy.secTitle}</h2>
              <p>{copy.secP1}</p>
              <p>{copy.secP2}</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{copy.retTitle}</h2>
              <p>{copy.retP1}</p>
              <p>{copy.retP2}</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{copy.thirdTitle}</h2>
              <p>{copy.thirdP1}</p>
              <p>{copy.thirdP2}</p>
              <p>{copy.thirdP3}</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{copy.childTitle}</h2>
              <p>{copy.childP1}</p>
              <p>{copy.childP2}</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{copy.rightsTitle}</h2>
              <p>{copy.rightsIntro}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{copy.rightsI1}</li>
                <li>{copy.rightsI2}</li>
                <li>{copy.rightsI3}</li>
                <li>{copy.rightsI4}</li>
                <li>{copy.rightsI5}</li>
              </ul>
              <p>{copy.rightsContact}</p>
            </section>

            <section id="delete-account" className="space-y-3 scroll-mt-8">
              <h2 className="text-xl font-semibold">{copy.deleteTitle}</h2>
              <p>{copy.deleteP1}</p>
              <p>{copy.deleteWhat}</p>
              <p>{copy.deleteRetain}</p>
              <p>
                {copy.deleteHow}
                <a
                  href={`mailto:${APP_SUPPORT_EMAIL}`}
                  className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900"
                >
                  {APP_SUPPORT_EMAIL}
                </a>
                {copy.deleteHowB}
                <Link
                  href="/delete-account"
                  className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900"
                >
                  {copy.deleteHowC}
                </Link>
                {copy.deleteHowD}
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{copy.changesTitle}</h2>
              <p>{copy.changesP1}</p>
              <p>{copy.changesP2}</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{copy.contactTitle}</h2>
              <p>{copy.contactP1}</p>
            </section>
          </div>
        </article>
      </div>
    </main>
  )
}
