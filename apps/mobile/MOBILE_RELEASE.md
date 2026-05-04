# TurbotaAI Mobile App — Architecture, Testing & Release

## Quick Start (3 commands)

```bash
cd apps/mobile
cp .env.example .env        # then edit .env with real Supabase values (see below)
npm install
npx expo start              # scan QR with Expo Go on your phone
```

**Where to create `.env`**: `apps/mobile/.env` (same directory as `package.json`).

**Required values** — get from your Supabase project dashboard (Settings → API):

| Variable | Where to find | Example |
|----------|--------------|---------|
| `EXPO_PUBLIC_API_URL` | Your deployed web app URL | `https://turbotaai.com` |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | `https://abc123.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key | `eyJhbGci...` |
| `EXPO_PUBLIC_IAP_ENABLED` | Keep `false` until store accounts ready | `false` |

---

## Architecture Overview

```
apps/mobile/
├── App.tsx                          # Root: LanguageContext + SafeArea + Navigator
├── index.ts                         # Entry: registerRootComponent(App)
├── app.json                         # Expo config (SDK 52, permissions, plugins)
├── babel.config.js                  # @/ alias via module-resolver
├── eas.json                         # EAS build profiles (dev/preview/prod) + submit config
├── package.json                     # Deps: expo, react-navigation, supabase-js
├── tsconfig.json                    # Extends expo/tsconfig.base, strict
├── .env.example                     # Required env vars template
├── assets/                          # Placeholder PNGs (replace before publish)
└── src/
    ├── constants/
    │   ├── config.ts                # API_URL, SUPABASE_URL, IAP_ENABLED flag, STORAGE_KEYS
    │   ├── theme.ts                 # colors, spacing, radii, fontSize tokens
    │   └── i18n.ts                  # Translations for en, uk, ru (all UI strings)
    ├── services/
    │   ├── supabase.ts              # Supabase JS client: signIn, signUp, signOut, refreshSession
    │   ├── api.ts                   # apiFetch (Bearer token), bootstrap, history, chat, saveConversation
    │   └── storage.ts              # SecureStore: tokens, deviceHash, UUID gen
    ├── hooks/
    │   ├── useAuth.ts               # Auth state, bootstrap, session restore on mount
    │   ├── useLanguage.ts           # LanguageContext, device-locale detection, SecureStore persistence
    │   └── useSubscription.ts       # IAP feature flag, purchase/restore stubs
    ├── components/
    │   ├── ScreenWrapper.tsx         # SafeArea wrapper with theme background
    │   ├── Button.tsx               # 5 variants: primary/secondary/outline/danger/ghost
    │   ├── Input.tsx                # Label + error + forwarded ref
    │   └── EmptyState.tsx           # Icon + title + subtitle centered
    ├── navigation/
    │   └── AppNavigator.tsx         # AuthStack (Login/Register) | AppStack (Tabs+Chat+Detail)
    └── screens/
        ├── LoginScreen.tsx          # Email/password, keyboard handling, error display, i18n
        ├── RegisterScreen.tsx       # Email/password/confirm, validation, i18n
        ├── HomeScreen.tsx           # Access badge, card grid, quick actions, i18n
        ├── ChatScreen.tsx           # Message bubbles, safe-area insets, history save, i18n
        ├── HistoryScreen.tsx        # Pull-to-refresh, relative dates, error+retry, i18n
        ├── ConversationDetailScreen.tsx  # Load + display conversation messages
        └── AccountScreen.tsx        # Avatar, subscription, sign out, language picker, IAP
