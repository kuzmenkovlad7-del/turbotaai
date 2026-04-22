"use client"

import { useMemo } from "react"
import { useLanguage } from "@/lib/i18n/language-context"

const copy = {
  uk: {
    title: "Видалення акаунту та даних",
    updated: "Оновлено: квітень 2026",
    intro:
      "TurbotaAI поважає ваше право на видалення акаунту та особистих даних. Ця сторінка пояснює, як ви можете це зробити.",
    cancelTitle: "Перш ніж видаляти акаунт",
    cancelBody:
      "Якщо у вас є активна підписка, будь ласка, скасуйте її до видалення акаунту. Після видалення акаунту повернення коштів за невикористаний оплачений період неможливе.",
    cancelStepsTitle: "Як скасувати підписку:",
    cancelSteps: [
      "Відкрийте застосунок TurbotaAI.",
      "Перейдіть до розділу «Акаунт» → «Підписка».",
      "Натисніть «Скасувати підписку» та підтвердіть дію.",
    ],
    deleteAccountTitle: "Як видалити акаунт",
    deleteAccountSteps: [
      "Надішліть запит на адресу support@turbotaai.com з теми «Видалення акаунту».",
      "Вкажіть email, з яким зареєстровано акаунт.",
      "Ми підтвердимо ваш запит та обробимо його протягом 30 днів.",
    ],
    deleteDataTitle: "Видалення ваших даних",
    deleteDataBody:
      "Разом із видаленням акаунту ми видалимо:",
    deleteDataItems: [
      "Ваш профіль (email, налаштування).",
      "Історію чат-сесій та голосових розмов.",
      "Device-ідентифікатор та пов'язані дані доступу.",
    ],
    retentionTitle: "Дані, які можуть зберігатися",
    retentionBody:
      "Відповідно до вимог законодавства, безпеки та бухгалтерського обліку, частина даних може зберігатися після видалення акаунту:",
    retentionItems: [
      "Записи про платежі та рахунки (вимога фінансового обліку).",
      "Логи безпеки, якщо є підозра на шахрайство або зловживання.",
      "Анонімізована статистика, яка не ідентифікує вас особисто.",
    ],
    contactTitle: "Контакт для запитів на видалення",
    contactBody:
      "Для всіх запитів щодо видалення акаунту або даних звертайтесь:",
    contactEmail: "support@turbotaai.com",
    contactNote:
      "Термін обробки запиту — до 30 календарних днів з моменту підтвердження вашої особи.",
  },
  ru: {
    title: "Удаление аккаунта и данных",
    updated: "Обновлено: апрель 2026",
    intro:
      "TurbotaAI уважает ваше право на удаление аккаунта и личных данных. Эта страница объясняет, как это сделать.",
    cancelTitle: "Перед удалением аккаунта",
    cancelBody:
      "Если у вас есть активная подписка, пожалуйста, отмените её до удаления аккаунта. После удаления аккаунта возврат средств за неиспользованный оплаченный период невозможен.",
    cancelStepsTitle: "Как отменить подписку:",
    cancelSteps: [
      "Откройте приложение TurbotaAI.",
      "Перейдите в раздел «Аккаунт» → «Подписка».",
      "Нажмите «Отменить подписку» и подтвердите действие.",
    ],
    deleteAccountTitle: "Как удалить аккаунт",
    deleteAccountSteps: [
      "Отправьте запрос на support@turbotaai.com с темой «Удаление аккаунта».",
      "Укажите email, с которым зарегистрирован аккаунт.",
      "Мы подтвердим ваш запрос и обработаем его в течение 30 дней.",
    ],
    deleteDataTitle: "Удаление ваших данных",
    deleteDataBody: "Вместе с удалением аккаунта мы удалим:",
    deleteDataItems: [
      "Ваш профиль (email, настройки).",
      "Историю чат-сессий и голосовых разговоров.",
      "Device-идентификатор и связанные данные доступа.",
    ],
    retentionTitle: "Данные, которые могут сохраняться",
    retentionBody:
      "В соответствии с требованиями законодательства, безопасности и бухгалтерского учёта, часть данных может сохраняться после удаления аккаунта:",
    retentionItems: [
      "Записи о платежах и счетах (требование финансового учёта).",
      "Логи безопасности при подозрении на мошенничество или злоупотребление.",
      "Анонимизированная статистика, которая не идентифицирует вас лично.",
    ],
    contactTitle: "Контакт для запросов на удаление",
    contactBody:
      "Для всех запросов об удалении аккаунта или данных обращайтесь:",
    contactEmail: "support@turbotaai.com",
    contactNote:
      "Срок обработки запроса — до 30 календарных дней с момента подтверждения вашей личности.",
  },
  en: {
    title: "Account & Data Deletion",
    updated: "Updated: April 2026",
    intro:
      "TurbotaAI respects your right to delete your account and personal data. This page explains how to do so.",
    cancelTitle: "Before deleting your account",
    cancelBody:
      "If you have an active subscription, please cancel it before deleting your account. Once the account is deleted, refunds for any unused paid period are not possible.",
    cancelStepsTitle: "How to cancel your subscription:",
    cancelSteps: [
      "Open the TurbotaAI app.",
      "Go to Account → Subscription.",
      "Tap ‘Cancel subscription’ and confirm.",
    ],
    deleteAccountTitle: "How to delete your account",
    deleteAccountSteps: [
      "Send a request to support@turbotaai.com with the subject 'Account Deletion'.",
      "Include the email address associated with your account.",
      "We will confirm your request and process it within 30 days.",
    ],
    deleteDataTitle: "Deletion of your data",
    deleteDataBody: "Along with account deletion we will remove:",
    deleteDataItems: [
      "Your profile (email, settings).",
      "Chat session history and voice conversation history.",
      "Device identifier and associated access data.",
    ],
    retentionTitle: "Data that may be retained",
    retentionBody:
      "In accordance with legal, security and billing requirements, some data may be retained after account deletion:",
    retentionItems: [
      "Payment and billing records (financial accounting requirement).",
      "Security logs where fraud or abuse is suspected.",
      "Anonymised aggregate statistics that do not identify you personally.",
    ],
    contactTitle: "Contact for deletion requests",
    contactBody:
      "For all account or data deletion requests, please contact:",
    contactEmail: "support@turbotaai.com",
    contactNote:
      "Requests are processed within 30 calendar days of identity verification.",
  },
}

