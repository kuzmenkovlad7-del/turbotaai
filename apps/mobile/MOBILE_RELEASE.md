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
├── App.tsx                          # Root: SafeAreaProvider + StatusBar + Navigator
├── index.ts                         # Entry: registerRootComponent(App)
├── app.json                         # Expo config (SDK 52, permissions, plugins)
├── babel.config.js                  # @/ alias via module-resolver
├── eas.json                         # EAS build profiles (dev/preview/prod)
├── package.json                     # Deps: expo, react-navigation, supabase-js
├── tsconfig.json                    # Extends expo/tsconfig.base, strict
├── .env.example                     # Required env vars template
├── assets/                          # Placeholder PNGs (replace before publish)
└── src/
    ├── constants/
    │   ├── config.ts                # API_URL, SUPABASE_URL, IAP_ENABLED flag
    │   └── theme.ts                 # colors, spacing, radii, fontSize tokens
    ├── services/
    │   ├── supabase.ts              # Supabase JS client: signIn, signUp, signOut, refreshSession
    │   ├── api.ts                   # apiFetch (Bearer token), bootstrap, history, chat
    │   └── storage.ts              # SecureStore: tokens, deviceHash, UUID gen
    ├── hooks/
    │   ├── useAuth.ts               # Auth state, bootstrap, session restore on mount
    │   └── useSubscription.ts       # IAP feature flag, purchase/restore stubs
    ├── components/
    │   ├── ScreenWrapper.tsx         # SafeArea wrapper with theme background
    │   ├── Button.tsx               # 5 variants: primary/secondary/outline/danger/ghost
    │   ├── Input.tsx                # Label + error + forwarded ref
    │   └── EmptyState.tsx           # Icon + title + subtitle centered
    ├── navigation/
    │   └── AppNavigator.tsx         # AuthStack (Login/Register) | AppStack (Tabs+Chat+Detail)
    └── screens/
        ├── LoginScreen.tsx          # Email/password, keyboard handling, error display
        ├── RegisterScreen.tsx       # Email/password/confirm, validation
        ├── HomeScreen.tsx           # Access badge, card grid, quick actions
        ├── ChatScreen.tsx           # Message bubbles, safe-area insets, send button
        ├── HistoryScreen.tsx        # Pull-to-refresh, relative dates, navigate to detail
        ├── ConversationDetailScreen.tsx  # Load + display conversation messages
        └── AccountScreen.tsx        # Avatar, subscription status, sign out, IAP buttons
