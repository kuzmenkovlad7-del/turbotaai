# TurbotaAI Mobile App — Build & Release Guide

## Prerequisites

1. **Node.js** 18+ and npm
2. **Expo CLI**: `npm install -g expo-cli eas-cli`
3. **Apple Developer Account** (iOS) — $99/year
4. **Google Play Developer Account** (Android) — $25 one-time
5. **EAS Account**: `eas login`

## Project Setup

```bash
cd apps/mobile
npm install
```

## Environment Configuration

Create `.env` in `apps/mobile/`:

```
EXPO_PUBLIC_API_URL=https://turbotaai.com
```

## Development

```bash
# Start Expo dev server
npx expo start

# iOS simulator
npx expo start --ios

# Android emulator
npx expo start --android
```

## EAS Build Configuration

Create `eas.json` in `apps/mobile/`:

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_APPLE_ID",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-key.json"
      }
    }
  }
}
```

## iOS — TestFlight

### 1. Configure App Store Connect

- Create app record at [App Store Connect](https://appstoreconnect.apple.com)
- Bundle ID: `com.turbotaai.app`
- Enable In-App Purchases if using IAP

### 2. Build for iOS

```bash
# Internal testing build
eas build --platform ios --profile preview

# Production build
eas build --platform ios --profile production
```

### 3. Submit to TestFlight

```bash
eas submit --platform ios
```

### 4. TestFlight Testing

- Add internal testers in App Store Connect > TestFlight
- Testers receive email invitation to install via TestFlight app
- Internal builds don't require App Review

## Android — Play Store Internal Track

### 1. Configure Google Play Console

- Create app at [Google Play Console](https://play.google.com/console)
- Package name: `com.turbotaai.app`
- Upload signing key or let Google manage it

### 2. Create Service Account Key

- Go to Google Cloud Console > IAM > Service Accounts
- Create key for Play Store API access
- Download JSON key file
- Save as `apps/mobile/google-play-key.json` (gitignored)

### 3. Build for Android

```bash
# Internal testing build (APK)
eas build --platform android --profile preview

# Production build (AAB)
eas build --platform android --profile production
```

### 4. Submit to Play Store

```bash
eas submit --platform android
```

### 5. Internal Testing

- Go to Play Console > Testing > Internal testing
- Create a release with the uploaded AAB
- Add tester email addresses
- Testers can install from Play Store (with invite link)

## In-App Purchases Setup

### iOS (StoreKit)

1. App Store Connect > In-App Purchases
2. Create subscriptions:
   - `com.turbotaai.monthly` — Monthly auto-renewable
   - `com.turbotaai.yearly` — Yearly auto-renewable
3. Set pricing tiers
4. Create Subscription Group
5. For sandbox testing: Settings > App Store > Sandbox Account

### Android (Google Play Billing)

1. Play Console > Monetize > Subscriptions
2. Create subscriptions with matching product IDs
3. Set pricing
4. For testing: Play Console > License Testing > add tester emails

### Backend Receipt Validation

The endpoint `POST /api/billing/iap/validate` is scaffolded at:
`app/api/billing/iap/validate/route.ts`

**TODO before launch:**
- Implement Apple receipt verification (App Store Server API v2)
- Implement Google receipt verification (Google Play Developer API)
- Grant `access_grants` row on successful validation
- Handle subscription renewals and cancellations via server notifications

## Checklist

- [ ] `npm install` runs without errors
- [ ] App builds for iOS simulator
- [ ] App builds for Android emulator
- [ ] Login/register flow works against backend
- [ ] Chat screen sends messages and receives responses
- [ ] History screen loads past conversations
- [ ] Account screen shows subscription status
- [ ] IAP products load from App Store / Play Store
- [ ] Sandbox purchase completes (iOS)
- [ ] Test purchase completes (Android)
- [ ] Receipt validation endpoint processes receipts
- [ ] TestFlight build submitted and installable
- [ ] Play Store internal track build submitted and installable
