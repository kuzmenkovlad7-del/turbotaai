// lib/i18n/translations/ru.ts
import { en } from "./en"

export const ru: Record<string, string> = {
  // Базово берём все ключи из en, чтобы ничего не ломалось
  ...en,

  // ─────────────────────
  // Навигация и меню
  // ─────────────────────
  Home: "Главная",
  About: "О сервисе",
  Services: "Услуги",
  Pricing: "Тарифы",
  Contact: "Контакты",
  "Sign In": "Войти",
  "Sign Up": "Создать аккаунт",
  "Create an Account": "Создать аккаунт",
  "Log In": "Войти",

  "nav.home": "Главная",
  "nav.programs": "Программы",
  "nav.clientStories": "Истории клиентов",
  "nav.about": "О нас",
  "nav.contacts": "Контакты",
  "nav.privacyPolicy": "Политика конфиденциальности",
  "nav.termsOfUse": "Условия использования",

  // ─────────────────────
  // Hero TurbotaAI (верх главной)
  // ─────────────────────
  "AI-psychologist nearby 24/7": "AI-психолог рядом 24/7",
  "Psychological support when it feels hard, powered by AI":
    "Психологическая поддержка, когда тяжело, с усилением ИИ",
  "TurbotaAI listens without judgement, asks clarifying questions and gently guides you through breathing, grounding and simple exercises based on psychological books. In chat, voice or video — when you feel anxious, exhausted or alone.":
    "TurbotaAI слушает без осуждения, задаёт мягкие уточняющие вопросы и аккуратно проводит через дыхательные практики, граундинг и простые упражнения из психологических книг. В чате, голосом или по видео — когда тревожно, выжжено или одиноко.",
  "Start for free": "Начать бесплатно",
  "How it works": "Как это работает",

  "When it feels bad right now": "Когда плохо прямо сейчас",
  "Anxiety, stress & burnout": "Тревога, стресс и выгорание",
  "7–21 day support programs": "Поддерживающие программы на 7–21 день",

  "3 assistant modes · chat · voice · video":
    "3 режима ассистента · чат · голос · видео",
  "Choose how it's more comfortable for you to talk.":
    "Выбирайте формат, в котором вам комфортнее говорить.",

  // Старый блок Myitra — оставляем, но адаптированный
  "Myitra Platform · AI + Psychology": "Платформа Myitra · ИИ + психология",
  "Live Psychological Support,": "Живая психологическая поддержка,",
  "AI-Enhanced": "усиленная ИИ",
  "Licensed psychologists supported by AI assistants. We help gather history, maintain journals, and remind about sessions.":
    "Лицензированные психологи, которых усиливают AI-ассистенты. Мы помогаем собирать историю, вести дневники и напоминать о сессиях.",
  "Talk Now": "Поговорить сейчас",
  "View Services": "Смотреть услуги",
  "AI Chat 24/7": "AI-чат 24/7",
  "Voice Calls": "Голосовые звонки",
  "Video Sessions": "Видеосессии",
  "Myitra Psychology Session": "Психологическая сессия Myitra",
  "3 Assistant Modes": "3 режима ассистента",
  "chat · voice · video": "чат · голос · видео",

  // ─────────────────────
  // Home: блок с тремя форматами общения
  // ─────────────────────
  "Choose how you want to talk": "Выберите, как вам удобнее говорить",
  "How would you like to contact us?": "Как вам проще выйти на связь?",
  "Start with a quick chat, a voice call or a video session with our AI-psychologist — choose the format that feels safest right now.":
    "Начните с быстрого чата, голосового звонка или видеосессии с AI-психологом — выберите формат, который сейчас кажется самым безопасным.",

  "Chat with AI-psychologist": "Чат с AI-психологом",
  "Write what is happening in your own words and get structured support in a few minutes.":
    "Опишите, что с вами происходит, своими словами и получите структурированную поддержку за несколько минут.",
  "Best when you need privacy and want to stay silent around other people.":
    "Лучший формат, когда нужна приватность и не хочется говорить вслух рядом с другими.",
  "You can return to the conversation history and exercises at any time.":
    "В любой момент можно вернуться к истории диалога и упражнениям.",
  "Start chat": "Начать чат",

  "Call AI-psychologist": "Позвонить AI-психологу",
  "Voice format for more lively support when you want to hear a calm voice.":
    "Голосовой формат для более живой поддержки, когда хочется услышать спокойный голос.",
  "Helps reduce the feeling of loneliness in difficult moments.":
    "Помогает уменьшить чувство одиночества в сложные моменты.",
  "Suitable when emotions are strong and you need to speak out quickly.":
    "Подходит, когда эмоции очень сильные и нужно быстро выговориться.",
  "Start voice call": "Начать голосовой звонок",

  "Video session with AI": "Видеосессия с ИИ",
  "Face-to-face session with a 3D-avatar when you want to feel presence and eye contact.":
    "Сессия «лицом к лицу» с 3D-аватаром, когда важно почувствовать присутствие и зрительный контакт.",
  "Gives a stronger feeling that someone is really next to you.":
    "Даёт ощущение, что рядом действительно есть тот, кто поддерживает.",
  "Best for deeper work, body reactions and long-term processes.":
    "Лучше всего подходит для более глубокой работы, телесных реакций и длительных процессов.",
  "Start video call": "Начать видеозвонок",

  "Not sure which format? Start with a safe chat":
    "Не уверены с форматом? Начните с безопасного чата",

  "Your browser may not fully support voice features. For the best experience, please use Chrome, Edge, or Safari.":
    "Ваш браузер может некорректно поддерживать голосовые функции. Для лучшей работы используйте Chrome, Edge или Safari.",
  "Your browser may not fully support video features. For the best experience, please use Chrome, Edge, or Safari.":
    "Ваш браузер может некорректно поддерживать видеовозможности. Для лучшей работы используйте Chrome, Edge или Safari.",

  "There was an issue with the voice call. Please try again.":
    "Возникла ошибка во время голосового звонка. Попробуйте ещё раз.",
  "There was an issue with the video call. Please try again.":
    "Возникла ошибка во время видеозвонка. Попробуйте ещё раз.",

  // ─────────────────────
  // Блок преимуществ (ServiceFeatures)
  // ─────────────────────
  "Support in minutes when it feels really bad":
    "Поддержка за считанные минуты, когда действительно очень плохо",
  "Open chat, voice or video exactly when it feels bad right now — без очередей, анкет и ожидания записи.":
    "Откройте чат, голос или видео ровно в тот момент, когда плохо прямо сейчас — без очередей, анкет и ожидания записи.",
  "Feels like a calm, respectful human conversation":
    "По ощущениям — спокойный, уважительный разговор с человеком",
  "Ассистент сначала слушает и задаёт мягкие уточняющие вопросы, а уже потом предлагает короткие упражнения и шаги.":
    "Ассистент сначала внимательно слушает и задаёт мягкие уточняющие вопросы, а уже потом предлагает короткие упражнения и следующие шаги.",
  "Works in 10+ languages": "Работает более чем на 10 языках",
  "Украинский, русский, английский и другие популярные языки. Язык можно менять прямо во время диалога.":
    "Украинский, русский, английский и другие популярные языки. Язык можно менять прямо во время диалога.",
  "From quick help to 7–21 day programs":
    "От быстрой помощи до программ на 7–21 день",
  "Готовые сценарии: «когда плохо прямо сейчас», работа с тревогой и стрессом, а также мягкие программы на 7–21 день с регулярными чек-инами.":
    "Готовые сценарии: «когда плохо прямо сейчас», работа с тревогой и стрессом, а также мягкие программы на 7–21 день с регулярными чек-инами.",
  "Safe and confidential space": "Безопасное и конфиденциальное пространство",
  "Разговоры шифруются и не используются для рекламы. Вы сами решаете, что рассказывать и когда удалять историю.":
    "Разговоры шифруются и не используются для рекламы. Вы сами решаете, что рассказывать и когда удалять историю.",
  "Simple pricing with a free start":
    "Простая ценовая модель с бесплатным стартом",
  "На запуске: тестовый период и несколько бесплатных вопросов. Затем — прозрачные тарифы без скрытых платежей: разовый доступ и помесячная подписка.":
    "На запуске — тестовый период и несколько бесплатных вопросов. Затем — прозрачные тарифы без скрытых платежей: разовый доступ и помесячная подписка.",

  "Why people choose TurbotaAI": "Почему люди выбирают TurbotaAI",
  "TurbotaAI is built for moments when you have no strength to search for a therapist or wait for an appointment, but really need someone to talk to right now.":
    "TurbotaAI создана для моментов, когда нет сил искать терапевта или ждать записи, но очень нужно с кем-то поговорить прямо сейчас.",

  // ─────────────────────
  // Контактный блок / страница
  // ─────────────────────
  "Contact Us": "Свяжитесь с нами",
  "Contact Page Description":
    "Напишите нам, если нужна поддержка, консультация или вы хотите обсудить сотрудничество.",
  "Have questions or need assistance? Reach out to our support team and we'll get back to you as soon as possible.":
    "Есть вопросы или нужна помощь? Напишите нашей команде поддержки — мы ответим как можно быстрее.",

  "Average reply": "Среднее время ответа",
  "within 24 hours": "до 24 часов",
  "Privacy": "Приватность",
  "encrypted conversations": "зашифрованные разговоры",

  "Email us": "Напишите нам на email",
  "All questions about the service, payments, access to the assistant or cooperation — please write to this address.":
    "Все вопросы по сервису, оплате, доступу к ассистенту или сотрудничеству — пожалуйста, пишите на этот адрес.",

  "Support, partnerships and press": "Поддержка, партнёрства и пресса",
  "Contact TurbotaAI team": "Свяжитесь с командой TurbotaAI",
  "Have questions about how the AI-psychologist works, want to discuss partnership or need help with your account? Leave a request — we will answer as soon as possible.":
    "Есть вопросы о том, как работает AI-психолог, хотите обсудить партнёрство или нужна помощь с аккаунтом? Оставьте заявку — мы ответим как можно скорее.",

  "For urgent situations, please contact local emergency services or a crisis line in your country. TurbotaAI is not a substitute for emergency medical help.":
    "В экстренных ситуациях обращайтесь в местные службы спасения или на кризисную линию вашей страны. TurbotaAI не заменяет экстренную медицинскую помощь.",

  "Send us a message": "Отправьте нам сообщение",
  "Send Message": "Отправить сообщение",

  "Your Name": "Ваше имя",
  "Email Address": "Электронная почта",
  Subject: "Тема",
  "Your Message": "Ваше сообщение",
  "Message is required": "Нужно ввести сообщение",
  "Message must be at least 10 characters":
    "Сообщение должно содержать минимум 10 символов",
  "Thank you for your message!": "Спасибо за сообщение!",
  "We've received your inquiry and will get back to you as soon as possible.":
    "Мы получили ваше обращение и ответим в ближайшее время.",

  // ─────────────────────
  // Футер и дисклеймер
  // ─────────────────────
  "AI Psychological Support": "AI-психологическая поддержка",
  "Professional, scalable, and aesthetically pleasing online service that utilizes AI to deliver quality psychological care.":
    "Профессиональный, масштабируемый и эстетичный онлайн-сервис, который использует ИИ для качественной психологической помощи.",
  "Psychological support based on AI for everyday emotional difficulties.":
    "Психологическая поддержка на основе ИИ для ежедневных эмоциональных трудностей.",

  "Quick Links": "Быстрые ссылки",
  Legal: "Юридическая информация",
  "Terms of Service": "Условия предоставления услуг",
  "Privacy Policy": "Политика конфиденциальности",
  "Terms of Use": "Условия использования",

  "This is not an emergency service":
    "Это не служба экстренной помощи",
  "TurbotaAI is not a replacement for a licensed psychologist or psychiatrist.":
    "TurbotaAI не заменяет консультации лицензированного психолога или психиатра.",
  "If you are in immediate danger, contact emergency services or a crisis hotline in your country.":
    "Если вы в опасности — обратитесь в экстренные службы или на кризисную линию вашей страны.",

  "All rights reserved": "Все права защищены",

  // ─────────────────────
  // Программы / истории (из старого файла — адаптировано)
  // ─────────────────────
  "Our Programs": "Наши программы",
  "Programs Page Description":
    "Выберите программу, которая соответствует вашему запросу и формату поддержки.",
  "Single Session": "Разовая сессия",
  "Monthly Subscription": "Ежемесячная подписка",
  "Corporate Program": "Корпоративная программа",
  "Program Price - Single": "$49",
  "Program Price - Monthly": "$149/мес",
  "Program Price - Corporate": "По запросу",
  "Choose Program": "Выбрать программу",

  "Stories Page Description":
    "Реальные отзывы людей, которые получили поддержку через Myitra.",
  "Story 1 Name": "Анна М.",
  "Story 1 Text":
    "Myitra помогла мне пройти сложный период. AI-психолог всегда был доступен, когда мне нужна была поддержка.",
  "Story 2 Name": "Елена К.",
  "Story 2 Text":
    "Сочетание профессиональной психологии и технологий ИИ впечатляет. Я чувствую, что меня слышат и понимают.",
  "Story 3 Name": "Дмитрий С.",
  "Story 3 Text":
    "Корпоративная программа изменила подход нашей команды к ментальному здоровью. Очень рекомендую!",

  // ─────────────────────
  // Новые ключи: страница Client Stories
  // ─────────────────────
  "Real experiences from beta users":
    "Реальный опыт бета-пользователей",
  "Client stories": "Истории клиентов",
  "These stories show how people use TurbotaAI in different life situations — from night anxiety and burnout to adaptation after moving. Names and details are changed for privacy.":
    "Эти истории показывают, как люди используют TurbotaAI в разных жизненных ситуациях — от ночной тревоги и выгорания до адаптации после переезда. Имена и детали изменены из соображений конфиденциальности.",

  "Anna, 27 — product designer":
    "Анна, 27 лет — продакт-дизайнер",
  "Night chat instead of endless scrolling":
    "Ночной чат вместо бесконечного скролла",
  "“After a week with TurbotaAI I finally slept through the night without panic thoughts.”":
    "«После недели с TurbotaAI я наконец-то проспала ночь без панических мыслей».",
  "Burnout after relocation & anxiety before sleep":
    "Выгорание после переезда и тревога перед сном",
  "Before TurbotaAI": "До TurbotaAI",
  "For several months Anna had been falling asleep at 3–4 a.m. She moved to another city, changed jobs and constantly replayed conversations in her head. She was too tired to look for a therapist, fill in forms or wait for an appointment.":
    "Несколько месяцев Анна засыпала в 3–4 часа ночи. Она переехала в другой город, сменила работу и постоянно прокручивала в голове разговоры. У неё не было сил искать терапевта, заполнять анкеты или ждать записи.",
  "How the sessions looked": "Как выглядели сессии",
  "Anna opened the chat when it felt worst — usually late at night. The assistant helped her name what was happening, notice body sensations and try short breathing and grounding exercises. When she wanted, they switched to Ukrainian from English without losing the thread.":
    "Анна открывала чат в те моменты, когда было тяжелее всего — обычно поздно вечером. Ассистент помогал назвать то, что с ней происходит, замечать ощущения в теле и пробовать короткие дыхательные и граунд-упражнения. Когда ей хотелось, они переключались с английского на украинский, не теряя нить разговора.",
  "What changed after 3 weeks": "Что изменилось за 3 недели",
  "She started going to bed earlier and noticed that panic peaks became shorter. Anna still plans to work with a human therapist, but now she feels she has a safe backup option in her pocket for nights when everything “collapses” again.":
    "Она стала ложиться спать раньше и заметила, что пики паники стали короче. Анна по-прежнему планирует работать с живым терапевтом, но теперь чувствует, что у неё есть безопасный запасной вариант на те ночи, когда «всё снова рушится».",

  "Max, 35 — team lead in IT":
    "Макс, 35 лет — тимлид в IT",
  "Voice calls on the way to work":
    "Голосовые звонки по дороге на работу",
  "“Talking to a calm voice for ten minutes before stand-up is easier than pretending that everything is fine.”":
    "«Поговорить десять минут со спокойным голосом перед стендапом легче, чем делать вид, что всё хорошо».",
  "Panic before meetings & fear of mistakes":
    "Паника перед встречами и страх ошибок",
  "Support format he chose": "Какой формат поддержки он выбрал",
  "On difficult days Max launched a short voice session on the way to the office. Together with the assistant they unpacked what exactly he was afraid of in upcoming meetings and rehearsed several phrases that would help him stay in the adult position.":
    "В тяжёлые дни Макс запускал короткую голосовую сессию по пути в офис. Вместе с ассистентом они разбирали, чего именно он боится на предстоящих встречах, и проговаривали несколько фраз, которые помогали оставаться во взрослой позиции.",
  "Small but visible progress":
    "Небольшой, но заметный прогресс",
  "After a month he noticed that he no longer cancelled calls at the last moment and could say “I need time to think about it” instead of freezing in silence. These are small steps, but they gave him back a feeling of control.":
    "Через месяц он заметил, что больше не отменяет звонки в последний момент и может сказать «Мне нужно время, чтобы подумать» вместо того, чтобы замирать в тишине. Это небольшие шаги, но они вернули ему ощущение контроля.",

  "Sofia, 19 — first-year student":
    "София, 19 лет — студентка первого курса",
  "From “no one understands me” to small routines":
    "От «никто меня не понимает» к маленьким рутинам",
  "“It’s easier to write to the AI first and only then to friends — when I understand what I really feel.”":
    "«Мне проще сначала написать ИИ, а уже потом друзьям — когда я понимаю, что на самом деле чувствую».",
  "Loneliness, adaptation to university & dorm life":
    "Одиночество, адаптация к университету и жизни в общежитии",
  "What was happening": "Что происходило",
  "Sofia moved from a small town to another city to study. In the dorm she felt lonely, ashamed of “weakness” and did not want to burden her parents with her worries.":
    "София переехала из маленького города в другой, чтобы учиться. В общежитии она чувствовала себя одинокой, стыдилась своей «слабости» и не хотела нагружать родителей своими переживаниями.",
  "How she used TurbotaAI": "Как она использовала TurbotaAI",
  "Several times a week Sofia wrote about what had happened during the day: conflicts with roommates, fear of exams, difficulties with new people. The assistant helped her separate thoughts from facts and suggested simple experiments — for example, one small step toward someone safe in the group.":
    "Несколько раз в неделю София писала о том, что произошло за день: конфликты с соседками, страх перед экзаменами, сложности с новыми людьми. Ассистент помогал отделять мысли от фактов и предлагал простые эксперименты — например, один маленький шаг навстречу кому-то безопасному в группе.",
  "Results after the first month":
    "Результаты после первого месяца",
  "Sofia found two people with whom she now goes to classes, and created a small evening routine instead of doomscrolling. She still experiences anxiety, but she no longer feels completely alone with it.":
    "София нашла двух людей, с которыми теперь ходит на занятия, и создала небольшую вечернюю рутину вместо бесконечного скролла. Тревога всё ещё есть, но она больше не остаётся с ней совсем одна.",

  "Read full stories": "Прочитать полные истории",
  "Tap a card to open a detailed story in a calm, full-screen view. You can close it at any time with the button or the Escape key.":
    "Нажмите на карточку, чтобы открыть подробную историю в спокойном полноэкранном формате. Вы можете закрыть её в любой момент кнопкой или клавишей Escape.",
  "Stories are based on real patterns from TurbotaAI testing, but names and details are changed. TurbotaAI does not replace emergency mental health care.":
    "Истории основаны на реальных паттернах из тестирования TurbotaAI, но имена и детали изменены. TurbotaAI не заменяет экстренную психиатрическую или медицинскую помощь.",

  // ─────────────────────
  // Login / доступ без аккаунта
  // ─────────────────────
  "During the testing phase you can use the platform without creating an account.":
    "На этапе тестирования вы можете пользоваться платформой без создания аккаунта.",
  "Now you can start a chat, voice call or video session with the AI-psychologist directly from the main page.":
    "Сейчас вы можете начать чат, голосовой звонок или видеосессию с AI-психологом прямо с главной страницы.",
  "Later this page will be used for full registration, saving programs and personal settings.":
    "Позже эта страница будет использоваться для полной регистрации, сохранения программ и личных настроек.",
  "Back to main page": "Вернуться на главную",

  // ─────────────────────
  // Контакты: языки интерфейса
  // ─────────────────────
  Languages: "Языки",
  "Ukrainian · Russian · English":
    "Украинский · Русский · Английский",

  // ─────────────────────
  // Политика конфиденциальности — заголовки
  // ─────────────────────
  "Information We Collect": "Какую информацию мы собираем",
  "How We Use Your Information": "Как мы используем вашу информацию",
  "Data Security": "Безопасность данных",
  "Your Rights": "Ваши права",
  "Personal Information": "Персональная информация",
  "Session Data": "Данные сессий",
  "Technical Information": "Техническая информация",
  "Data Retention": "Хранение данных",
  "Third-Party Services": "Сторонние сервисы",
  "International Data Transfers": "Международная передача данных",
  "Children's Privacy": "Конфиденциальность детей",
  "Changes to This Policy": "Изменения в этой политике",

  // ─────────────────────
  // Программы TurbotaAI
  // ─────────────────────
  "Flexible programs for different life situations":
    "Гибкие программы для разных жизненных ситуаций",
  Programs: "Программы",
  "You can start with a one-time session and later switch to regular support or a program for your team.":
    "Можно начать с разовой сессии, а позже перейти к регулярной поддержке или программе для своей команды.",
  "Good when": "Когда это подходит",
  "Good when:": "Когда это подходит:",
  "Single support session": "Разовая сессия поддержки",
  "One-time session when it feels very bad and you need support right now without waiting.":
    "Разовая сессия, когда очень плохо и нужна поддержка прямо сейчас, без ожидания.",
  "Sudden anxiety, panic, difficult evening or night.":
    "Внезапная тревога, паника, тяжёлый вечер или ночь.",
  "You want to share what is happening, but there is no safe person nearby.":
    "Хочется поделиться тем, что происходит, но рядом нет безопасного человека.",
  "Chat or voice, about 30–40 minutes.":
    "Чат или голосовой формат, примерно 30–40 минут.",

  "Regular support program": "Программа регулярной поддержки",
  "Monthly subscription": "Ежемесячная подписка",
  Format: "Формат",
  "Format for those who want to track their condition, receive small tasks and not be alone with emotions.":
    "Формат для тех, кто хочет отслеживать своё состояние, получать небольшие задания и не оставаться один на один с эмоциями.",
  "Chronic stress, burnout, long-term anxiety.":
    "Хронический стресс, выгорание, длительная тревога.",
  "You want to build habits and routines, not just survive crises.":
    "Вы хотите выстраивать привычки и рутины, а не только выживать в кризисах.",
  "Several short sessions per week + small daily steps.":
    "Несколько коротких сессий в неделю + маленькие ежедневные шаги.",

  "For clinics, NGOs and companies":
    "Для клиник, НКО и компаний",
  "Corporate access": "Корпоративный доступ",
  "Access to TurbotaAI for teams and organizations that want to support employees or clients.":
    "Доступ к TurbotaAI для команд и организаций, которые хотят поддерживать сотрудников или клиентов.",
  "Medical and psychological centers.":
    "Медицинские и психологические центры.",
  "NGOs and initiatives that work with vulnerable groups.":
    "НКО и инициативы, работающие с уязвимыми группами.",
  "Companies that care about emotional state of employees.":
    "Компании, которым важное эмоциональное состояние сотрудников.",
  "Team access, admin panel and separate support line.":
    "Командный доступ, админ-панель и отдельная линия поддержки.",
  "Payment integration will be configured together with you. Now we focus on the quality of support and the scenarios of the assistant.":
    "Интеграцию оплаты мы настроим вместе с вами. Сейчас мы концентрируемся на качестве поддержки и сценариях работы ассистента.",

  // ─────────────────────
  // Условия использования — заголовки
  // ─────────────────────
  "Acceptance of Terms": "Принятие условий",
  "Use of Services": "Использование сервиса",
  "User Responsibilities": "Ответственность пользователя",
  "Limitation of Liability": "Ограничение ответственности",
  "Changes to Terms": "Изменение условий",
  Eligibility: "Право пользования сервисом",
  "Prohibited Activities": "Запрещённые действия",
  "Intellectual Property": "Интеллектуальная собственность",
  "Payment and Billing": "Оплата и биллинг",
  "Cancellation and Refunds": "Отмена и возвраты",
  "Disclaimer of Warranties": "Отказ от гарантий",
  Indemnification: "Возмещение убытков",
  Termination: "Прекращение доступа",
  "Governing Law and Dispute Resolution":
    "Применимое право и разрешение споров",
  Severability: "Разделимость положений",
  "Contact Information": "Контактная информация",
  "Last Updated": "Обновлено",
  "Last Updated: November 2025": "Обновлено: ноябрь 2025 года",

  // ─────────────────────
  // About / О продукте
  // ─────────────────────
  "About the product": "О продукте",
  "TurbotaAI — AI-psychologist that stays nearby when it feels hard":
    "TurbotaAI — AI-психолог, который остаётся рядом, когда тяжело",
  "TurbotaAI is a digital assistant built on psychological literature and modern AI. It does not replace a live therapist, but gives gentle, structured support when it is difficult to reach someone or when you need to talk right now — in chat, voice or video.":
    "TurbotaAI — цифровой ассистент, основанный на психологической литературе и современных технологиях ИИ. Он не заменяет живого терапевта, но даёт мягкую, структурированную поддержку, когда сложно дотянуться до кого-то или нужно срочно выговориться — в чате, голосом или по видео.",
  "Who TurbotaAI is for": "Для кого создана TurbotaAI",
  "On the first versions we focus on people who need emotional support in everyday life — without stigma and without long waiting.":
    "В первых версиях мы фокусируемся на людях, которым нужна эмоциональная поддержка в повседневной жизни — без стигмы и без долгого ожидания.",
  "• Women who feel stress, anxiety, burnout or loneliness.":
    "• Женщины, которые испытывают стресс, тревогу, выгорание или одиночество.",
  "• Teenagers 12–18 who need a safe space to talk about emotions and self-esteem.":
    "• Подростки 12–18 лет, которым нужно безопасное пространство, чтобы говорить об эмоциях и самооценке.",
  "• People who are alone or feel isolated and want to be heard.":
    "• Люди, которые остались одни или чувствуют себя изолированными и хотят быть услышанными.",
  "• Later — veterans and their families as a separate module.":
    "• Позже — ветераны и их семьи как отдельный модуль.",

  "How the assistant works": "Как работает ассистент",
  "The assistant listens first, asks clarifying questions and only then offers recommendations — step by step, without pressure.":
    "Сначала ассистент слушает, задаёт уточняющие вопросы и только потом предлагает рекомендации — шаг за шагом, без давления.",
  "• Chat, voice or video — you choose the format.":
    "• Чат, голос или видео — вы выбираете формат.",
  "• Clarifying questions instead of 20 tips at once — the assistant tries to understand your state.":
    "• Уточняющие вопросы вместо 20 советов сразу — ассистент старается понять ваше состояние.",
  "• Breathing, grounding, short exercises, diary of emotions, small daily steps.":
    "• Дыхательные практики, граунд-упражнения, короткие практики, дневник эмоций, маленькие ежедневные шаги.",
  "• Short programs for 7–21 days to gently change habits and support you regularly.":
    "• Короткие программы на 7–21 день, чтобы мягко менять привычки и регулярно поддерживать вас.",
  "• Answers are based on selected psychological books and materials that were tested with a psychologist.":
    "• Ответы основаны на подборке психологических книг и материалов, которые мы тестировали вместе с психологом.",

  "What TurbotaAI is not": "Чем TurbotaAI не является",
  "It is important to be honest about the limits of technology.":
    "Важно честно говорить об ограничениях технологий.",
  "• TurbotaAI is not a doctor and not a psychiatrist.":
    "• TurbotaAI — не врач и не психиатр.",
  "• It does not make diagnoses and does not replace emergency help.":
    "• Она не ставит диагнозы и не заменяет экстренную помощь.",
  "• In crisis or risk of harm to yourself or others, you should contact emergency services or a human specialist.":
    "• В кризисе или при риске причинить вред себе или другим нужно обращаться в экстренные службы или к живому специалисту.",
  "• The assistant is a supportive tool that can live alongside individual or group therapy.":
    "• Ассистент — вспомогательный инструмент, который может существовать рядом с индивидуальной или групповой терапией.",

  "Sessions, test period and subscription":
    "Сессии, тестовый период и подписка",
  "On the first launch we plan to test the service with a free period, so that users can safely try the assistant and we can see how people really use TurbotaAI.":
    "На старте мы планируем протестировать сервис с бесплатным периодом, чтобы пользователи могли безопасно попробовать ассистента, а мы — увидеть, как люди реально пользуются TurbotaAI.",
  "After testing you can keep a small free part (for example, a few questions) and then switch to a simple paid model: a monthly subscription for regular support and a one-time access option for those who want to try a single extended session.":
    "После тестирования можно оставить небольшую бесплатную часть (например, несколько вопросов), а дальше перейти на простую платную модель: ежемесячную подписку для регулярной поддержки и разовый доступ для тех, кто хочет попробовать одну расширенную сессию.",
  "All payments will be processed through a certified payment provider, and refunds will be handled manually through support e-mail if something goes wrong.":
    "Все платежи обрабатываются через сертифицированного платёжного провайдера, а возвраты средств мы будем обрабатывать вручную через email поддержки, если что-то пойдёт не так.",

  "On launch in Ukraine": "Запуск в Украине",
  "The first versions of TurbotaAI will be tested on the Ukrainian market with support for several languages. This will allow us to refine the quality of answers, tone of communication and scenarios before scaling to other countries.":
    "Первые версии TurbotaAI мы протестируем на украинском рынке с поддержкой нескольких языков. Это позволит отточить качество ответов, тон общения и сценарии перед масштабированием в другие страны.",
  "The goal is a safe, respectful assistant that you can open at any moment when you need to talk — without stigma and overcomplicated interfaces.":
    "Цель — безопасный, уважительный ассистент, которого можно открыть в любой момент, когда нужно поговорить — без стигмы и перегруженных интерфейсов.",

  // ─────────────────────
  // Contact form (ContactForm)
  // ─────────────────────
  "Contact form is temporarily unavailable. Webhook is not configured yet.":
    "Форма контакта временно недоступна. Webhook ещё не настроен.",
  "Please fill in your email and message.":
    "Пожалуйста, заполните email и сообщение.",
  "Your message has been sent. We will reply to you as soon as possible.":
    "Ваше сообщение отправлено. Мы ответим вам как можно скорее.",
  "Something went wrong while sending the message. Please try again a bit later.":
    "Что-то пошло не так при отправке сообщения. Попробуйте чуть позже.",
  "Your name": "Ваше имя",
  "How can we address you?": "Как к вам обращаться?",
  "Your email": "Ваш email",
  "Your message": "Ваше сообщение",
  "Briefly describe your request or idea.":
    "Кратко опишите свой запрос или идею.",
  "Sending...": "Отправка...",
  "Send message": "Отправить сообщение",

  // ─────────────────────
  // Modals: chat / voice / video assistants
  // ─────────────────────
  "In crisis situations, please contact local emergency services immediately.":
    "В кризисных ситуациях немедленно обращайтесь в местные службы экстренной помощи.",

  // Chat modal
  "Describe what is happening in your own words. The assistant will answer in a few short, structured messages.":
    "Опишите, что с вами происходит, своими словами. Ассистент ответит несколькими короткими структурированными сообщениями.",
  "How to start": "Как начать",
  "You can start with one sentence: for example, 'I feel anxious and can't sleep', 'I can't concentrate', or 'I don't know what to do in a relationship'.":
    "Можно начать с одного предложения, например: «Мне тревожно и я не могу уснуть», «Я не могу сосредоточиться» или «Я не знаю, что делать в отношениях».",
  "Write here what is happening to you...":
    "Напишите здесь, что с вами происходит...",

  // Voice modal
  "Voice session with AI-psychologist":
    "Голосовая сессия с AI-психологом",
  "You can talk out loud, the assistant will listen, answer and voice the reply.":
    "Вы можете говорить вслух — ассистент будет слушать, отвечать и озвучивать ответы.",
  "Press the button to start the call. Allow microphone access, then speak as if with a real psychologist.":
    "Нажмите кнопку, чтобы начать звонок. Разрешите доступ к микрофону и говорите так, как если бы общались с реальным психологом.",
  "Your e-mail will be used only to personalize the session. (guest@example.com)":
    "Ваш e-mail будет использован только для персонализации сессии. (guest@example.com)",
  "Start voice session": "Начать голосовую сессию",

  // Video modal
  "AI Psychologist Video Call": "Видеозвонок с AI-психологом",
  "Video session in Ukrainian · ➟": "Видеосессия на украинском · ➟",
  "Choose Your AI Psychologist": "Выберите своего AI-психолога",
  "Select the AI psychologist you'd like to speak with during your video call.":
    "Выберите AI-психолога, с которым хотите поговорить во время видеозвонка.",
  "Video call language:": "Язык видеозвонка:",
  Ukrainian: "Украинский",
  "All characters use Google TTS for authentic native accent.":
    "Все персонажи используют Google TTS для естественного, аутентичного акцента.",
  "Clinical psychologist specializing in anxiety, depression, and workplace stress management":
    "Клинический психолог, специализирующийся на тревоге, депрессии и управлении стрессом на работе.",
  Selected: "Выбрано",
  "Start Video Call": "Начать видеозвонок",
  "AI will understand and respond in this language with native accent":"ИИ поймёт и ответит на выбранном языке",
  "Video session in Ukrainian": "Видеосессия на украинском",
  "Video session in Russian": "Видеосессия на русском",
  "Video session in English": "Видеосессия на английском",

  // ─────────────────────
  // Terms of Use – полные абзацы
  // ─────────────────────
  "By accessing or using TurbotaAI's AI psychology services (the \"Service\"), you agree to be bound by these Terms of Use and all applicable laws and regulations. If you do not agree with any part of these Terms, you must not use the Service.":
    "Пользуясь сервисами AI-психологии TurbotaAI (далее — «Сервис»), вы подтверждаете, что соглашаетесь с настоящими Условиями использования и всеми применимыми законами и нормативными актами. Если вы не согласны с какой-либо частью этих Условий, пожалуйста, не используйте Сервис.",
  "These Terms constitute a legally binding agreement between you and the operator of TurbotaAI Psychology Services. Your continued use of the Service after we publish updates means that you accept the revised Terms.":
    "Эти Условия являются юридически обязательным соглашением между вами и оператором сервиса TurbotaAI Psychology Services. Ваше дальнейшее использование Сервиса после публикации обновлений означает, что вы принимаете изменённые Условия.",
  "To use the Service, you confirm that you:":
    "Чтобы пользоваться Сервисом, вы подтверждаете, что:",

  "are at least 18 years of age;":
    "вам исполнилось не менее 18 лет;",
  "have the legal capacity to enter into a contract;":
    "вы обладаете полной гражданской дееспособностью для заключения договоров;",
  "are not prohibited from using online services under any applicable laws;":
    "вы не ограничены в праве пользоваться онлайн-сервисами в соответствии с действующим законодательством;",
  "provide accurate and up-to-date information when requested for registration or identification;":
    "вы предоставляете правдивую, точную и актуальную информацию, когда это необходимо для регистрации или идентификации;",
  "are responsible for maintaining the confidentiality of your account credentials (if an account is created) and for all activity that occurs under your account.":
    "вы самостоятельно отвечаете за конфиденциальность своих учётных данных (если аккаунт создан) и за все действия, которые совершаются под вашим учётным записем.",

  "TurbotaAI provides AI-based psychological support tools. The Service is not a medical facility and does not provide services that qualify as medical or psychiatric treatment.":
    "TurbotaAI предоставляет инструменты психологической поддержки на основе искусственного интеллекта. Сервис не является медицинским учреждением и не оказывает услуги, приравниваемые к медицинскому или психиатрическому лечению.",
  "You agree to use the Service only for personal, non-commercial purposes, unless otherwise agreed with us in a separate written agreement. You must not:":
    "Вы соглашаетесь использовать Сервис исключительно в личных, некоммерческих целях, если иное не предусмотрено отдельным письменным соглашением с нами. Вы не можете:",

  "copy, modify or distribute the Service;":
    "копировать, изменять или распространять Сервис;",
  "attempt to gain unauthorized access to our systems or other users' data;":
    "пытаться получить несанкционированный доступ к нашим системам или данным других пользователей;",
  "use the Service to promote hate, harassment, self-harm or harm to others;":
    "использовать Сервис для разжигания вражды, преследования, причинения вреда себе или другим;",
  "use the Service in any way that may violate the law or the rights of third parties.":
    "использовать Сервис любым способом, который может нарушать закон или права третьих лиц.",

  "The Service may be updated from time to time, and we may modify features, design or availability without prior notice.":
    "Сервис может время от времени обновляться, и мы можем изменять функциональность, дизайн или доступность без предварительного уведомления.",
  "You are responsible for the information you choose to share with the Service. Do not disclose data that you are not comfortable storing in digital form, unless otherwise stated in our Privacy Policy.":
    "Вы несёте ответственность за информацию, которой делитесь через Сервис. Не раскрывайте данные, которые вы не готовы хранить в цифровом виде, если иное прямо не предусмотрено нашей Политикой конфиденциальности.",
  "You agree not to use the Service to send insults, threats, spam, advertising or any other unwanted or illegal content.":
    "Вы соглашаетесь не использовать Сервис для отправки оскорблений, угроз, спама, рекламы или любого другого нежелательного или незаконного контента.",
  "If you violate these Terms, or if we reasonably believe that your behaviour may harm the Service or other users, we may temporarily restrict or terminate your access to the Service.":
    "Если вы нарушаете эти Условия или если мы обоснованно считаем, что ваше поведение может нанести вред Сервису или другим пользователям, мы можем временно ограничить или прекратить ваш доступ к Сервису.",

  "During the testing phase, some features of TurbotaAI may be provided free of charge or with limited access. Information about pricing, subscriptions and one-time sessions will be published separately in the Service interface and/or on the website.":
    "На этапе тестирования некоторые функции TurbotaAI могут предоставляться бесплатно или с ограниченным доступом. Информация о тарифах, подписках и разовых сессиях будет отдельно опубликована в интерфейсе Сервиса и/или на сайте.",
  "If you purchase a paid subscription or a one-time service, you agree to the applicable payment terms displayed on the pricing page. Payments may be processed via third-party payment providers.":
    "Если вы оформляете платную подписку или покупаете разовую услугу, вы соглашаетесь с условиями оплаты, указанными на странице тарифа. Платежи могут обрабатываться через сторонних платёжных провайдеров.",
  "Refund conditions (if available) will be described in a separate section of the pricing page or in our refund policy. Please review these terms carefully before making a payment.":
    "Условия возврата средств (если они предусмотрены) будут описаны в отдельном разделе страницы тарифа или в нашей политике возвратов. Пожалуйста, внимательно ознакомьтесь с ними перед оплатой.",

  "The TurbotaAI Service is provided \"as is\" without any express or implied warranties regarding its accuracy, completeness or fitness for your particular purposes. We aim to keep the Service stable but do not guarantee that it will be available without interruptions or errors.":
    "Сервис TurbotaAI предоставляется «как есть» без каких-либо прямых или подразумеваемых гарантий относительно его точности, полноты или соответствия вашим конкретным целям. Мы стремимся поддерживать стабильную работу Сервиса, но не гарантируем, что он будет доступен без перебоев и ошибок.",
  "TurbotaAI is not an emergency service and does not replace consultations with a doctor, psychiatrist or other licensed healthcare professional. If you are in danger or may harm yourself or others, you must immediately contact emergency services or a human specialist.":
    "TurbotaAI не является экстренной службой и не заменяет консультацию врача, психиатра или другого лицензированного специалиста в области здравоохранения. Если вы в опасности или можете причинить вред себе или другим, немедленно обратитесь в службы экстренной помощи или к живому специалисту.",
  "To the maximum extent permitted by law, we shall not be liable for any direct, indirect, incidental, punitive or consequential damages arising out of or in connection with your use of, or inability to use, the Service.":
    "В пределах, разрешённых законом, мы не несём ответственности за какие-либо прямые, косвенные, случайные, штрафные или косвенные убытки, возникающие в результате или в связи с использованием Сервиса или невозможностью его использования.",
  "We may update these Terms from time to time. The date of the latest update is indicated at the top of this page. In case of material changes, we may additionally notify you through the Service or by e-mail (if available).":
    "Мы можем время от времени обновлять эти Условия. Дата последнего обновления указана в верхней части страницы. В случае существенных изменений мы можем дополнительно уведомить вас через Сервис или по электронной почте (если она у нас есть).",
  "By continuing to use the Service after the new Terms come into effect, you agree to the updated Terms. If you do not agree with the changes, you must stop using the Service.":
    "Продолжая пользоваться Сервисом после вступления в силу новых Условий, вы соглашаетесь с ними. Если вы не согласны с изменениями, вы должны прекратить использование Сервиса.",
  "If you have any questions about these Terms of Use, you can contact us via the contact form on the website or by using the e-mail address listed in the \"Contact\" section.":
    "Если у вас есть вопросы по этим Условиям использования, вы можете связаться с нами через форму обратной связи на сайте или по электронной почте, указанной в разделе «Контакты».",

  // ─────────────────────
  // Privacy Policy – полные абзацы
  // ─────────────────────
  "This Privacy Policy explains what information TurbotaAI collects, how we use it and how we protect it. We design the Service to respect your privacy and personal boundaries.":
    "Эта Политика конфиденциальности объясняет, какую информацию собирает TurbotaAI, как мы её используем и как защищаем. Мы создаём Сервис так, чтобы уважать вашу приватность и личные границы.",
  "By using the Service, you agree to the terms of this Policy. If you do not agree, please do not use the Service.":
    "Пользуясь Сервисом, вы соглашаетесь с условиями этой Политики. Если вы не согласны, пожалуйста, не используйте Сервис.",

  "1. Personal and contact information":
    "1. Персональная и контактная информация",
  "We may collect the following information:":
    "Мы можем собирать следующую информацию:",
  "your name or nickname that you provide;":
    "ваше имя или псевдоним, который вы указываете;",
  "e-mail address if you submit it for contact or registration;":
    "адрес электронной почты, если вы оставляете его для связи или регистрации;",
  "any other information you voluntarily provide in forms (for example, in the contact or sign-up form).":
    "любую другую информацию, которую вы добровольно предоставляете в формах (например, в форме контакта или регистрации).",

  "2. Session content and messages":
    "2. Содержание сессий и сообщения",
  "When you use chat, voice or video assistant, we process the content of your messages, spoken input or text in order to generate responses and guidance. Depending on settings, some of this data may be temporarily stored to:":
    "Когда вы используете чат-, голосового или видео-ассистента, мы обрабатываем содержание ваших сообщений, голосовых обращений или текста, чтобы формировать ответы и рекомендации. В зависимости от настроек часть этих данных может временно сохраняться для:",
  "maintain a conversation history;":
    "ведения истории диалога;",
  "improve the quality of the assistant's replies;":
    "улучшения качества ответов ассистента;",
  "analyse common patterns in anonymised or aggregated form.":
    "анализа типичных паттернов в анонимизированном или агрегированном виде.",

  "3. Technical information": "3. Техническая информация",
  "We may also collect technical data, such as:":
    "Мы также можем собирать технические данные, например:",
  "IP address and approximate location;":
    "IP-адрес и примерное местоположение;",
  "information about your device, browser and operating system;":
    "информацию о вашем устройстве, браузере и операционной системе;",
  "cookies and similar technologies required for the Service to work and for analytics.":
    "cookie-файлы и подобные технологии, необходимые для работы Сервиса и аналитики.",

  "We use the collected data for the following purposes:":
    "Мы используем собранные данные для следующих целей:",
  "to provide you with access to chat, voice and video sessions;":
    "для предоставления вам доступа к чат-, голосовым и видеосессиям;",
  "to adapt the assistant's responses to your request and language;":
    "для адаптации ответов ассистента к вашему запросу и языку;",
  "to maintain the Service, diagnose errors and ensure security;":
    "для поддержки работы Сервиса, диагностики сбоев и обеспечения безопасности;",
  "to analyse how the Service is used and improve our support scenarios;":
    "для анализа использования Сервиса и улучшения наших сценариев поддержки;",
  "to communicate with you (for example, responses to requests, important notifications).":
    "для коммуникации с вами (например, ответы на запросы, важные уведомления).",

  "We do not sell your personal data to third parties and do not use the content of your sessions for targeted advertising.":
    "Мы не продаём ваши персональные данные третьим лицам и не используем содержимое ваших сессий для таргетированной рекламы.",
  "We apply technical and organisational security measures to protect data from unauthorised access, loss or misuse. These may include encryption, access controls, log audits and other cybersecurity practices.":
    "Мы применяем технические и организационные меры безопасности, чтобы защищать данные от несанкционированного доступа, потери или злоупотребления. Сюда могут входить шифрование, ограничение доступа, аудит логов и другие практики кибербезопасности.",
  "However, no online system can guarantee absolute security. You also play a role in keeping your data safe — for example, by not sharing your credentials with others and by using strong passwords (if user accounts are introduced).":
    "Однако ни одна онлайн-система не может гарантировать абсолютную безопасность. Вы также играете роль в защите своих данных — например, не передавая учётные данные третьим лицам и используя надёжные пароли (если аккаунты будут введены).",

  "We retain data only for as long as necessary to fulfil the purposes described in this Policy or as required by law.":
    "Мы храним данные только столько, сколько необходимо для достижения целей, описанных в этой Политике, или пока этого требует закон.",
  "Conversation history and technical logs may be deleted or anonymised after a certain period of time. In the future the interface may include settings that allow you to delete your history yourself.":
    "История диалогов и технические логи могут удаляться или анонимизироваться через определённый период времени. В будущем интерфейс может включать отдельные настройки, чтобы вы могли самостоятельно удалять свою историю.",

  "To operate the Service we may use third-party providers such as hosting companies, payment processors, video platforms or AI model providers.":
    "Для работы Сервиса мы можем использовать сторонних поставщиков — например, хостинг-провайдеров, платёжные системы, платформы видеосвязи или поставщиков моделей ИИ.",
  "These providers may process your data on our behalf and in accordance with our instructions. We aim to work only with entities that follow appropriate data protection standards.":
    "Такие поставщики могут обрабатывать ваши данные от нашего имени и в соответствии с нашими инструкциями. Мы стремимся сотрудничать только с компаниями, которые соблюдают надлежащие стандарты защиты данных.",
  "Because infrastructure may be located in different countries, your data may sometimes be transferred outside the country where you live. We take steps to ensure that such transfers comply with applicable data protection laws.":
    "Поскольку инфраструктура может располагаться в разных странах, ваши данные иногда могут передаваться за пределы страны вашего проживания. Мы предпринимаем шаги, чтобы такая передача соответствовала требованиям применимого законодательства.",

  "TurbotaAI is not intended for independent use by children under the age of 13. If you are under 18, parental or guardian consent may be required under the laws of your country.":
    "TurbotaAI не предназначена для самостоятельного использования детьми младше 13 лет. Если вам меньше 18, согласие родителей или опекунов может быть обязательным в соответствии с законами вашей страны.",
  "If we become aware that we have collected personal data from a child without appropriate consent, we will take steps to delete such information.":
    "Если мы узнаем, что собрали персональные данные ребёнка без соответствующего согласия, мы предпримем шаги для их удаления.",

  "Depending on the laws of your country, you may have the right to:":
    "В зависимости от законов вашей страны вы можете иметь право:",
  "request information about the data we hold about you;":
    "запрашивать информацию о данных, которые мы храним о вас;",
  "ask us to correct inaccurate information;":
    "требовать исправления неточной информации;",
  "request deletion of certain data (where we are not required to keep it by law);":
    "просить удалить часть данных (если мы не обязаны хранить их по закону);",
  "object to or restrict certain types of processing; and":
    "возражать против определённых способов обработки или ограничивать их;",
  "lodge a complaint with a data protection supervisory authority.":
    "подать жалобу в надзорный орган по защите данных.",

  "To exercise your rights, you can contact us via the feedback form or the e-mail address listed in the \"Contact\" section.":
    "Чтобы реализовать свои права, вы можете написать нам через форму обратной связи или на электронный адрес, указанный в разделе «Контакты».",
  "We may update this Privacy Policy from time to time. The date of the latest update is shown at the top of this page.":
    "Мы можем время от времени обновлять эту Политику конфиденциальности. Дата последнего обновления указана в верхней части страницы.",
  "If we make material changes, we may additionally notify you through the Service or by e-mail (if available). By continuing to use the Service after the changes take effect, you agree to the updated Policy.":
    "Если мы внесём существенные изменения, мы можем дополнительно уведомить вас через Сервис или по электронной почте (если она у нас есть). Продолжая пользоваться Сервисом после вступления изменений в силу, вы соглашаетесь с обновлённой Политикой.",
  "If you have any questions about this Privacy Policy or how we process your data, please contact us via the \"Contact\" page or the e-mail address provided there.":
    "Если у вас есть вопросы по этой Политике конфиденциальности или по тому, как мы обрабатываем ваши данные, свяжитесь с нами через страницу «Контакты» или по указанному там адресу электронной почты.",
}
