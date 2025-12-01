// lib/i18n/translations/uk.ts
import { en } from "./en"

export const uk: Record<string, string> = {
  // Базово берём все ключи из en, чтобы ничего не ломалось
  ...en,

  // ─────────────────────
  // Навигация и меню
  // ─────────────────────
  Home: "Головна",
  About: "Про сервіс",
  Services: "Послуги",
  Pricing: "Тарифи",
  Contact: "Контакти",
  "Sign In": "Увійти",
  "Sign Up": "Створити акаунт",
  "Create an Account": "Створити акаунт",
  "Log In": "Увійти",

  "nav.home": "Головна",
  "nav.programs": "Програми",
  "nav.clientStories": "Історії клієнтів",
  "nav.contacts": "Контакти",
  "nav.privacyPolicy": "Політика конфіденційності",
  "nav.termsOfUse": "Умови користування",

  // ─────────────────────
  // Hero TurbotaAI (верх главной)
  // ─────────────────────
  "AI-psychologist nearby 24/7": "AI-психолог поруч 24/7",
  "Psychological support when it feels hard, powered by AI":
    "Психологічна підтримка, коли важко, з підсиленням ШІ",
  "TurbotaAI listens without judgement, asks clarifying questions and gently guides you through breathing, grounding and simple exercises based on psychological books. In chat, voice or video — when you feel anxious, exhausted or alone.":
    "TurbotaAI слухає без осуду, ставить мʼякі уточнювальні запитання та мʼяко проводить через дихальні вправи, ґраундинг і прості практики з психологічних книжок. У чаті, голосом чи по відео — коли тривожно, виснажено або самотньо.",
  "Start for free": "Почати безкоштовно",
  "How it works": "Як це працює",

  "When it feels bad right now": "Коли погано просто зараз",
  "Anxiety, stress & burnout": "Тривога, стрес та вигорання",
  "7–21 day support programs": "Підтримувальні програми на 7–21 день",

  "3 assistant modes · chat · voice · video":
    "3 режими асистента · чат · голос · відео",
  "Choose how it's more comfortable for you to talk.":
    "Обирайте формат, у якому вам комфортніше говорити.",

  // Старый блок Myitra — оставляем, но адаптированно
  "Myitra Platform · AI + Psychology": "Платформа Myitra · ШІ + психологія",
  "Live Psychological Support,": "Жива психологічна підтримка,",
  "AI-Enhanced": "посилена ШІ",
  "Licensed psychologists supported by AI assistants. We help gather history, maintain journals, and remind about sessions.":
    "Ліцензовані психологи, яких підсилюють AI-асистенти. Ми допомагаємо збирати історію, вести щоденники та нагадувати про сесії.",
  "Talk Now": "Поговорити зараз",
  "View Services": "Переглянути послуги",
  "AI Chat 24/7": "AI-чат 24/7",
  "Voice Calls": "Голосові дзвінки",
  "Video Sessions": "Відеосесії",
  "Myitra Psychology Session": "Психологічна сесія Myitra",
  "3 Assistant Modes": "3 режими асистента",
  "chat · voice · video": "чат · голос · відео",

  // ─────────────────────
  // Home: блок с тремя форматами общения
  // ─────────────────────
  "Choose how you want to talk": "Обирайте, як вам зручніше говорити",
  "How would you like to contact us?": "Як вам зручніше вийти на звʼязок?",
  "Start with a quick chat, a voice call or a video session with our AI-psychologist — choose the format that feels safest right now.":
    "Почніть із швидкого чату, голосового дзвінка або відеосесії з AI-психологом — оберіть формат, який зараз відчувається найбезпечнішим.",

  "Chat with AI-psychologist": "Чат із AI-психологом",
  "Write what is happening in your own words and get structured support in a few minutes.":
    "Опишіть, що з вами відбувається, своїми словами й отримайте структуровану підтримку за кілька хвилин.",
  "Best when you need privacy and want to stay silent around other people.":
    "Найкращий формат, коли потрібна приватність і не хочеться говорити вголос поруч з іншими.",
  "You can return to the conversation history and exercises at any time.":
    "У будь-який момент можна повернутися до історії діалогу та вправ.",
  "Start chat": "Почати чат",

  "Call AI-psychologist": "Подзвонити AI-психологу",
  "Voice format for more lively support when you want to hear a calm voice.":
    "Голосовий формат для живішої підтримки, коли хочеться почути спокійний голос.",
  "Helps reduce the feeling of loneliness in difficult moments.":
    "Допомагає зменшити відчуття самотності у складні моменти.",
  "Suitable when emotions are strong and you need to speak out quickly.":
    "Підходить, коли емоції дуже сильні й потрібно швидко виговоритися.",
  "Start voice call": "Почати голосовий дзвінок",

  "Video session with AI": "Відеосесія з AI",
  "Face-to-face session with a 3D-avatar when you want to feel presence and eye contact.":
    "Сесія «обличчям до обличчя» з 3D-аватаром, коли важливо відчути присутність та зоровий контакт.",
  "Gives a stronger feeling that someone is really next to you.":
    "Дарує сильніше відчуття, що поряд справді є хтось, хто підтримує.",
  "Best for deeper work, body reactions and long-term processes.":
    "Найкраще підходить для глибшої роботи, тілесних реакцій і довготривалих процесів.",
  "Start video call": "Почати відеодзвінок",

  "Not sure which format? Start with a safe chat":
    "Не впевнені, з чого почати? Спробуйте спершу безпечний чат",

  "Your browser may not fully support voice features. For the best experience, please use Chrome, Edge, or Safari.":
    "Ваш браузер може некоректно підтримувати голосові функції. Для найкращої роботи спробуйте Chrome, Edge або Safari.",
  "Your browser may not fully support video features. For the best experience, please use Chrome, Edge, or Safari.":
    "Ваш браузер може некоректно підтримувати відеофункції. Для найкращої роботи спробуйте Chrome, Edge або Safari.",

  "There was an issue with the voice call. Please try again.":
    "Сталася помилка під час голосового дзвінка. Будь ласка, спробуйте ще раз.",
  "There was an issue with the video call. Please try again.":
    "Сталася помилка під час відеодзвінка. Будь ласка, спробуйте ще раз.",

  // ─────────────────────
  // Блок преимуществ (ServiceFeatures)
  // ─────────────────────
  "Support in minutes when it feels really bad":
    "Підтримка за лічені хвилини, коли справді дуже погано",
  "Open chat, voice or video exactly when it feels bad right now — без очередей, анкет и ожидания записи.":
    "Відкрийте чат, голос або відео саме в той момент, коли погано прямо зараз — без черг, анкет і очікування запису.",
  "Feels like a calm, respectful human conversation":
    "Відчувається як спокійна, поважна розмова з людиною",
  "Ассистент сначала слушает и задаёт мягкие уточняющие вопросы, а уже потом предлагает короткие упражнения и шаги.":
    "Асистент спершу уважно слухає й ставить мʼякі уточнювальні запитання, а вже потім пропонує короткі вправи та наступні кроки.",
  "Works in 10+ languages": "Працює більш ніж 10 мовами",
  "Украинский, русский, английский и другие популярные языки. Язык можно менять прямо во время диалога.":
    "Українська, російська, англійська та інші популярні мови. Мову можна переключати прямо під час розмови.",
  "From quick help to 7–21 day programs":
    "Від швидкої допомоги до програм на 7–21 день",
  "Готовые сценарии: «когда плохо прямо сейчас», работа с тревогой и стрессом, а также мягкие программы на 7–21 день с регулярными чек-инами.":
    "Готові сценарії: «коли погано просто зараз», робота з тривогою та стресом, а також мʼякі програми на 7–21 день із регулярними чек-інами.",
  "Safe and confidential space": "Безпечний і конфіденційний простір",
  "Разговоры шифруются и не используются для рекламы. Вы сами решаете, что рассказывать и когда удалять историю.":
    "Розмови шифруються й не використовуються для реклами. Ви самі вирішуєте, що розповідати й коли видаляти історію.",
  "Simple pricing with a free start":
    "Просте ціноутворення з безкоштовним стартом",
  "На запуске: тестовый период и несколько бесплатных вопросов. Затем — прозрачные тарифы без скрытых платежей: разовый доступ и помесячная подписка.":
    "На старті — тестовий період і кілька безкоштовних запитань. Далі — прозорі тарифи без прихованих платежів: разові сесії та помісячна підписка.",

  "Why people choose TurbotaAI": "Чому люди обирають TurbotaAI",
  "TurbotaAI is built for moments when you have no strength to search for a therapist or wait for an appointment, but really need someone to talk to right now.":
    "TurbotaAI створена для моментів, коли немає сил шукати терапевта чи чекати запису, але дуже потрібно з кимось поговорити прямо зараз.",

  // ─────────────────────
  // Контактный блок / страница
  // ─────────────────────
  "Contact Us": "Звʼяжіться з нами",
  "Contact Page Description":
    "Напишіть нам, якщо потрібна підтримка, консультація або хочете обговорити співпрацю.",
  "Have questions or need assistance? Reach out to our support team and we'll get back to you as soon as possible.":
    "Є запитання чи потрібна допомога? Напишіть нашій команді підтримки — ми відповімо якнайшвидше.",

  "Average reply": "Середній час відповіді",
  "within 24 hours": "до 24 годин",
  "Privacy": "Приватність",
  "encrypted conversations": "зашифровані розмови",

  "Email us": "Напишіть нам на email",
  "All questions about the service, payments, access to the assistant or cooperation — please write to this address.":
    "Усі питання щодо сервісу, оплати, доступу до асистента чи співпраці — будь ласка, пишіть на цю адресу.",

  "Support, partnerships and press": "Підтримка, партнерства та преса",
  "Contact TurbotaAI team": "Звʼяжіться з командою TurbotaAI",
  "Have questions about how the AI-psychologist works, want to discuss partnership or need help with your account? Leave a request — we will answer as soon as possible.":
    "Є запитання про роботу AI-психолога, хочете обговорити партнерство чи потрібна допомога з акаунтом? Залиште заявку — ми відповімо якнайшвидше.",

  "For urgent situations, please contact local emergency services or a crisis line in your country. TurbotaAI is not a substitute for emergency medical help.":
    "В екстрених ситуаціях звертайтеся до місцевих служб порятунку або на кризову лінію вашої країни. TurbotaAI не є заміною невідкладної медичної допомоги.",

  "Send us a message": "Надішліть нам повідомлення",
  "Send Message": "Надіслати повідомлення",

  "Your Name": "Ваше імʼя",
  "Email Address": "Електронна пошта",
  Subject: "Тема",
  "Your Message": "Ваше повідомлення",
  "Message is required": "Потрібно ввести повідомлення",
  "Message must be at least 10 characters":
    "Повідомлення має містити щонайменше 10 символів",
  "Thank you for your message!": "Дякуємо за повідомлення!",
  "We've received your inquiry and will get back to you as soon as possible.":
    "Ми отримали ваше звернення й відповімо найближчим часом.",

  // ─────────────────────
  // Футер и дисклеймер
  // ─────────────────────
  "AI Psychological Support": "AI-психологічна підтримка",
  "Professional, scalable, and aesthetically pleasing online service that utilizes AI to deliver quality psychological care.":
    "Професійний, масштабований та естетичний онлайн-сервіс, який використовує ШІ для якісної психологічної допомоги.",
  "Psychological support based on AI for everyday emotional difficulties.":
    "Психологічна підтримка на основі ШІ для щоденних емоційних труднощів.",

  "Quick Links": "Швидкі посилання",
  Legal: "Юридична інформація",
  "Terms of Service": "Умови надання послуг",
  "Privacy Policy": "Політика конфіденційності",
  "Terms of Use": "Умови користування",

  "This is not an emergency service":
    "Це не сервіс екстреної допомоги",
  "TurbotaAI is not a replacement for a licensed psychologist or psychiatrist.":
    "TurbotaAI не замінює консультації ліцензованого психолога чи психіатра.",
  "If you are in immediate danger, contact emergency services or a crisis hotline in your country.":
    "Якщо ви в небезпеці — зверніться до екстрених служб або на кризову лінію у вашій країні.",

  "All rights reserved": "Усі права захищено",

  // ─────────────────────
  // Программы / истории (из старого файла — адаптировано)
  // ─────────────────────
  "Our Programs": "Наші програми",
  "Programs Page Description":
    "Обирайте програму, яка відповідає вашому запиту та формату підтримки.",
  "Single Session": "Разова сесія",
  "Monthly Subscription": "Місячна підписка",
  "Corporate Program": "Корпоративна програма",
  "Program Price - Single": "$49",
  "Program Price - Monthly": "$149/міс",
  "Program Price - Corporate": "За запитом",
  "Choose Program": "Обрати програму",

  "Stories Page Description":
    "Реальні відгуки людей, які отримали підтримку через Myitra.",
  "Story 1 Name": "Анна М.",
  "Story 1 Text":
    "Myitra допомогла мені пройти складний період. AI-психолог завжди був доступний, коли мені потрібна була підтримка.",
  "Story 2 Name": "Олена К.",
  "Story 2 Text":
    "Поєднання професійної психології та технологій ШІ вражає. Я відчуваю, що мене чують і розуміють.",
  "Story 3 Name": "Дмитро С.",
  "Story 3 Text":
    "Корпоративна програма змінила підхід нашої команди до ментального здоровʼя. Дуже рекомендую!",

  // ─────────────────────
  // Нові ключі: сторінка Client Stories
  // ─────────────────────
  "Real experiences from beta users":
    "Реальний досвід бета-користувачів",
  "Client stories": "Історії клієнтів",
  "These stories show how people use TurbotaAI in different life situations — from night anxiety and burnout to adaptation after moving. Names and details are changed for privacy.":
    "Ці історії показують, як люди використовують TurbotaAI у різних життєвих ситуаціях — від нічної тривоги та вигорання до адаптації після переїзду. Імена й деталі змінені з міркувань конфіденційності.",

  "Anna, 27 — product designer":
    "Анна, 27 років — продакт-дизайнерка",
  "Night chat instead of endless scrolling":
    "Нічний чат замість безкінечного скролу",
  "“After a week with TurbotaAI I finally slept through the night without panic thoughts.”":
    "«Після тижня з TurbotaAI я нарешті проспала ніч без панічних думок».",
  "Burnout after relocation & anxiety before sleep":
    "Вигорання після переїзду та тривога перед сном",
  "Before TurbotaAI": "До TurbotaAI",
  "For several months Anna had been falling asleep at 3–4 a.m. She moved to another city, changed jobs and constantly replayed conversations in her head. She was too tired to look for a therapist, fill in forms or wait for an appointment.":
    "Кілька місяців Анна засинала о 3–4 ночі. Вона переїхала в інше місто, змінила роботу й постійно прокручувала в голові розмови. У неї не було сил шукати терапевта, заповнювати анкети чи чекати на запис.",
  "How the sessions looked": "Як виглядали сесії",
  "Anna opened the chat when it felt worst — usually late at night. The assistant helped her name what was happening, notice body sensations and try short breathing and grounding exercises. When she wanted, they switched to Ukrainian from English without losing the thread.":
    "Анна відкривала чат у ті моменти, коли було найважче — зазвичай пізно ввечері. Асистент допомагав назвати те, що з нею відбувається, помічати відчуття в тілі й пробувати короткі дихальні та ґраундинг-вправи. Коли їй хотілося, вони переключалися з англійської на українську, не втрачаючи нитку розмови.",
  "What changed after 3 weeks": "Що змінилося за 3 тижні",
  "She started going to bed earlier and noticed that panic peaks became shorter. Anna still plans to work with a human therapist, but now she feels she has a safe backup option in her pocket for nights when everything “collapses” again.":
    "Вона почала лягати спати раніше й помітила, що піки паніки стали коротшими. Анна й надалі планує працювати з живим терапевтом, але тепер відчуває, що має безпечний запасний варіант у кишені на ті ночі, коли «все знову валиться».",

  "Max, 35 — team lead in IT":
    "Макс, 35 років — тімлід в IT",
  "Voice calls on the way to work":
    "Голосові дзвінки по дорозі на роботу",
  "“Talking to a calm voice for ten minutes before stand-up is easier than pretending that everything is fine.”":
    "«Поговорити десять хвилин зі спокійним голосом перед стендапом легше, ніж робити вигляд, що все добре».",
  "Panic before meetings & fear of mistakes":
    "Паніка перед зустрічами та страх помилок",
  "Support format he chose": "Який формат підтримки він обрав",
  "On difficult days Max launched a short voice session on the way to the office. Together with the assistant they unpacked what exactly he was afraid of in upcoming meetings and rehearsed several phrases that would help him stay in the adult position.":
    "У складні дні Макс запускав коротку голосову сесію дорогою до офісу. Разом з асистентом вони розбирали, чого саме він боїться на майбутніх зустрічах, і проговорювали кілька фраз, які допомагали залишатися в дорослій позиції.",
  "Small but visible progress":
    "Невеликий, але помітний прогрес",
  "After a month he noticed that he no longer cancelled calls at the last moment and could say “I need time to think about it” instead of freezing in silence. These are small steps, but they gave him back a feeling of control.":
    "Через місяць він помітив, що більше не скасовує дзвінки в останню хвилину й може сказати «Мені потрібно час, щоб це обдумати» замість того, щоб завмирати в тиші. Це невеликі кроки, але вони повернули йому відчуття контролю.",

  "Sofia, 19 — first-year student":
    "Софія, 19 років — студентка першого курсу",
  "From “no one understands me” to small routines":
    "Від «мене ніхто не розуміє» до маленьких рутин",
  "“It’s easier to write to the AI first and only then to friends — when I understand what I really feel.”":
    "«Мені легше спочатку написати ШІ, а вже потім друзям — коли я розумію, що насправді відчуваю».",
  "Loneliness, adaptation to university & dorm life":
    "Самотність, адаптація до університету та життя в гуртожитку",
  "What was happening": "Що відбувалося",
  "Sofia moved from a small town to another city to study. In the dorm she felt lonely, ashamed of “weakness” and did not want to burden her parents with her worries.":
    "Софія переїхала з маленького міста до іншого, щоб навчатися. У гуртожитку вона почувалася самотньою, соромилася своєї «слабкості» й не хотіла обтяжувати батьків своїми переживаннями.",
  "How she used TurbotaAI": "Як вона використовувала TurbotaAI",
  "Several times a week Sofia wrote about what had happened during the day: conflicts with roommates, fear of exams, difficulties with new people. The assistant helped her separate thoughts from facts and suggested simple experiments — for example, one small step toward someone safe in the group.":
    "Кілька разів на тиждень Софія писала про те, що сталося за день: конфлікти з сусідками, страх перед іспитами, труднощі з новими людьми. Асистент допомагав відділяти думки від фактів і пропонував прості експерименти — наприклад, один маленький крок назустріч комусь безпечному в групі.",
  "Results after the first month":
    "Результати після першого місяця",
  "Sofia found two people with whom she now goes to classes, and created a small evening routine instead of doomscrolling. She still experiences anxiety, but she no longer feels completely alone with it.":
    "Софія знайшла двох людей, з якими тепер ходить на заняття, і створила невелику вечірню рутину замість безкінечного скролу. Тривога все ще є, але вона більше не лишається з нею зовсім наодинці.",

  "Read full stories": "Прочитати повні історії",
  "Tap a card to open a detailed story in a calm, full-screen view. You can close it at any time with the button or the Escape key.":
    "Натисніть на картку, щоб відкрити детальну історію в спокійному повноекранному форматі. Ви можете закрити її в будь-який момент кнопкою або клавішею Escape.",
  "Stories are based on real patterns from TurbotaAI testing, but names and details are changed. TurbotaAI does not replace emergency mental health care.":
    "Історії засновані на реальних патернах із тестування TurbotaAI, але імена й деталі змінені. TurbotaAI не замінює екстрену психіатричну чи медичну допомогу.",

  // ─────────────────────
  // Login / доступ без акаунта
  // ─────────────────────
  "During the testing phase you can use the platform without creating an account.":
    "На етапі тестування ви можете користуватися платформою без створення акаунта.",
  "Now you can start a chat, voice call or video session with the AI-psychologist directly from the main page.":
    "Зараз ви можете розпочати чат, голосовий дзвінок або відеосесію з AI-психологом прямо з головної сторінки.",
  "Later this page will be used for full registration, saving programs and personal settings.":
    "Пізніше ця сторінка буде використовуватися для повної реєстрації, збереження програм та особистих налаштувань.",
  "Back to main page": "Повернутися на головну",

  // ─────────────────────
  // Контакти: мови інтерфейсу
  // ─────────────────────
  Languages: "Мови",
  "Ukrainian · Russian · English":
    "Українська · Російська · Англійська",

  // ─────────────────────
  // Політика конфіденційності
  // ─────────────────────
  "Information We Collect": "Яку інформацію ми збираємо",
  "How We Use Your Information": "Як ми використовуємо вашу інформацію",
  "Data Security": "Безпека даних",
  "Your Rights": "Ваші права",

  // ─────────────────────
  // Програми TurbotaAI
  // ─────────────────────
  "Flexible programs for different life situations":
    "Гнучкі програми для різних життєвих ситуацій",
  Programs: "Програми",
  "You can start with a one-time session and later switch to regular support or a program for your team.":
    "Можна почати з разової сесії, а згодом перейти до регулярної підтримки чи програми для своєї команди.",
  "Single support session": "Разова сесія підтримки",
  "One-time session when it feels very bad and you need support right now without waiting.":
    "Разова сесія, коли дуже погано й потрібна підтримка просто зараз, без очікування.",
  "Sudden anxiety, panic, difficult evening or night.":
    "Раптова тривога, паніка, важкий вечір чи ніч.",
  "You want to share what is happening, but there is no safe person nearby.":
    "Хочеться поділитися тим, що відбувається, але поруч немає безпечної людини.",
  "Chat or voice, about 30–40 minutes.":
    "Чат або голосовий формат, приблизно 30–40 хвилин.",

  "Regular support program": "Програма регулярної підтримки",
  "Monthly subscription": "Місячна підписка",
  Format: "Формат",
  "Format for those who want to track their condition, receive small tasks and not be alone with emotions.":
    "Формат для тих, хто хоче відстежувати свій стан, отримувати невеликі завдання й не залишатися наодинці з емоціями.",
  "Chronic stress, burnout, long-term anxiety.":
    "Хронічний стрес, вигорання, довготривала тривога.",
  "You want to build habits and routines, not just survive crises.":
    "Хочете вибудовувати звички та рутини, а не лише виживати в кризах.",
  "Several short sessions per week + small daily steps.":
    "Кілька коротких сесій на тиждень + маленькі щоденні кроки.",

  "For clinics, NGOs and companies":
    "Для клінік, ГО та компаній",
  "Corporate access": "Корпоративний доступ",
  "Access to TurbotaAI for teams and organizations that want to support employees or clients.":
    "Доступ до TurbotaAI для команд та організацій, які хочуть підтримувати співробітників або клієнтів.",
  "Medical and psychological centers.":
    "Медичні та психологічні центри.",
  "NGOs and initiatives that work with vulnerable groups.":
    "Громадські організації та ініціативи, що працюють із вразливими групами.",
  "Companies that care about emotional state of employees.":
    "Компанії, яким важливий емоційний стан співробітників.",
  "Team access, admin panel and separate support line.":
    "Командний доступ, адмін-панель і окрема лінія підтримки.",
  "Payment integration will be configured together with you. Now we focus on the quality of support and the scenarios of the assistant.":
    "Інтеграцію оплати ми налаштуємо разом із вами. Зараз ми зосереджуємося на якості підтримки та сценаріях роботи асистента.",

  // ─────────────────────
  // Умови користування (Terms of Use)
  // ─────────────────────
  "Acceptance of Terms": "Прийняття умов",
  "Use of Services": "Використання сервісу",
  "User Responsibilities": "Відповідальність користувача",
  "Limitation of Liability": "Обмеження відповідальності",
  "Changes to Terms": "Зміни умов",

    // ─────────────────────
  // About / Про продукт
  // ─────────────────────
  "About the product": "Про продукт",
  "TurbotaAI — AI-psychologist that stays nearby when it feels hard":
    "TurbotaAI — AI-психолог, який залишається поруч, коли важко",
  "TurbotaAI is a digital assistant built on psychological literature and modern AI. It does not replace a live therapist, but gives gentle, structured support when it is difficult to reach someone or when you need to talk right now — in chat, voice or video.":
    "TurbotaAI — це цифровий асистент, побудований на психологічній літературі та сучасному ШІ. Він не замінює живого терапевта, але дає мʼяку, структуровану підтримку, коли складно дотягнутися до когось або потрібно терміново виговоритися — у чаті, голосом чи по відео.",
  "Who TurbotaAI is for": "Для кого створена TurbotaAI",
  "On the first versions we focus on people who need emotional support in everyday life — without stigma and without long waiting.":
    "У перших версіях ми фокусуємося на людях, яким потрібна емоційна підтримка в повсякденному житті — без стигми й без довгого очікування.",
  "• Women who feel stress, anxiety, burnout or loneliness.":
    "• Жінки, які відчувають стрес, тривогу, вигорання або самотність.",
  "• Teenagers 12–18 who need a safe space to talk about emotions and self-esteem.":
    "• Підлітки 12–18 років, яким потрібен безпечний простір, щоб говорити про емоції та самооцінку.",
  "• People who are alone or feel isolated and want to be heard.":
    "• Люди, які залишилися самі або почуваються ізольованими й хочуть бути почутими.",
  "• Later — veterans and their families as a separate module.":
    "• Пізніше — ветерани та їхні родини як окремий модуль.",

  "How the assistant works": "Як працює асистент",
  "The assistant listens first, asks clarifying questions and only then offers recommendations — step by step, without pressure.":
    "Спочатку асистент слухає, ставить уточнювальні запитання й лише потім пропонує рекомендації — крок за кроком, без тиску.",
  "• Chat, voice or video — you choose the format.":
    "• Чат, голос або відео — ви обираєте формат.",
  "• Clarifying questions instead of 20 tips at once — the assistant tries to understand your state.":
    "• Уточнювальні запитання замість 20 порад одночасно — асистент намагається зрозуміти ваш стан.",
  "• Breathing, grounding, short exercises, diary of emotions, small daily steps.":
    "• Дихальні вправи, ґраундинг, короткі практики, щоденник емоцій, маленькі щоденні кроки.",
  "• Short programs for 7–21 days to gently change habits and support you regularly.":
    "• Короткі програми на 7–21 день, щоб мʼяко змінювати звички й регулярно підтримувати вас.",
  "• Answers are based on selected psychological books and materials that were tested with a psychologist.":
    "• Відповіді ґрунтуються на добірці психологічних книжок і матеріалів, які ми тестували разом із психологом.",

  "What TurbotaAI is not": "Чим TurbotaAI не є",
  "It is important to be honest about the limits of technology.":
    "Важливо чесно говорити про обмеження технологій.",
  "• TurbotaAI is not a doctor and not a psychiatrist.":
    "• TurbotaAI — не лікар і не психіатр.",
  "• It does not make diagnoses and does not replace emergency help.":
    "• Вона не ставить діагнозів і не замінює невідкладну допомогу.",
  "• In crisis or risk of harm to yourself or others, you should contact emergency services or a human specialist.":
    "• У кризі чи за ризику завдати шкоди собі або іншим потрібно звертатися до екстрених служб або до живого фахівця.",
  "• The assistant is a supportive tool that can live alongside individual or group therapy.":
    "• Асистент — це допоміжний інструмент, який може існувати поруч з індивідуальною чи груповою терапією.",

  "Sessions, test period and subscription":
    "Сесії, тестовий період і підписка",
  "On the first launch we plan to test the service with a free period, so that users can safely try the assistant and we can see how people really use TurbotaAI.":
    "На старті ми плануємо протестувати сервіс із безкоштовним періодом, щоб користувачі могли безпечно спробувати асистента, а ми — побачити, як люди насправді користуються TurbotaAI.",
  "After testing you can keep a small free part (for example, a few questions) and then switch to a simple paid model: a monthly subscription for regular support and a one-time access option for those who want to try a single extended session.":
    "Після тестування можна залишити невелику безкоштовну частину (наприклад, кілька запитань), а далі перейти на просту платну модель: помісячну підписку для регулярної підтримки та разовий доступ для тих, хто хоче спробувати одну розширену сесію.",
  "All payments will be processed through a certified payment provider, and refunds will be handled manually through support e-mail if something goes wrong.":
    "Усі оплати проходитимуть через сертифікованого платіжного провайдера, а повернення коштів ми оброблятимемо вручну через email підтримки, якщо щось піде не так.",

  "On launch in Ukraine": "Запуск в Україні",
  "The first versions of TurbotaAI will be tested on the Ukrainian market with support for several languages. This will allow us to refine the quality of answers, tone of communication and scenarios before scaling to other countries.":
    "Перші версії TurbotaAI ми протестуємо на українському ринку з підтримкою кількох мов. Це дасть змогу відточити якість відповідей, тон спілкування та сценарії перед масштабуванням в інші країни.",
  "The goal is a safe, respectful assistant that you can open at any moment when you need to talk — without stigma and overcomplicated interfaces.":
    "Мета — безпечний, поважний асистент, якого можна відкрити в будь-який момент, коли потрібно поговорити — без стигми й перевантажених інтерфейсів.",

  // ─────────────────────
  // Contact form (ContactForm)
  // ─────────────────────
  "Contact form is temporarily unavailable. Webhook is not configured yet.":
    "Форма контакту тимчасово недоступна. Webhook ще не налаштований.",
  "Please fill in your email and message.":
    "Будь ласка, заповніть email і повідомлення.",
  "Your message has been sent. We will reply to you as soon as possible.":
    "Ваше повідомлення надіслано. Ми відповімо вам якнайшвидше.",
  "Something went wrong while sending the message. Please try again a bit later.":
    "Щось пішло не так під час надсилання повідомлення. Спробуйте, будь ласка, трохи пізніше.",
  "Your name": "Ваше імʼя",
  "How can we address you?": "Як до вас звертатися?",
  "Your email": "Ваш email",
  "Your message": "Ваше повідомлення",
  "Briefly describe your request or idea.":
    "Коротко опишіть свій запит або ідею.",
  "Sending...": "Надсилання...",
  "Send message": "Надіслати повідомлення",
    // ─────────────────────
  // Modals: chat / voice / video assistants
  // ─────────────────────
  "In crisis situations, please contact local emergency services immediately.":
    "У кризових ситуаціях негайно зверніться до місцевих служб екстреної допомоги.",

  // Chat modal
  "Describe what is happening in your own words. The assistant will answer in a few short, structured messages.":
    "Опишіть, що з вами відбувається своїми словами. Асистент відповість кількома короткими структурованими повідомленнями.",
  "How to start": "Як почати",
  "You can start with one sentence: for example, 'I feel anxious and can't sleep', 'I can't concentrate', or 'I don't know what to do in a relationship'.":
    "Можна почати з одного речення — наприклад: «Я тривожуся й не можу заснути», «Я не можу зосередитися» або «Я не знаю, що робити у стосунках».",
  "Write here what is happening to you...":
    "Напишіть тут, що з вами відбувається...",

  // Voice modal
  "Voice session with AI-psychologist":
    "Голосова сесія з AI-психологом",
  "You can talk out loud, the assistant will listen, answer and voice the reply.":
    "Ви можете говорити вголос — асистент слухатиме, відповідатиме й озвучуватиме відповіді.",
  "Press the button to start the call. Allow microphone access, then speak as if with a real psychologist.":
    "Натисніть кнопку, щоб розпочати дзвінок. Дозвольте доступ до мікрофона й говоріть так, ніби спілкуєтеся зі справжнім психологом.",
  "Your e-mail will be used only to personalize the session. (guest@example.com)":
    "Ваш e-mail буде використано лише для персоналізації сесії. (guest@example.com)",
  "Start voice session": "Почати голосову сесію",

  // Video modal
  "AI Psychologist Video Call": "Відеодзвінок з AI-психологом",
  "Video session in Ukrainian · ➟": "Відеосесія українською · ➟",
  "Choose Your AI Psychologist": "Обирайте свого AI-психолога",
  "Select the AI psychologist you'd like to speak with during your video call.":
    "Оберіть AI-психолога, з яким хочете поспілкуватися під час відеодзвінка.",
  "Video call language:": "Мова відеодзвінка:",
  Ukrainian: "Українська",
  "All characters use Google TTS for authentic native accent.":
    "Усі персонажі використовують Google TTS для природного, автентичного акценту.",
  "Clinical psychologist specializing in anxiety, depression, and workplace stress management":
    "Клінічний психолог, що спеціалізується на тривозі, депресії та управлінні стресом на роботі.",
  Selected: "Обрано",
  "Start Video Call": "Почати відеодзвінок",

}
