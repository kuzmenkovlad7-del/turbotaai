# TurbotaAI — Технический отчёт для внешнего QA

> Версия: 2026-05-21  
> Статус: Для внешних тестировщиков (без секретов)

---

## 1. Архитектура системы

### Мобильное приложение
- **Фреймворк**: React Native + Expo SDK 52
- **Язык**: TypeScript
- **Сборка**: EAS (Expo Application Services) — профили dev / preview / production-ios / production-android
- **Bundle ID**: `com.turbotaai.app` (iOS и Android)
- **Навигация**: @react-navigation/native с tab-навигатором
- **Хранение токенов**: expo-secure-store (Keychain на iOS, Keystore на Android)
- **Языки**: украинский (uk), русский (ru), английский (en)
- **Analytics мобиль**: только console.log в DEBUG-режиме; внешний SDK не подключён

### Backend (сервер)
- **Фреймворк**: Next.js 14+ App Router (TypeScript)
- **Деплой**: Vercel (serverless functions)
- **API-маршруты**: `/app/api/` — чат, STT, TTS, аутентификация, биллинг, история, аккаунт, подписка

### Аутентификация
- **Провайдер**: Supabase Auth (email + password)
- **Токены**: Bearer JWT в Authorization-заголовке (мобиль) + Supabase session cookies (web)
- **Email-подтверждение**: программно пропускается при регистрации через API (`email_confirm: true`)
- **Восстановление пароля**: Supabase отправляет email → ссылка ведёт на `https://turbotaai.com/reset-password`

### База данных / хранилище
- **СУБД**: Supabase PostgreSQL
- **Таблицы**:
  - `profiles` — профиль пользователя, `paid_until`, `promo_until`, статус подписки
  - `access_grants` — контроль доступа: `device_hash`, `user_id`, `trial_questions_left`, `paid_until`, `promo_until`
  - `conversations` + `messages` — история чатов
  - `billing_orders` — журнал платёжных транзакций

### Путь AI-запроса (чат / голос / видео)
```
Клиент → POST /api/turbotaai-agent → requireAccess() → n8n webhook → AI Agent → OpenAI GPT → ответ
```
1. Клиент отправляет текст + метаданные (sessionId, userId, language, gender, mode, characterId)
2. Сервер проверяет доступ (`requireAccess`), списывает один вопрос из trial-баланса
3. Запрос проксируется в n8n webhook (`TURBOTA_AGENT_WEBHOOK_URL`)
4. n8n: Webhook → AI Agent → OpenAI GPT (gpt-5.1-chat-latest) → Respond to Webhook
5. Ответ возвращается клиенту; сервер также возвращает `remainingQuestions` для синхронизации счётчика

### Роль n8n
- Вся логика AI-агента живёт в n8n workflow
- Системный промпт — внутри n8n (не в коде приложения)
- Память/контекст — до 60 последних ходов через `memoryBufferWindow`
- Ключ памяти: `turbota:v12:u:{userId}:s:{sessionId}` (для авторизованных) или `turbota:v12:g:{guestId}:s:{sessionId}` (гостевой)
- Инструменты агента: OpenAI Chat + Tavily (веб-поиск)

### Различия чат / голос / видео

| Параметр | Чат | Голос | Видео |
|---|---|---|---|
| Ввод | Текстовый | Mic → STT | Mic → STT |
| Вывод | Текст на экране | TTS → аудио | TTS → аудио |
| Аватар | Нет | Нет (орб) | Pre-recorded MP4 (idle/speaking) |
| mode в запросе | `"chat"` | `"voice"` | `"video"` |
| characterId | Нет | Нет | `dr-maria`, `dr-sophia`, `dr-alexander` |
| Молчание → отправка | N/A | Авто (4500мс) | Авто (4500мс) |

**Анимация видео-аватара**: два предзаписанных MP4 (idle / speaking). Переключение управляется фазой `"speaking"` в useVideoSession. Реальная lip-sync или генерация видео в реальном времени отсутствует.