```

### Backend Endpoint (new)

`GET /api/mobile/bootstrap` — single call that resolves user + access state.

- **Headers**: `Authorization: Bearer <supabase_access_token>`, `X-Device-Hash: <uuid>`
- **Returns**: `{ ok, isLoggedIn, userId, email, deviceHash, access, hasAccess, unlimited, trial_questions_left, paid_until, subscription_status, auto_renew }`
- **File**: `app/api/mobile/bootstrap/route.ts`

### Auth Flow

Mobile does NOT use the web cookie-based auth endpoints (`/api/auth/*`). Instead:

1. **Sign in/up**: Supabase JS SDK → `signInWithPassword()` / `signUp()`
2. **Token storage**: `expo-secure-store` (Keychain on iOS, Keystore on Android)
3. **Session restore**: On app launch, read refresh token from SecureStore → `setSession()` → `refreshSession()`
4. **API calls**: All requests include `Authorization: Bearer <token>` + `X-Device-Hash` header

### IAP Feature Flag

`EXPO_PUBLIC_IAP_ENABLED=false` (default) hides all purchase buttons and shows a "visit turbotaai.com" note. When `true`, purchase buttons appear but `react-native-iap` must be added as a dependency and the app must run via a dev/preview build (not Expo Go).

---

## Prerequisites

1. **Node.js** 18+ and npm
2. **Expo CLI**: `npm install -g eas-cli`
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

## Manual Test Plan (5-7 minutes)

### Auth Flow
- [ ] App shows branded splash screen on launch
- [ ] Login screen renders: logo, email, password, sign-in button, register link
- [ ] Empty email → shows "Please enter your email" error
- [ ] Empty password → shows "Please enter your password" error
- [ ] Wrong credentials → shows server error message
- [ ] Correct credentials → navigates to Home
- [ ] Register link → navigates to Register screen
- [ ] Register: mismatched passwords → shows validation error
- [ ] Register: valid data → creates account (or shows "check email" if email confirmation on)
- [ ] Kill app and reopen → session restored, goes straight to Home

### Home Screen
- [ ] Shows access badge (Premium / Trial / Free)
- [ ] "Chat with AI" card → navigates to Chat
- [ ] "History" card → switches to History tab
- [ ] "Account" card → switches to Account tab

### Chat Screen
- [ ] Header shows "AI Assistant" with back button
- [ ] Empty state shows prompt text
- [ ] Type message + send → message appears in user bubble (right)
- [ ] AI response appears in assistant bubble (left) with "TurbotaAI" label
- [ ] Send button disabled while sending
- [ ] Keyboard doesn't cover input area (safe area insets)

### History Screen
- [ ] Shows list of past conversations (or empty state)
- [ ] Pull-to-refresh reloads list
- [ ] Tap conversation → opens ConversationDetail with messages
- [ ] Relative dates display correctly (Just now, Xh ago, Yesterday)

### Account Screen
- [ ] Shows avatar circle with email initial
- [ ] Shows email address
- [ ] Subscription status card (Premium Active / Trial / No Plan)
- [ ] IAP buttons hidden when `IAP_ENABLED=false`
- [ ] Sign Out → confirmation alert → returns to Login
- [ ] After sign out, reopening app shows Login (no session)

### Navigation
- [ ] Bottom tabs: Home, History, Account — all switch correctly
- [ ] Tab icons highlight when active
- [ ] Back navigation from Chat → Home works
- [ ] Back navigation from ConversationDetail → History works

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

### To Enable IAP (After Store Accounts Ready)
- [ ] Set `EXPO_PUBLIC_IAP_ENABLED=true` in `.env`
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

## TODO: IAP Implementation (When Store Accounts Are Ready)

Currently `EXPO_PUBLIC_IAP_ENABLED=false` — purchase buttons are hidden and the app runs in Expo Go. Here is the exact sequence of code changes needed later:

### Step 1: Switch from Expo Go to Dev Build
```bash
npx expo install react-native-iap expo-dev-client
eas build --platform ios --profile development
eas build --platform android --profile development
# After build completes, install .app/.apk on device
npx expo start --dev-client
```

### Step 2: Create Store Products
- **iOS**: App Store Connect → In-App Purchases → create `com.turbotaai.monthly` and `com.turbotaai.yearly` as auto-renewable subscriptions
- **Android**: Google Play Console → Monetize → Subscriptions → create matching product IDs

### Step 3: Implement Purchase Flow in `useSubscription.ts`
Replace the TODO block in `purchase()` with:
```typescript
import { requestSubscription, getSubscriptions } from "react-native-iap"

// In purchase():
const subscription = await requestSubscription({ sku: productId })
const receipt = Platform.OS === "ios"
  ? subscription.transactionReceipt
  : subscription.purchaseToken
await api.validateReceipt({ platform, productId, transactionReceipt: receipt })
// Then call refreshAccess() from useAuth to update access status
```

### Step 4: Implement Backend Receipt Validation
File: `app/api/billing/iap/validate/route.ts` (already scaffolded, returns 501)

**iOS** — use [App Store Server API v2](https://developer.apple.com/documentation/appstoreserverapi):
- Verify receipt with Apple servers
- On success: update `access_grants` row — set `paid_until` to subscription expiry date

**Android** — use [Google Play Developer API](https://developers.google.com/android-publisher):
- Verify purchase token with Google servers
- On success: update `access_grants` row — set `paid_until` to subscription expiry date

### Step 5: Server-to-Server Notifications
- **iOS**: Configure App Store Server Notifications (v2) → point to a new endpoint like `POST /api/billing/iap/apple-webhook`
- **Android**: Configure Real-time Developer Notifications → point to `POST /api/billing/iap/google-webhook`
- Handle: renewal, cancellation, refund, billing retry

### Step 6: Enable IAP
```bash
# In apps/mobile/.env:
EXPO_PUBLIC_IAP_ENABLED=true
```

---

## Branch & Merge Instructions

- **Branch**: `claude/review-repo-files-o8zu7`
- **Base**: merge into your main branch
- **Review**: check `app/api/mobile/bootstrap/route.ts` (new backend endpoint) + `tsconfig.json` (added `apps/mobile` to exclude)
- **Web impact**: None — mobile is isolated in `apps/mobile/`, bootstrap endpoint is additive, web auth unchanged