export default function DeleteAccountPage() {
  const { currentLanguage } = useLanguage()

  const lang = useMemo(() => {
    const code = String(currentLanguage?.code || "uk").toLowerCase()
    return code.startsWith("ru") ? "ru" : code.startsWith("en") ? "en" : "uk"
  }, [currentLanguage?.code])

  const c = copy[lang as "uk" | "ru" | "en"]

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <article className="rounded-3xl bg-white/80 shadow-sm border border-slate-100 px-4 py-8 sm:px-10 sm:py-10">
          <header className="mb-10">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{c.title}</h1>
            <p className="mt-2 text-sm text-slate-500">{c.updated}</p>
          </header>

          <div className="space-y-8 text-[15px] leading-relaxed text-slate-800">
            <p>{c.intro}</p>

            {/* Cancel subscription first */}
            <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="text-lg font-semibold text-amber-900">{c.cancelTitle}</h2>
              <p className="text-amber-800">{c.cancelBody}</p>
              <p className="font-medium text-amber-900">{c.cancelStepsTitle}</p>
              <ol className="list-decimal pl-5 space-y-1 text-amber-800">
                {c.cancelSteps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </section>

            {/* Delete account */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{c.deleteAccountTitle}</h2>
              <ol className="list-decimal pl-5 space-y-2">
                {c.deleteAccountSteps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </section>

            {/* What gets deleted */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{c.deleteDataTitle}</h2>
              <p>{c.deleteDataBody}</p>
              <ul className="list-disc pl-5 space-y-1">
                {c.deleteDataItems.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </section>

            {/* Retention exceptions */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{c.retentionTitle}</h2>
              <p>{c.retentionBody}</p>
              <ul className="list-disc pl-5 space-y-1">
                {c.retentionItems.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </section>

            {/* Contact */}
            <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-xl font-semibold">{c.contactTitle}</h2>
              <p>{c.contactBody}</p>
              <a
                href={`mailto:${c.contactEmail}`}
                className="inline-block font-medium text-blue-600 hover:underline"
              >
                {c.contactEmail}
              </a>
              <p className="text-sm text-slate-500">{c.contactNote}</p>
            </section>
          </div>
        </article>
      </div>
    </main>
  )
}
