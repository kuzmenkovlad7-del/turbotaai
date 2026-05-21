# TurbotaAI — План исправлений перед QA и Android-релизом

> Дата: 2026-05-21  
> Приоритеты: P0 (критично, немедленно) → P1 (до Android-релиза) → P2 (после релиза)

---

## P0 — Критические: нужно исправить до продолжения тестирования

### P0-1: API-ключ Tavily в n8n workflow (утечка секрета)

**Проблема:** Ключ Tavily API (`tvly-dev-*`) жёстко прошит в экспортированном n8n workflow JSON (`docs/private-qa/TurbotaAI Psychologist Agent.json`). Если этот файл утечёт — ключ скомпрометирован.

**Действие:**
1. Немедленно ротировать Tavily API Key в личном кабинете Tavily
2. В n8n перенести ключ в Credential Store (не хранить в workflow JSON)
3. Убедиться, что workflow JSON не хранится в публичном git-репозитории

**Файлы:** `docs/private-qa/TurbotaAI Psychologist Agent.json`

---

### P0-2: Webhook proxy без аутентификации (SSRF риск)

**Проблема:** Эндпоинт `POST /api/webhook-proxy` принимает произвольный `webhookUrl` и делает от имени сервера HTTP-запрос на любой URL без аутентификации вызывающей стороны и без whitelist разрешённых хостов. Это потенциальный SSRF (Server-Side Request Forgery).

**Действие:**
1. Добавить проверку Bearer-токена или другую аутентификацию
2. Либо добавить whitelist разрешённых хостов (только n8n/внутренние сервисы)
3. Либо полностью удалить эндпоинт если он не используется в production

**Файлы:** `app/api/webhook-proxy/route.ts`

---

## P1 — Важные: нужно исправить до публичного Android-релиза

### P1-1: Отсутствует crash-аналитика

**Проблема:** В production нет Sentry, Firebase Crashlytics или аналогов. Ошибки и крэши в production остаются невидимыми.

**Действие:**
1. Добавить Sentry (рекомендуется для React Native + Next.js) или Firebase Crashlytics
2. Подключить к мобильному приложению: `apps/mobile`
3. Подключить к Next.js серверу: `next.config.mjs`

**Файлы:** `apps/mobile/src/services/analytics.ts`, `next.config.mjs`

---

### P1-2: Нет staging Supabase-окружения

**Проблема:** Тестировщики работают с той же production базой Supabase. Ошибки тестирования могут затронуть prod-данные. Нет возможности безопасно тестировать reset trial, оплату и удаление аккаунтов.

**Действие:**
1. Создать отдельный Supabase проект для staging
2. Добавить staging env в `eas.json` (preview profile)
3. Добавить `NEXT_PUBLIC_SUPABASE_URL_STAGING` и соответствующие ключи

**Файлы:** `apps/mobile/eas.json`, `.env.staging`

---

### P1-3: Нет rate limit на неверный пароль в `/api/auth/login`

**Проблема:** Эндпоинт входа не имеет собственного rate limit. Защита зависит от настроек Supabase (не гарантирована).

**Действие:**
1. Добавить простой rate limit (например, через Vercel KV или upstash/redis): N попыток за T секунд по IP
2. Или настроить Supabase Auth → Settings → Rate Limits

**Файлы:** `app/api/auth/login/route.ts`

---

### P1-4: Mobile analytics отсутствует в production

**Проблема:** `apps/mobile/src/services/analytics.ts` — только `console.log` в dev. Нет трекинга событий, воронок, ошибок в production.

**Действие:**
1. Добавить минимальный трекер (например, Expo Analytics или PostHog)
2. Отслеживать ключевые события: registration, login, trial_exhausted, purchase, voice_call_started, video_call_started

**Файлы:** `apps/mobile/src/services/analytics.ts`

---

### P1-5: Отсутствует email-подтверждение — нет защиты от фейковых аккаунтов

**Проблема:** Принудительное подтверждение email при регистрации (`email_confirm: true`) позволяет регистрировать аккаунты с несуществующими email-адресами. Восстановление пароля не будет работать для таких аккаунтов.

