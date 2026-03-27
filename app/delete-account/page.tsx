"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useLanguage } from "@/lib/i18n/language-context"
import { APP_SUPPORT_EMAIL } from "@/lib/app-config"

export default function DeleteAccountPage() {
  const { currentLanguage } = useLanguage()

  const lang = useMemo(() => {
    const code = String(currentLanguage?.code || "uk").toLowerCase()
    return code.startsWith("ru") ? "ru" : code.startsWith("en") ? "en" : "uk"
  }, [currentLanguage?.code])

  const copy = useMemo(() => {
    const c = {
      uk: {
        title: "Видалення облікового запису",
        updated: "Останнє оновлення: березень 2026",
        intro:
          "Ця сторінка пояснює, як подати запит на видалення вашого облікового запису та пов'язаних даних у TurbotaAI.",

        howTitle: "Як подати запит на видалення",
        howP1:
          "Оскільки TurbotaAI є мобільним застосунком, повне видалення облікового запису виконується командою підтримки. Функція самостійного видалення через застосунок не реалізована — будь ласка, надішліть запит електронною поштою.",
        howStep1: "Надішліть листа на ",
        howStep1b: " із заголовком «Видалення облікового запису».",
        howStep2: "Вкажіть адресу електронної пошти, яка прив'язана до вашого облікового запису.",
        howStep3:
          "Наша команда обробить ваш запит і підтвердить видалення протягом 30 днів.",
        howNote:
          "Ви можете також написати нам через сторінку Контактів на сайті.",

        whatTitle: "Які дані будуть видалені",
        whatIntro: "Після підтвердженого запиту ми видалимо:",
        whatI1: "ваш обліковий запис і профіль (ім'я, email);",
        whatI2: "повну історію розмов (чат, голосові та відео-сесії);",
        whatI3: "ідентифікатор пристрою (device hash) та токени доступу.",

        retainTitle: "Які дані ми зберігаємо після видалення",
        retainIntro:
          "Деякі дані зберігаються відповідно до вимог законодавства та облікових зобов'язань:",
        retainI1:
          "записи про платежі та транзакції (обов'язково за фінансовим законодавством — мінімум 5 років);",
        retainI2:
          "агреговані анонімні статистичні дані, що не ідентифікують особу.",
        retainNote:
          "Голосові та відеозаписи не зберігаються. Аудіо та відео обробляються виключно в режимі реального часу для розпізнавання мовлення і негайно видаляються після обробки.",

        timelineTitle: "Терміни видалення",
        timelineP1:
          "Ми обробимо ваш запит та підтвердимо видалення протягом 30 днів після отримання підтвердженого email-запиту.",

        partialTitle: "Часткове видалення даних",
        partialP1:
          "Ми не надаємо самостійного часткового видалення окремих повідомлень або сесій. За запитом ми можемо видалити всю вашу розмову. Записи про виставлення рахунків не підлягають видаленню через юридичні вимоги.",

        privacyLink: "← Назад до Політики конфіденційності",
        contactTitle: "Контактна інформація",
        contactP1: "Запити на видалення та будь-які питання щодо конфіденційності: ",
      },
      ru: {
        title: "Удаление учётной записи",
        updated: "Последнее обновление: март 2026",
        intro:
          "Эта страница объясняет, как подать запрос на удаление учётной записи и связанных данных в TurbotaAI.",

        howTitle: "Как подать запрос на удаление",
        howP1:
          "Поскольку TurbotaAI — мобильное приложение, полное удаление учётной записи выполняется командой поддержки. Функция самостоятельного удаления через приложение не реализована — пожалуйста, отправьте запрос по электронной почте.",
        howStep1: "Отправьте письмо на ",
        howStep1b: " с темой «Удаление учётной записи».",
        howStep2: "Укажите адрес электронной почты, привязанный к вашей учётной записи.",
        howStep3:
          "Наша команда обработает запрос и подтвердит удаление в течение 30 дней.",
        howNote:
          "Также можно написать нам через страницу Контактов на сайте.",

        whatTitle: "Какие данные будут удалены",
        whatIntro: "После подтверждённого запроса мы удалим:",
        whatI1: "вашу учётную запись и профиль (имя, email);",
        whatI2: "полную историю разговоров (чат, голосовые и видео-сессии);",
        whatI3: "идентификатор устройства (device hash) и токены доступа.",

        retainTitle: "Какие данные мы храним после удаления",
        retainIntro:
          "Некоторые данные хранятся в соответствии с законодательством и учётными обязательствами:",
        retainI1:
          "записи о платежах и транзакциях (обязательно по финансовому законодательству — минимум 5 лет);",
        retainI2:
          "агрегированные анонимные статистические данные, не идентифицирующие личность.",
        retainNote:
          "Голосовые и видеозаписи не хранятся. Аудио и видео обрабатываются исключительно в режиме реального времени для распознавания речи и немедленно удаляются после обработки.",

        timelineTitle: "Сроки удаления",
        timelineP1:
          "Мы обработаем запрос и подтвердим удаление в течение 30 дней после получения подтверждённого email-запроса.",

        partialTitle: "Частичное удаление данных",
        partialP1:
          "Самостоятельное частичное удаление отдельных сообщений или сессий недоступно. По запросу мы можем удалить весь ваш разговор. Записи о выставлении счетов не подлежат удалению по юридическим требованиям.",

        privacyLink: "← Назад к Политике конфиденциальности",
        contactTitle: "Контактная информация",
        contactP1: "Запросы на удаление и вопросы о конфиденциальности: ",
      },
      en: {
        title: "Account Deletion",
        updated: "Last Updated: March 2026",
        intro:
          "This page explains how to request deletion of your TurbotaAI account and associated data.",

        howTitle: "How to Request Account Deletion",
        howP1:
          "Because TurbotaAI is a mobile application, full account deletion is handled by our support team. In-app self-deletion is not available — please submit your request by email.",
        howStep1: "Send an email to ",
        howStep1b: " with the subject line \"Account Deletion Request\".",
        howStep2: "Include the email address associated with your account.",
        howStep3:
          "Our team will process your request and confirm deletion within 30 days.",
        howNote:
          "You may also contact us via the Contact page on the website.",

        whatTitle: "Data That Will Be Deleted",
        whatIntro: "Upon a confirmed request, we will delete:",
        whatI1: "your account and profile (name, email address);",
        whatI2: "your full conversation history (chat, voice and video sessions);",
        whatI3: "device identifier (device hash) and access tokens.",

        retainTitle: "Data We Retain After Deletion",
        retainIntro:
          "Some data is retained in accordance with legal and accounting obligations:",
        retainI1:
          "payment and transaction records (required by financial law — minimum 5 years);",
        retainI2:
          "aggregated, anonymised statistical data that does not identify you.",
        retainNote:
          "Voice and video recordings are never stored. Audio and video are processed in real time for speech recognition only and are discarded immediately after processing.",

        timelineTitle: "Deletion Timeline",
        timelineP1:
          "We will process your request and confirm deletion within 30 days of receiving a verified email request.",

        partialTitle: "Partial Data Deletion",
        partialP1:
          "Self-service partial deletion of individual messages or sessions is not available. Upon request we can delete your full conversation history. Billing records cannot be deleted due to legal requirements.",

        privacyLink: "← Back to Privacy Policy",
        contactTitle: "Contact Information",
        contactP1: "Deletion requests and privacy questions: ",
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
              <p>{copy.intro}</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{copy.howTitle}</h2>
              <p>{copy.howP1}</p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  {copy.howStep1}
                  <a
                    href={`mailto:${APP_SUPPORT_EMAIL}`}
                    className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900"
                  >
                    {APP_SUPPORT_EMAIL}
                  </a>
                  {copy.howStep1b}
                </li>
                <li>{copy.howStep2}</li>
                <li>{copy.howStep3}</li>
              </ol>
              <p className="text-slate-600">{copy.howNote}</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{copy.whatTitle}</h2>
              <p>{copy.whatIntro}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{copy.whatI1}</li>
                <li>{copy.whatI2}</li>
                <li>{copy.whatI3}</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{copy.retainTitle}</h2>
              <p>{copy.retainIntro}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{copy.retainI1}</li>
                <li>{copy.retainI2}</li>
              </ul>
              <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-slate-700">
                {copy.retainNote}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{copy.timelineTitle}</h2>
              <p>{copy.timelineP1}</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{copy.partialTitle}</h2>
              <p>{copy.partialP1}</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{copy.contactTitle}</h2>
              <p>
                {copy.contactP1}
                <a
                  href={`mailto:${APP_SUPPORT_EMAIL}`}
                  className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900"
                >
                  {APP_SUPPORT_EMAIL}
                </a>
              </p>
            </section>

            <div className="pt-4 border-t border-slate-100">
              <Link
                href="/privacy-policy#delete-account"
                className="text-sm text-violet-700 hover:text-violet-900 underline underline-offset-2"
              >
                {copy.privacyLink}
              </Link>
            </div>
          </div>
        </article>
      </div>
    </main>
  )
}