```

### i18n

- **Supported locales**: English (`en`), Ukrainian (`uk`), Russian (`ru`)
- **Device-locale detection**: Uses `expo-localization` → `getLocales()[0].languageCode`
  - `uk*` → Ukrainian, `ru*` → Russian, else → English
- **Persistence**: Chosen locale saved to SecureStore (`turbotaai_language`)
- **Language picker**: 3-button row in Account screen
- **Coverage**: Login, Register, Home, Chat, History, Account, tab labels, error messages

### Backend Endpoint (new)

`GET /api/mobile/bootstrap` — single call that resolves user + access state.

- **Headers**: `Authorization: Bearer <supabase_access_token>`, `X-Device-Hash: <uuid>`
- **Returns**: `{ ok, isLoggedIn, userId, email, deviceHash, access, hasAccess, unlimited, trial_questions_left, paid_until, subscription_status, auto_renew }`
- **File**: `app/api/mobile/bootstrap/route.ts`

### Auth Flow

Mobile does NOT use the web cookie-based auth endpoints (`/api/auth/*`). Instead:

1. **Sign in/up**: Supabase JS SDK → `signInWithPassword()` / `signUp()`
2. **Token storage**: `expo-secure-store` (Keychain on iOS, Keystore on Android)
3. **Session restore**: On app launch, read refresh token from SecureStore → `refreshSession()`
4. **API calls**: All requests include `Authorization: Bearer <token>` + `X-Device-Hash` header

### IAP Feature Flag

`EXPO_PUBLIC_IAP_ENABLED=false` (default) hides all purchase buttons and shows a "visit turbotaai.com" note. When `true`, purchase buttons appear but `react-native-iap` must be added as a dependency and the app must run via a dev/preview build (not Expo Go).

---

## Prerequisites

1. **Node.js** 18+ and npm
2. **EAS CLI**: `npm install -g eas-cli`
3. **macOS** for iOS builds (Xcode 15+)
4. **Android Studio** (optional, for Android emulator)

## Local Development Setup

### 1. Environment

```bash
cd apps/mobile
cp .env.example .env
```

Edit `.env`:
```
EXPO_PUBLIC_API_URL=https://turbotaai.com
EXPO_PUBLIC_SUPABASE_URL=<your-supabase-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
EXPO_PUBLIC_IAP_ENABLED=false
```

Get Supabase values from the project dashboard (Settings → API).

### 2. Install Dependencies

```bash
npm install
```

### 3. Run with Expo Go

```bash
npx expo start
```

- **iPhone**: Install "Expo Go" from App Store → scan QR code
- **Android**: Install "Expo Go" from Play Store → scan QR code
- **iOS Simulator**: Press `i` in terminal (requires Xcode)
- **Android Emulator**: Press `a` in terminal (requires Android Studio + AVD)

### 4. Run with Dev Build (for native modules)

```bash
npx expo install expo-dev-client
eas build --platform ios --profile development
# Install the resulting .app on simulator
npx expo start --dev-client
```

---

## EAS Build Configuration

### eas.json Profiles

| Profile | Purpose | Distribution | Notes |
|---------|---------|-------------|-------|
| `development` | Local dev with expo-dev-client | internal | iOS simulator enabled |
| `preview` | Internal testing on real devices | internal | Install via QR/link |
| `production` | Store submission | store | Final builds for App Store / Google Play |

### Build Commands

```bash
cd apps/mobile

# Development build (installs on simulator / internal device)
eas build --platform android --profile development
eas build --platform ios --profile development

# Preview build (share with testers via link)
eas build --platform android --profile preview
eas build --platform ios --profile preview

# Production build (submit to stores)
eas build --platform android --profile production
eas build --platform ios --profile production
```

### Submit to Stores

```bash
# iOS: submit to TestFlight / App Store
eas submit --platform ios

# Android: submit to Google Play internal track
eas submit --platform android
```

### EAS Secrets (set once per project)

```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://turbotaai.com"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "<your-url>"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<your-key>"
```

### Submit Config

Before first submission, update `eas.json` → `submit.production`:

- **iOS**: Replace `APPLE_ID_HERE`, `ASC_APP_ID_HERE`, `APPLE_TEAM_ID_HERE` with real values from Apple Developer portal
- **Android**: Create a Google Play service account → download JSON key → save as `apps/mobile/google-play-key.json`

---

## Manual Test Plan

### Auth Flow
- [ ] App shows branded splash screen on launch
- [ ] Login screen renders in device language (en/uk/ru)
- [ ] Empty email → shows localized error
- [ ] Empty password → shows localized error
- [ ] Wrong credentials → shows server error message
- [ ] Correct credentials → navigates to Home
- [ ] Register link → navigates to Register screen
- [ ] Register: mismatched passwords → shows validation error
- [ ] Kill app and reopen → session restored, goes straight to Home

### Home Screen
- [ ] Greeting shows in selected language
- [ ] Access badge shows (Premium / Trial / No access) in selected language
- [ ] "Chat with AI" card → navigates to Chat
- [ ] "History" card → switches to History tab
- [ ] "Account" card → switches to Account tab

### Chat Screen
- [ ] Empty state text in selected language
- [ ] Type message + send → user bubble (right), AI bubble (left)
- [ ] Send button disabled while sending
- [ ] Conversation saved to history (check History tab after)

### History Screen
- [ ] Shows conversations with relative dates in selected language
- [ ] Pull-to-refresh reloads list
- [ ] Tap conversation → opens detail with messages
- [ ] Error state with retry button when offline

### Account Screen
- [ ] Email + avatar circle displayed
- [ ] Language picker: tap a language → all UI text changes immediately
- [ ] Language persists across app restart
- [ ] Subscription status shown in selected language
- [ ] Sign Out → confirmation in selected language → returns to Login

### Navigation
- [ ] Bottom tabs labeled in selected language
- [ ] All tab switches work
- [ ] Back from Chat → Home, back from Detail → History

---

## What Vlad Must Do Manually

### Before First Local Test
- [ ] Get Supabase project URL and anon key from dashboard
- [ ] Create `apps/mobile/.env` with real values (copy from `.env.example`)
- [ ] Run `cd apps/mobile && npm install`
- [ ] Run `npx expo start` and scan QR with Expo Go

### Before Store Submission
- [ ] **Apple Developer Account** ($99/year) — enroll at developer.apple.com
- [ ] **Google Play Developer Account** ($25 one-time) — enroll at play.google.com/console
- [ ] **Replace placeholder assets**: `icon.png` (1024×1024), `splash.png` (1284×2778), `adaptive-icon.png` (1024×1024) — see [Expo icon guide](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)
- [ ] **Set bundle ID**: Update `app.json` → `ios.bundleIdentifier` and `android.package` (currently `com.turbotaai.app`)
- [ ] **Create EAS account**: `npx eas login` (free Expo account)
- [ ] **Update `eas.json`**: Fill in Apple Team ID, ASC App ID in submit config
- [ ] **Create Google Play service account key**: IAM → Service Accounts → download JSON → save as `google-play-key.json`
- [ ] **Set EAS secrets**: Run the `eas secret:create` commands above

### To Enable IAP (After Store Accounts Ready)
- [ ] Set `EXPO_PUBLIC_IAP_ENABLED=true` in `.env` and EAS secrets
- [ ] Add `react-native-iap` to dependencies: `npx expo install react-native-iap`
- [ ] Create IAP products in App Store Connect: `com.turbotaai.monthly`, `com.turbotaai.yearly`
- [ ] Create matching subscriptions in Google Play Console
- [ ] Implement Apple receipt verification in `POST /api/billing/iap/validate` (App Store Server API v2)
- [ ] Implement Google receipt verification (Google Play Developer API)
- [ ] Set up server-to-server notifications for renewal/cancellation
- [ ] Test with sandbox accounts (iOS: Settings → App Store → Sandbox; Android: license testers)

### To Publish
```bash
cd apps/mobile

# iOS: build + submit to TestFlight
eas build --platform ios --profile production
eas submit --platform ios

# Android: build + submit to internal track
eas build --platform android --profile production
eas submit --platform android
```

---

## App Store Review Notes (build 1.0.0 / 4+)

### Test account
Use the sandbox credentials provided in App Store Connect → App Review → Notes.

### Subscription (Guideline 2.1b)
- The only IAP product referenced in code is `com.turbotaai.monthly` (matching App Store Connect exactly).
- Promo code UI is hidden on iOS via `Platform.OS !== "ios"` — it never appears in a store build.
- Tap **Account** tab → the Subscribe button loads the App Store product. If IAP is disabled (`EXPO_PUBLIC_IAP_ENABLED=false`) a neutral "coming soon" notice is shown instead.

### Account Deletion (Guideline 5.1.1v)
- Tap **Account** tab → scroll to the bottom → **"Delete Account"** card is visible for logged-in users.
- Tap the button → confirmation alert ("Delete your account?") appears.
- Confirm → account is permanently deleted via `DELETE /api/user/delete` (Supabase auth user + profile row removed). The app returns to the login screen immediately.
- The feature is available without a subscription.

### AI Data Sharing Consent (Guidelines 5.1.1i / 5.1.2i)
- On first use of Chat, Voice, or Video AI features a full-screen modal ("AI Data Processing") is shown **before** any data is sent.
- The modal identifies **OpenAI (openai.com)** as the AI provider, states what data is sent (messages, voice input), and explains the purpose (generate AI responses only).
- Tapping **"I Agree — Continue"** stores consent in Secure Store; the modal will not appear again.
- Tapping **"Not Now"** dismisses the modal without sending any data. The user can still browse the app; the modal re-appears the next time they attempt an AI action.
- To test: delete and reinstall the app (or clear app data) → tap Chat → modal appears before any message is sent.

---

## Branch & Merge Instructions

- **Branch**: `claude/review-repo-files-o8zu7`
- **Base**: merge into your main branch
- **Review**: check `app/api/mobile/bootstrap/route.ts` (new backend endpoint) + `tsconfig.json` (added `apps/mobile` to exclude)
- **Web impact**: `components/video-call-dialog.tsx` (avatar flash fix — 3 lines), `components/footer.tsx` (store badges — additive). Web auth unchanged.