**Действие (продуктовое решение):**  
Если email-подтверждение намеренно отключено (для снижения барьера входа) — это нужно зафиксировать как известное ограничение в документации.  
Если планируется включить — изменить логику в `app/api/auth/register/route.ts`.

**Файлы:** `app/api/auth/register/route.ts`

---

### P1-6: Android — молчание VAD может быть ненадёжным

**Проблема:** В `useVideoSession.ts` есть `manualStop` API (дополнительная кнопка для Android), что указывает на известную нестабильность автоматической детекции тишины на Android. Тестировщики сообщили о проблемах с задержками.

**Действие:**
1. Убедиться что кнопка "Завершить вручную" всегда видна на Android в видео/голос экранах
2. Проверить параметры записи на Android (возможна несовместимость кодека)
3. Рассмотреть снижение `SILENCE_AFTER_MS` с 4500мс до 3000мс

**Файлы:** `apps/mobile/src/hooks/useVoiceSession.ts`, `apps/mobile/src/hooks/useVideoSession.ts`

---

## P2 — Могут быть улучшены после релиза

### P2-1: Прерывание речи (barge-in)

**Проблема:** Нет возможности прервать ответ ИИ и задать новый вопрос.

**Действие:** Реализовать VAD поверх TTS: если пользователь начинает говорить — остановить воспроизведение и начать запись.

---

### P2-2: Оптимизация задержки голосового pipeline

**Проблема:** Полная задержка 8–15 секунд субъективно ощущается медленно.

**Действие:**
1. Уменьшить `SILENCE_AFTER_MS` до 2500–3000мс (для коротких ответов)
2. Использовать streaming TTS если OpenAI поддерживает
3. Рассмотреть более быструю STT-модель (например, Whisper turbo)

---

### P2-3: Нет поддержки deep linking для password reset на мобиле

**Проблема:** Ссылка сброса пароля открывает браузер, а не возвращает в приложение автоматически.

**Действие:** Настроить Universal Links (iOS) / App Links (Android) для домена turbotaai.com.

---

### P2-4: История голос/видео не сохраняется

**Проблема:** Разговоры в голосовом и видеорежимах могут не сохраняться в Supabase с тем же качеством что чат.

**Действие:** Убедиться что `mode: "voice"` и `mode: "video"` корректно записываются в `conversations`.

---

### P2-5: Нет принудительного обновления приложения

**Проблема:** При критических изменениях бэкенда нет механизма форс-апдейта.

**Действие:** Добавить endpoint проверки минимальной версии и диалог обновления в `useAuth`.

---

## Сводка

| Код | Описание | Приоритет | Файл |
|---|---|---|---|
| P0-1 | Ротировать Tavily API Key, вынести в Credential Store | P0 | n8n workflow |
| P0-2 | Защитить или удалить `/api/webhook-proxy` | P0 | `app/api/webhook-proxy/route.ts` |
| P1-1 | Добавить Sentry/Crashlytics | P1 | `apps/mobile/src/services/analytics.ts` |
| P1-2 | Staging Supabase окружение | P1 | `apps/mobile/eas.json` |
| P1-3 | Rate limit на `/api/auth/login` | P1 | `app/api/auth/login/route.ts` |
| P1-4 | Mobile production analytics | P1 | `apps/mobile/src/services/analytics.ts` |
| P1-5 | Решить вопрос email-подтверждения | P1 | `app/api/auth/register/route.ts` |
| P1-6 | Надёжность VAD на Android | P1 | `apps/mobile/src/hooks/useVoiceSession.ts` |
| P2-1 | Barge-in / прерывание речи | P2 | useVoiceSession / useVideoSession |
| P2-2 | Оптимизация latency pipeline | P2 | useVoiceSession, /api/stt, n8n |
| P2-3 | Deep linking password reset | P2 | app.json, reset-password page |
| P2-4 | История голос/видео | P2 | useVoiceSession, useVideoSession |
| P2-5 | Force update механизм | P2 | useAuth.ts |