### Путь голос/STT/TTS

**STT (Speech-to-Text)**:
- Запись: expo-av (M4A, 16кГц, 1 канал, 128kbps, макс 60с)
- API: `POST /api/stt` → OpenAI Whisper (`whisper-1`)
- Фильтрация: тихие/мусорные транскрипты отбрасываются без ошибки
- Детекция тишины: -35dB активная речь, -45dB тишина, 4500мс ожидания после речи

**TTS (Text-to-Speech)**:
- API: `POST /api/tts` → OpenAI TTS (`gpt-4o-mini-tts`)
- Голоса: FEMALE → "nova" (по умолчанию), MALE → "onyx" (по умолчанию), настраивается через env
- Возвращает base64-WAV
- Чанкинг: разбивка на предложения ≤200 символов с параллельным prefetch

### Подписка / оплата

**Web (WayForPay)**:
- Только для Украины; создаётся инвойс через API WayForPay
- Webhook подписан HMAC-MD5 (`WAYFORPAY_SECRET_KEY`)
- При успешной оплате `paid_until` увеличивается на 30 или 365 дней
- Планы: 499 UAH / месяц, 3999 UAH / год

**Mobile (In-App Purchase)**:
- iOS: StoreKit (react-native-iap), продукт `com.turbotaai.monthly`
- Android: Google Play Billing v5+ (subscriptionOffers + offerToken)
- Валидация: `POST /api/billing/iap/validate` → Apple/Google серверная проверка
- Восстановление покупок: iOS через StoreKit restore; Android через Google Play

### Лимит пробного периода (trial)

- Лимит: 5 вопросов (env `TRIAL_QUESTIONS_LIMIT`, по умолчанию 5)
- Хранение: поле `trial_questions_left` в таблице `access_grants` (на сервере)
- Привязка: к `device_hash` (гость) или к `account:{userId}` (авторизованный)
- При каждом запросе к `/api/turbotaai-agent` счётчик уменьшается на 1
- При исчерпании сервер возвращает HTTP 402 `payment_required`
- Приложение показывает paywall-блокировку

### Путь восстановления пароля

1. Пользователь нажимает "Забыл пароль" → вводит email
2. `supabase.auth.resetPasswordForEmail(email)` → Supabase отправляет письмо
3. Ссылка в письме ведёт на `https://turbotaai.com/reset-password`
4. Страница читает токены из URL hash (`#access_token=...&type=recovery`)
5. Вызов `supabase.auth.setSession()` → `supabase.auth.updateUser({ password })`

---

## 2. Текущие ограничения

1. **Crashlytics отсутствует**: нет Sentry, Firebase Crashlytics или аналогов
2. **Нет staging-окружения**: используется единственная prod-база Supabase; env-разделение только на уровне EAS build profiles
3. **Email-подтверждение отключено**: логика регистрации принудительно подтверждает email в обход стандартного flow Supabase
4. **Rate limit на неверный пароль**: не реализован в коде приложения; зависит от встроенных лимитов Supabase
5. **Перебивание речи**: не реализовано — TTS воспроизводится до конца, микрофон открывается заново только после паузы 350мс
6. **Mobile analytics**: только console.log в dev-режиме; в production нет трекинга событий и ошибок
7. **Vercel serverless**: нет постоянного процесса; каждый запрос — новый контейнер; stateful-память в n8n, не на сервере

---

## 3. Безопасность

- Токены хранятся в expo-secure-store (нативный keychain/keystore)
- WayForPay webhook проверяется по HMAC-MD5 подписи
- Apple/Google IAP проходит серверную валидацию
- API Keys и system prompt не публикуются в этом отчёте
- Webhook proxy (`/api/webhook-proxy`) не требует аутентификации — потенциальный SSRF-риск

---

*Отчёт подготовлен для внешнего QA. Секреты, ключи API, системный промпт и детали n8n workflow намеренно исключены.*
