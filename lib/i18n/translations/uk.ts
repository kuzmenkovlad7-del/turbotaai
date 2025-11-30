import { en } from "./en"

export const uk: Record<string, string> = {
  ...en,

  // =========================
  // Навигация и хедер
  // =========================
  Home: "Головна",
  About: "Про сервіс",
  Services: "Послуги",
  Pricing: "Тарифи",
  Contact: "Контакти",
  "Sign In": "Увійти",
  "Sign Up": "Зареєструватися",
  "Create an Account": "Створити акаунт",
  "Log In": "Увійти",
  "Sign Out": "Вийти",
  Username: "Імʼя користувача",
  Password: "Пароль",
  "Confirm Password": "Підтвердьте пароль",
  "Forgot Password?": "Забули пароль?",
  "Already have an account?": "Вже маєте акаунт?",
  "Don't have an account?": "Ще не маєте акаунта?",
  Register: "Зареєструватися",
  "Registering...": "Реєстрація...",
  "Logging in...": "Вхід...",
  "Username is required": "Потрібно ввести імʼя користувача",
  "Username must be at least 3 characters": "Імʼя користувача має містити щонайменше 3 символи",
  "Password is required": "Потрібно ввести пароль",
  "Password must be at least 6 characters": "Пароль має містити щонайменше 6 символів",
  "Passwords do not match": "Паролі не збігаються",
  "This email is already registered": "Ця адреса вже зареєстрована",
  "This username is already taken": "Таке імʼя користувача вже зайняте",
  "An unexpected error occurred. Please try again.":
    "Сталася неочікувана помилка. Спробуйте ще раз.",
  "Invalid email or password": "Невірна пошта або пароль",
  "Your Profile": "Ваш профіль",
  "Full Name": "Повне імʼя",
  "Loading...": "Завантаження...",
  "Forgot Password": "Відновлення пароля",
  "Enter your registered email": "Введіть email, з яким ви реєструвалися",
  "Send Reset Instructions": "Надіслати інструкції",
  "Sending...": "Надсилання...",
  "Password reset instructions have been sent to your email. Please check your inbox.":
    "Інструкції з відновлення пароля надіслані на вашу пошту. Перевірте вхідні.",
  "Remember your password?": "Памʼятаєте пароль?",
  "Back to Login": "Повернутися до входу",
  "Reset Password": "Скинути пароль",
  "New Password": "Новий пароль",
  "Confirm New Password": "Підтвердіть новий пароль",
  "Resetting Password...": "Скидання пароля...",
  "Your password has been successfully reset.":
    "Ваш пароль успішно змінено.",
  "Checking reset token...": "Перевірка посилання для відновлення...",
  Profile: "Профіль",
  "Profile avatar": "Аватар профілю",
  "Remove avatar": "Видалити аватар",
  "Upload avatar": "Завантажити аватар",
  "Click the camera icon to upload a profile picture":
    "Натисніть на іконку камери, щоб завантажити фото профілю",
  "Please upload a valid image file (JPEG, PNG, GIF, WEBP)":
    "Будь ласка, завантажте коректне зображення (JPEG, PNG, GIF, WEBP)",
  "Image size should be less than 2MB":
    "Розмір зображення має бути меншим за 2 МБ",
  "Failed to upload avatar. Please try again.":
    "Не вдалося завантажити аватар. Спробуйте ще раз.",
  "Avatar updated successfully": "Аватар успішно оновлено",
  "Avatar removed successfully": "Аватар успішно видалено",
  "Failed to remove avatar. Please try again.":
    "Не вдалося видалити аватар. Спробуйте ще раз.",

  // Ключи навигации (router / меню / футер)
  "nav.home": "Головна",
  "nav.programs": "Програми",
  "nav.clientStories": "Історії клієнтів",
  "nav.contacts": "Контакти",
  "nav.privacyPolicy": "Політика конфіденційності",
  "nav.termsOfUse": "Умови користування",

  // =========================
  // Hero / головний екран
  // =========================
  "AI-Powered Psychological Support": "Психологічна підтримка на основі ШІ",
  "Professional, personalized psychological care through advanced AI technology. Connect through voice, chat, or video calls with our AI psychologist.":
    "Професійна персоналізована психологічна підтримка на основі сучасних технологій ШІ. Спілкуйтеся голосом, у чаті або по відеозвʼязку з нашим AI-психологом.",
  "Get Started": "Почати",
  "Learn More": "Дізнатися більше",
  "First 5 minutes free, then pay-as-you-go for continued support.":
    "Перші 5 хвилин безкоштовно, далі — оплата лише за використаний час.",

  // Новый hero TurbotaAI
  "AI-psychologist nearby 24/7": "AI-психолог поруч 24/7",
  "Psychological support when it feels hard, powered by AI":
    "Психологічна підтримка, коли важко, підсилена ШІ",
  "TurbotaAI listens without judgement, asks clarifying questions and gently guides you through breathing, grounding and simple exercises based on psychological books. In chat, voice or video — when you feel anxious, exhausted or alone.":
    "TurbotaAI слухає без осуду, ставить мʼякі уточнювальні запитання й делікатно проводить вас через дихальні, заземлювальні та прості вправи з психологічних книжок. У чаті, голосом або по відео — коли тривожно, виснажено чи самотньо.",
  "Start for free": "Почати безкоштовно",
  "How it works": "Як це працює",
  "When it feels bad right now": "Коли прямо зараз дуже погано",
  "Anxiety, stress & burnout": "Тривога, стрес і вигорання",
  "7–21 day support programs": "Підтримуючі програми на 7–21 день",
  "3 assistant modes · chat · voice · video":
    "3 режими асистента · чат · голос · відео",
  "Choose how it's more comfortable for you to talk.":
    "Обирайте той формат розмови, який зараз відчувається найбезпечнішим для вас.",

  // Старый блок Myitra (ключи оставили — тексты под TurbotaAI)
  "Myitra Platform · AI + Psychology": "Платформа TurbotaAI · ШІ + психологія",
  "Live Psychological Support,": "Жива психологічна підтримка,",
  "AI-Enhanced": "посилена ШІ",
  "Licensed psychologists supported by AI assistants. We help gather history, maintain journals, and remind about sessions.":
    "Ліцензовані психологи, яких підсилюють AI-асистенти. Ми допомагаємо збирати історію, вести щоденники та нагадувати про сесії.",
  "Talk Now": "Поговорити зараз",
  "View Services": "Переглянути послуги",
  "AI Chat 24/7": "AI-чат 24/7",
  "Voice Calls": "Голосові дзвінки",
  "Video Sessions": "Відеосесії",
  "Myitra Psychology Session": "Психологічна сесія TurbotaAI",
  "3 Assistant Modes": "3 режими асистента",
  "chat · voice · video": "чат · голос · відео",
  "Welcome Back": "Раді вас бачити знову",
  "Sign in to continue your journey with AI Psychology":
    "Увійдіть, щоб продовжити шлях з AI-психологією",
  "Enter your credentials to access your account":
    "Введіть дані свого акаунта, щоб увійти",
  "Signing in...": "Вхід...",
  "Forgot password?": "Забули пароль?",
  "Hide password": "Сховати пароль",
  "Show password": "Показати пароль",
  "Create account": "Створити акаунт",
  "By signing in, you agree to our":
    "Увійшовши, ви погоджуєтеся з нашими",
  "and": "та",

  // =========================
  // Блок выбора формата связи (app/page.tsx)
  // =========================
  "Choose how you want to talk": "Обирайте, як вам зараз комфортніше говорити",
  "How would you like to contact us?": "Як вам зручніше звʼязатися зараз?",
  "Start with a quick chat, a voice call or a video session with our AI-psychologist — choose the format that feels safest right now.":
    "Почніть із короткого чату, голосового дзвінка або відеосесії з AI-психологом — оберіть формат, який зараз відчувається найбезпечнішим.",
  "Chat with AI-psychologist": "Чат з AI-психологом",
  "Write what is happening in your own words and get structured support in a few minutes.":
    "Опишіть, що відбувається, своїми словами й отримайте структуровану підтримку за кілька хвилин.",
  "Best when you need privacy and want to stay silent around other people.":
    "Найкраще підходить, коли потрібна тиша і не хочеться, щоб інші чули розмову.",
  "You can return to the conversation history and exercises at any time.":
    "До історії розмови й вправ можна повернутися в будь-який момент.",
  "Start chat": "Почати чат",
  "Call AI-psychologist": "Зателефонувати AI-психологу",
  "Voice format for more lively support when you want to hear a calm voice.":
    "Голосовий формат для більш живої підтримки, коли хочеться почути спокійний голос.",
  "Helps reduce the feeling of loneliness in difficult moments.":
    "Допомагає зменшити відчуття самотності у складні моменти.",
  "Suitable when emotions are strong and you need to speak out quickly.":
    "Підходить, коли емоції дуже сильні, і потрібно швидко виговоритися.",
  "Start voice call": "Почати голосовий дзвінок",
  "Video session with AI": "Відеосесія з AI",
  "Face-to-face session with a 3D-avatar when you want to feel presence and eye contact.":
    "Сесія «віч-на-віч» з 3D-аватаром, коли хочеться відчути присутність і зоровий контакт.",
  "Gives a stronger feeling that someone is really next to you.":
    "Дає сильніше відчуття, що поряд справді є хтось, хто підтримує.",
  "Best for deeper work, body reactions and long-term processes.":
    "Найкраще підходить для глибшої роботи, реакцій тіла та довготривалих процесів.",
  "Start video call": "Почати відеодзвінок",
  "Not sure which format? Start with a safe chat":
    "Не певні у форматі? Почніть з безпечного чату",

  "Your browser may not fully support voice features. For the best experience, please use Chrome, Edge, or Safari.":
    "Ваш браузер може не повністю підтримувати голосові функції. Для найкращого досвіду використовуйте Chrome, Edge або Safari.",
  "Your browser may not fully support video features. For the best experience, please use Chrome, Edge, or Safari.":
    "Ваш браузер може не повністю підтримувати відеофункції. Для найкращого досвіду використовуйте Chrome, Edge або Safari.",
  "There was an issue with the voice call. Please try again.":
    "Сталася помилка під час голосового дзвінка. Спробуйте ще раз.",
  "There was an issue with the video call. Please try again.":
    "Сталася помилка під час відеодзвінка. Спробуйте ще раз.",

  // =========================
  // Особливості сервісу (ServiceFeatures)
  // =========================
  "Support in minutes when it feels really bad":
    "Підтримка за лічені хвилини, коли дійсно дуже погано",
  "Open chat, voice or video exactly when it feels bad right now — без очередей, анкет и ожидания записи.":
    "Відкрийте чат, голос або відео саме в той момент, коли вам зараз погано — без черг, анкет і очікування запису.",
  "Feels like a calm, respectful human conversation":
    "Відчувається як спокійна й поважна розмова з людиною",
  "Ассистент сначала слушает и задаёт мягкие уточняющие вопросы, а уже потом предлагает короткие упражнения и шаги.":
    "Асистент спочатку уважно слухає й ставить мʼякі уточнювальні запитання, а вже потім пропонує прості вправи та наступні кроки.",
  "Works in 10+ languages": "Працює більш ніж 10 мовами",
  "Украинский, русский, английский и другие популярные языки. Язык можно менять прямо во время диалога.":
    "Українська, російська, англійська та інші популярні мови. Мову можна змінювати прямо під час діалогу.",
  "From quick help to 7–21 day programs":
    "Від швидкої допомоги до програм на 7–21 день",
  "Готовые сценарии: «когда плохо прямо сейчас», работа с тревогой и стрессом, а также мягкие программы на 7–21 день с регулярными чек-инами.":
    "Готові сценарії: «коли погано прямо зараз», робота з тривогою й стресом, а також мʼякі програми на 7–21 день з регулярними чек-інами.",
  "Safe and confidential space": "Безпечний і конфіденційний простір",
  "Разговоры шифруются и не используются для рекламы. Вы сами решаете, что рассказывать и когда удалять историю.":
    "Розмови шифруються й не використовуються для реклами. Ви самі вирішуєте, що розповідати і коли видаляти історію.",
  "Simple pricing with a free start":
    "Просте ціноутворення з безкоштовним стартом",
  "На запуске: тестовый период и несколько бесплатных вопросов. Затем — прозрачные тарифы без скрытых платежей: разовый доступ и помесячная подписка.":
    "На старті — тестовий період і кілька безкоштовних питань. Далі — прозорі тарифи без прихованих платежів: разовий доступ або помісячна підписка.",

  "Why people choose TurbotaAI": "Чому люди обирають TurbotaAI",
  "TurbotaAI is built for moments when you have no strength to search for a therapist or wait for an appointment, but really need someone to talk to right now.":
    "TurbotaAI створено для моментів, коли немає сил шукати психолога чи чекати запису, але дуже потрібно просто з кимось поговорити прямо зараз.",

  // =========================
  // Контакти (ContactSection)
  // =========================
  "Average reply": "Середній час відповіді",
  "within 24 hours": "протягом 24 годин",
  Privacy: "Конфіденційність",
  "encrypted conversations": "зашифровані розмови",
  "Email us": "Напишіть нам на email",
  "All questions about the service, payments, access to the assistant or cooperation — please write to this address.":
    "Усі питання щодо сервісу, оплат, доступу до асистента чи співпраці — пишіть на цю адресу.",
  "Support, partnerships and press": "Підтримка, партнерства та преса",
  "Contact TurbotaAI team": "Звʼяжіться з командою TurbotaAI",
  "Have questions about how the AI-psychologist works, want to discuss partnership or need help with your account? Leave a request — we will answer as soon as possible.":
    "Є питання, як працює AI-психолог, хочете обговорити партнерство або потрібна допомога з акаунтом? Залиште запит — ми відповімо якомога швидше.",
  "For urgent situations, please contact local emergency services or a crisis line in your country. TurbotaAI is not a substitute for emergency medical help.":
    "У невідкладних ситуаціях звертайтеся до місцевих служб екстреної допомоги чи кризових ліній у вашій країні. TurbotaAI не є заміною екстреної медичної допомоги.",
  "Send us a message": "Надішліть нам повідомлення",

  // =========================
  // Футер
  // =========================
  "AI Psychological Support": "AI-психологічна підтримка",
  "Professional, scalable, and aesthetically pleasing online service that utilizes AI to deliver quality psychological care.":
    "Професійний, масштабований та естетичний онлайн-сервіс, який використовує ШІ для якісної психологічної допомоги.",
  "Quick Links": "Швидкі посилання",
  Legal: "Юридична інформація",
  "Terms of Service": "Умови надання послуг",
  "Privacy Policy": "Політика конфіденційності",
  "Cookie Policy": "Політика файлів cookie",
  "GDPR Compliance": "Відповідність GDPR",
  "All rights reserved": "Усі права захищено",

  "Psychological support based on AI for everyday emotional difficulties.":
    "Психологічна підтримка на основі ШІ для щоденних емоційних труднощів.",
  "This is not an emergency service":
    "Це не сервіс екстреної допомоги",
  "TurbotaAI is not a replacement for a licensed psychologist or psychiatrist.":
    "TurbotaAI не замінює роботу ліцензованого психолога чи психіатра.",
  "If you are in immediate danger, contact emergency services or a crisis hotline in your country.":
    "Якщо ви в безпосередній небезпеці, зверніться до служб екстреної допомоги або кризової лінії у вашій країні.",

  // =========================
  // Страницы тарифов / програм / історій
  // =========================
  "Pricing Plans": "Тарифні плани",
  "Choose the plan that best fits your needs. All plans include our core AI psychology features.":
    "Обирайте план, який найкраще відповідає вашим потребам. Усі тарифи включають основні можливості AI-психології.",
  Basic: "Базовий",
  Standard: "Стандарт",
  Premium: "Преміум",
  "/month": "/міс",
  "Perfect for occasional support needs.": "Для епізодичної підтримки.",
  "Ideal for regular psychological support.": "Для регулярної психологічної підтримки.",
  "Complete psychological support solution.": "Повний комплекс підтримки.",
  "5 hours of AI sessions per month": "5 годин AI-сесій на місяць",
  "15 hours of AI sessions per month": "15 годин AI-сесій на місяць",
  "Unlimited AI sessions": "Необмежена кількість AI-сесій",
  "Text and voice support": "Підтримка в чаті та голосом",
  "Text, voice, and video support": "Чат, голос та відео",
  "Basic session history": "Базова історія сесій",
  "Comprehensive session history": "Розширена історія сесій",
  "Video sessions": "Відеосесії",
  "Video sessions (limited)": "Обмежені відеосесії",
  "Unlimited video sessions": "Необмежені відеосесії",
  "Advanced analytics": "Розширена аналітика",
  "Advanced analytics and insights": "Поглиблена аналітика та інсайти",
  Popular: "Популярний",
  "You selected the {{plan}} plan. In a real implementation, you would be redirected to a payment gateway.":
    "Ви обрали тариф {{plan}}. У реальній версії вас буде перенаправлено на сторінку оплати.",
  "Frequently Asked Questions": "Поширені запитання",
  "Can I switch plans later?": "Чи можу я змінити тариф пізніше?",
  "Yes, you can upgrade or downgrade your plan at any time. Changes will take effect at the start of your next billing cycle.":
    "Так, ви можете змінити тариф у будь-який момент. Зміни набудуть чинності з наступного білінгового періоду.",
  "Is there a free trial?": "Чи є безкоштовний період?",
  "All new users get a free 5-minute session with each communication method to try our service before subscribing.":
    "Усі нові користувачі отримують безкоштовну 5-хвилинну сесію в кожному форматі спілкування, щоб спробувати сервіс до оформлення підписки.",
  "How is my data protected?": "Як захищені мої дані?",
  "All conversations are encrypted end-to-end and stored securely. We never share your data with third parties.":
    "Усі розмови шифруються та зберігаються у захищеному вигляді. Ми ніколи не передаємо ваші дані третім сторонам.",
  "Can I cancel anytime?": "Чи можу я скасувати підписку будь-коли?",
  "Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your current billing period.":
    "Так, ви можете скасувати підписку будь-коли. Доступ залишиться до кінця поточного оплачуваного періоду.",
  "Need a custom plan?": "Потрібен індивідуальний план?",
  "We offer custom enterprise solutions for organizations looking to provide psychological support to their members or employees.":
    "Ми пропонуємо індивідуальні рішення для компаній, які хочуть забезпечити психологічну підтримку співробітникам чи учасникам.",

  "Our Programs": "Наші програми",
  "Programs Page Description":
    "Обирайте програму, яка відповідає вашому запиту та формату підтримки.",
  "Single Session": "Разова сесія",
  "Monthly Subscription": "Місячна підписка",
  "Corporate Program": "Корпоративна програма",
  "Program Price - Single": "$49",
  "Program Price - Monthly": "$149/міс",
  "Program Price - Corporate": "За запитом",
  "One-time consultation": "Разова консультація",
  "All communication modes": "Усі формати спілкування",
  "Session recording": "Запис сесії",
  "Unlimited sessions": "Необмежені сесії",
  "Priority support": "Пріоритетна підтримка",
  "Progress tracking": "Відстеження прогресу",
  "Personalized recommendations": "Персональні рекомендації",
  "Team access": "Доступ для команди",
  "Admin dashboard": "Адмін-панель",
  "Custom integrations": "Кастомні інтеграції",
  "Dedicated support": "Виділена підтримка",
  "Choose Program": "Обрати програму",

  "Stories Page Description":
    "Реальні історії людей, які знайшли підтримку через TurbotaAI.",
  "Story 1 Name": "Анна М.",
  "Story 1 Text":
    "TurbotaAI допомогла мені пройти дуже складний період. AI-психолог завжди був доступний, коли мені потрібна була підтримка.",
  "Story 2 Name": "Олена К.",
  "Story 2 Text":
    "Поєднання професійної психології та технологій ШІ вражає. Я відчуваю, що мене справді чують і розуміють.",
  "Story 3 Name": "Дмитро С.",
  "Story 3 Text":
    "Корпоративна програма повністю змінила наш підхід до ментального здоровʼя в команді. Дуже рекомендую!",

  "Contact Page Description":
    "Звʼяжіться з нами, якщо потрібна підтримка, консультація або ви хочете співпрацювати.",
  "Name is required": "Потрібно вказати імʼя",
  "Email is required": "Потрібно вказати email",
  "Subject is required": "Потрібно вказати тему",
  "Message is required": "Потрібно ввести повідомлення",
  "Message must be at least 10 characters":
    "Повідомлення має містити щонайменше 10 символів",

  // =========================
  // AI-ассистент, звонки, стейты
  // =========================
  "AI Psychologist": "AI-психолог",
  "AI Psychologist (Chat)": "AI-психолог (чат)",
  "AI Psychologist (Voice Call)": "AI-психолог (голосовий дзвінок)",
  "AI Psychologist (Video Call)": "AI-психолог (відеодзвінок)",
  "Choose Your AI Psychologist": "Оберіть AI-психолога",
  "Select the AI psychologist you'd like to speak with during your video call.":
    "Оберіть AI-психолога, з яким хочете поспілкуватися під час відеодзвінка.",
  "Voice communication language": "Мова голосового спілкування",
  "Video call language": "Мова відеодзвінка",
  "Chat language": "Мова чату",
  "AI will understand and respond in this language with native accent":
    "AI розумітиме вас і відповідатиме цією мовою з природною вимовою",
  "AI will understand, transcribe, and respond in this language with native accent":
    "AI розумітиме, розпізнаватиме й відповідатиме цією мовою з природною вимовою",
  "Choose AI voice gender:": "Оберіть голос (гендер):",
  "Start Session": "Почати сесію",
  "Start Call": "Почати дзвінок",
  "End Call": "Завершити дзвінок",
  Close: "Закрити",
  User: "Користувач",

  Connected: "Підключено",
  Disconnected: "Відключено",
  "Connecting...": "Підключення...",
  "Initializing...": "Ініціалізація...",
  Idle: "Очікування",
  "Listening...": "Слухаю...",
  "Listening in {{language}}...": "Слухаю мовою {{language}}...",
  "Thinking...": "Обробляю...",
  "Speaking...": "Відповідаю...",
  "Speaking in {{language}}...": "Відповідаю мовою {{language}}...",
  "AI is speaking in {{language}}...": "AI говорить мовою {{language}}...",
  "Ready to listen in {{language}}": "Готовий слухати мовою {{language}}",
  "Microphone muted": "Мікрофон вимкнений",
  "Speaking Mode": "Режим відповіді",
  "Listening Mode": "Режим прослуховування",
  Mute: "Вимкнути мікрофон",
  Unmute: "Увімкнути мікрофон",

  "You said:": "Ви сказали:",
  "You said in {{language}}:": "Ви сказали мовою {{language}}:",
  "AI Psychologist:": "AI-психолог:",
  "AI Psychologist in {{language}}:": "AI-психолог мовою {{language}}:",
  "Your Speech in {{language}}": "Ваш голос мовою {{language}}",

  // =========================
  // Ошибки и уведомления
  // =========================
  "Network error occurred. Attempting to reconnect...":
    "Сталася помилка мережі. Пробуємо підключитися ще раз...",
  "Microphone access denied. Please allow microphone access and try again.":
    "Доступ до мікрофона заборонено. Дозвольте доступ і спробуйте ще раз.",
  "Camera access denied. Please allow camera access and try again.":
    "Доступ до камери заборонено. Дозвольте доступ і спробуйте ще раз.",
  "Connection timeout. Please try again.":
    "Час очікування підключення вичерпано. Спробуйте ще раз.",
  "I couldn't process your message. Could you try again?":
    "Не вдалося обробити повідомлення. Спробуйте, будь ласка, ще раз.",
  "I received your message but couldn't process the response properly.":
    "Я отримав ваше повідомлення, але не зміг коректно обробити відповідь.",
  "I received your message but couldn't generate a proper response.":
    "Я отримав ваше повідомлення, але не зміг сформувати відповідь.",
  "I received your message but couldn't generate a response. Could you try rephrasing?":
    "Я отримав ваше повідомлення, але не зміг сформувати відповідь. Спробуйте, будь ласка, переформулювати.",
  "I'm having trouble connecting. Let me try again.":
    "Виникли труднощі з підключенням. Дозвольте спробувати ще раз.",
  "I'm sorry, I couldn't process what you said. Could you try again?":
    "Вибачте, не вдалося обробити те, що ви сказали. Повторіть, будь ласка.",
  "Failed to start the call. Please try again.":
    "Не вдалося почати дзвінок. Спробуйте ще раз.",
  "Could not access your microphone. Please check your permissions.":
    "Не вдалося отримати доступ до мікрофона. Перевірте дозволи.",
  "Could not access your camera. Please check your permissions.":
    "Не вдалося отримати доступ до камери. Перевірте дозволи.",
  "Voice input is not supported in this browser. Please try using Chrome.":
    "Голосове введення не підтримується в цьому браузері. Спробуйте Chrome.",
  "Failed to start speech recognition. Trying alternative method...":
    "Не вдалося запустити розпізнавання мовлення. Спробуємо альтернативний спосіб...",
  "Unable to connect to speech recognition service. Please check your internet connection.":
    "Не вдалося підключитися до сервісу розпізнавання мовлення. Перевірте інтернет-зʼєднання.",
  "Network check failed. You can try to continue anyway.":
    "Перевірка мережі не вдалася. Ви можете спробувати продовжити все одно.",
  "Continue Anyway": "Продовжити все одно",
  "Start Without Network Check": "Почати без перевірки мережі",
  "Processing error occurred": "Сталася помилка обробки",
  "Connection timeout": "Час очікування вийшов",
  "Voice input not supported in this browser":
    "Голосове введення в цьому браузері не підтримується",
  "Microphone access denied": "Доступ до мікрофона заборонено",
  "Camera access denied": "Доступ до камери заборонено",
  "Audio processing timed out. Please try again.":
    "Час обробки аудіо вичерпано. Спробуйте ще раз.",
  "Please select an AI psychologist before starting the call.":
    "Оберіть AI-психолога перед початком дзвінка.",

  "I'm listening. Please speak when you're ready.":
    "Я слухаю. Говоріть, коли будете готові.",
  "I'm here to listen and support you. Could you please share more about what's on your mind?":
    "Я тут, щоб слухати й підтримувати вас. Поділіться, будь ласка, тим, що зараз у вас на думці.",
  "I'm here to help. Please feel free to share what's on your mind.":
    "Я тут, щоб допомогти. Сміливо розкажіть, що вас хвилює.",

  // =========================
  // Общие UI-элементы и формы
  // =========================
  Cancel: "Скасувати",
  Save: "Зберегти",
  Delete: "Видалити",
  Edit: "Редагувати",
  Submit: "Надіслати",
  Send: "Надіслати",
  Back: "Назад",
  Next: "Далі",
  Previous: "Назад",
  Continue: "Продовжити",
  Finish: "Завершити",
  Yes: "Так",
  No: "Ні",
  OK: "OK",
  Settings: "Налаштування",
  Help: "Допомога",
  Search: "Пошук",
  Filter: "Фільтр",
  Sort: "Сортування",
  "Please wait...": "Будь ласка, зачекайте...",
  Retry: "Спробувати ще раз",
  Refresh: "Оновити",
  Update: "Оновити",
  Download: "Завантажити",
  Upload: "Завантажити",
  Share: "Поділитися",
  Copy: "Копіювати",
  Paste: "Вставити",
  Cut: "Вирізати",
  Undo: "Скасувати дію",
  Redo: "Повторити дію",
  Select: "Обрати",
  "Select All": "Обрати все",
  Clear: "Очистити",
  Reset: "Скинути",
  Apply: "Застосувати",
  Confirm: "Підтвердити",
  Approve: "Схвалити",
  Reject: "Відхилити",
  Accept: "Прийняти",
  Decline: "Відхилити",

  Email: "Email",
  "Enter your email": "Введіть свій email",
  "Enter your password": "Введіть пароль",
  "Enter your name": "Введіть імʼя",
  "Enter your message": "Введіть повідомлення",
  "Search...": "Пошук...",
  "Type here...": "Пишіть тут...",
  Required: "Обовʼязково",
  Optional: "Необовʼязково",
  "This field is required": "Це поле є обовʼязковим",
  "Please enter a valid email address": "Введіть коректний email",
  "Please enter a valid phone number": "Введіть коректний номер телефону",
  "Please enter a valid URL": "Введіть коректне посилання",
  "Please enter a valid date": "Введіть коректну дату",
  "Please enter a valid time": "Введіть коректний час",
  "Please select an option": "Оберіть варіант",
  "Please check this box": "Поставте позначку в цьому полі",
  "Please agree to the terms": "Погодьтеся з умовами",
  "Form submitted successfully": "Форму успішно надіслано",
  "Form submission failed": "Не вдалося надіслати форму",
  "Please correct the errors below": "Виправте помилки нижче",

  Success: "Успіх",
  Error: "Помилка",
  Warning: "Попередження",
  Information: "Інформація",
  Completed: "Завершено",
  "In Progress": "У процесі",
  Pending: "В очікуванні",
  Failed: "Неуспішно",
  Active: "Активно",
  Inactive: "Неактивно",
  Online: "Онлайн",
  Offline: "Офлайн",
  Available: "Доступно",
  Unavailable: "Недоступно",
  Enabled: "Увімкнено",
  Disabled: "Вимкнено",

  Today: "Сьогодні",
  Yesterday: "Вчора",
  Tomorrow: "Завтра",
  "This week": "Цього тижня",
  "Last week": "Минулого тижня",
  "Next week": "Наступного тижня",
  "This month": "Цього місяця",
  "Last month": "Минулого місяця",
  "Next month": "Наступного місяця",
  "This year": "Цього року",
  "Last year": "Минулого року",
  "Next year": "Наступного року",
  Now: "Зараз",
  Later: "Пізніше",
  Soon: "Скоро",
  Never: "Ніколи",
  Always: "Завжди",
  Sometimes: "Іноді",

  None: "Немає",
