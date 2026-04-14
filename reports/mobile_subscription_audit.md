# Mobile Subscription Audit — TurbotaAI
**Date:** 2026-04-14  
**Scope:** Android closed testing build — subscription/account/access-sync issues  
**Status:** Report only. No code has been changed.

---

## 1. Executive Summary

The production Android build (`production-android` EAS profile) has four distinct problems that together make subscriptions non-functional and the Account screen misleading:

1. **Two subscription buttons are shown** (Monthly + Yearly) but only one plan (Monthly) has ever existed on the web or in intended business logic. Yearly is a dead stub.
2. **Google Play throws a hard error** every time a user taps either button: `subscriptionOffers are required for Google Play subscriptions`. This is a code bug, not a Play Console configuration problem — the purchase API call is using an old argument format that Google Play Billing Library v5 no longer accepts.
3. **Restore Purchases button is visible** but equally broken for the same reason; it adds UI noise for a feature that cannot succeed.
4. **Mobile shows "Free Trial – 5 questions left"** while the web shows promo/unlimited access for the same account. Root cause: the mobile device hash doesn't carry the promo grant because the mobile user is either not logged in, or the backend's account-grant lookup hasn't been triggered yet.

All four issues are fixable without touching the backend. Issues 1–3 are pure mobile code; issue 4 is a UX/state-sync gap.

---

## 2. What Is Broken Right Now

| # | Symptom | Severity |
|---|---------|----------|
| 1 | Two plan buttons shown (Monthly + Yearly) — yearly is dead | High |
| 2 | Any tap on subscribe → `subscriptionOffers are required` crash | Critical |
| 3 | Restore Purchases visible and equally broken | Medium |
| 4 | Trial access shown on mobile when web shows promo/unlimited | High |
| 5 | `iapEnabled=true` in `production-android` exposes all broken IAP UI | Critical (trigger) |

---

## 3. Root Cause of Each Issue

### Issue 1 — Two plans rendered

**File:** `apps/mobile/src/screens/AccountScreen.tsx` lines 392–405  
**File:** `apps/mobile/src/constants/config.ts` lines 71–74

```typescript
// config.ts
export const IAP_PRODUCTS = {
  MONTHLY: "com.turbotaai.monthly",
  YEARLY:  "com.turbotaai.yearly",   // ← dead product
} as const

// AccountScreen.tsx
<Button title={t.accountMonthly} onPress={() => purchase(IAP_PRODUCTS.MONTHLY)} />
<Button title={t.accountYearly}  onPress={() => purchase(IAP_PRODUCTS.YEARLY)} />
```

`AccountScreen` unconditionally renders both buttons whenever `iapEnabled=true && !accessInfo.unlimited`.  

**Web parity check:** `lib/billing/plans.ts` defines both `monthly` and `yearly`, but `app/subscription/subscription-client.tsx` only ever calls `createInvoice` with `planId: "monthly"` (line 282). The yearly plan is never offered on the web. It should not appear on mobile either.

---

### Issue 2 — "subscriptionOffers are required for Google Play subscriptions"

**File:** `apps/mobile/src/hooks/useSubscription.ts` line 55

```typescript
// CURRENT — broken on Android with Billing Library v5+
const result = await RNIap.requestSubscription({ sku: productId })
```

Google Play Billing Library v5 (required for apps targeting SDK 35, which is now our target) deprecated the plain `sku` parameter for subscriptions. The correct call must include a `subscriptionOffers` array containing `{ sku, offerToken }`. The `offerToken` is only available after fetching product details via `getSubscriptions()`.

The current code never calls `getSubscriptions()` before attempting to purchase, so the required `offerToken` is never obtained, and the Google Play billing layer throws the error before any UI is shown.

**This is 100% a code bug.** It has nothing to do with Play Console product configuration.  

**iOS is unaffected** — Apple's StoreKit does not require `subscriptionOffers`.

The correct Android flow must be:
```
getSubscriptions({ skus: [productId] })
  → skus[0].subscriptionOfferDetails[0].offerToken
  → requestSubscription({ sku, subscriptionOffers: [{ sku, offerToken }] })
```

---

### Issue 3 — Restore Purchases button shown

**File:** `apps/mobile/src/screens/AccountScreen.tsx` lines 419–425

```typescript
{iapEnabled && (
  <Button title={t.accountRestorePurchases} onPress={restorePurchases} />
)}
```

`restorePurchases()` in `useSubscription.ts` (lines 106–153) calls `getAvailablePurchases()`, which on Android returns previous Google Play purchases. Since no actual IAP purchases have succeeded (issue 2 prevents any from completing), this button either returns "No active subscription found" or fails the same way as the purchase button. It also explicitly looks for `com.turbotaai.yearly` (line 124–126), a product that may not exist in Play Console.

The button adds UI clutter and misleads users into thinking there is something to restore.

---

### Issue 4 — Trial access on mobile vs promo/unlimited on web

**Backend bootstrap path (shared):**  
`apps/mobile`: `GET /api/mobile/bootstrap` → `lib/server/access-summary.ts:buildAccessSummary()`  
`web`: `GET /api/subscription/summary` → same `buildAccessSummary()`

The backend logic is identical for both. `buildAccessSummary` merges:
1. **Guest grant** — keyed by `device_hash` (web: cookie `ta_device_hash`; mobile: `X-Device-Hash` header)
2. **Account grant** — keyed by `account:${userId}` (only when user is logged in with a valid token)
3. **Self-healing** — checks `billing_orders` for paid orders not yet reflected in grants

**The divergence happens here:**  
When mobile calls bootstrap, `userId` is resolved from `Authorization: Bearer <token>` (line 239–250 of `access-summary.ts`). If no valid Bearer token is present (user not logged in on mobile), `userId` is null → no account grant lookup → only the mobile device hash grant is checked → that fresh device grant has 5 trial questions → bootstrap returns `access: "trial"`.

The web session uses cookie-based auth. If the promo was applied on web while logged in, it was written to BOTH the web device grant AND `account:${userId}` grant (see `promo/redeem/route.ts` lines 278–298). But the mobile bootstrap only sees the account grant if the Bearer token is present.

**Conclusion:** The most likely scenario is that the mobile device session has expired or the user has never logged in on mobile. The promo is visible on web because it's in the account grant, but the mobile doesn't query the account grant without a Bearer token.

**Secondary scenario:** If the promo was applied on an older code path that only wrote to `profiles.promo_until` and NOT to `access_grants`, `buildAccessSummary` would NOT pick it up (it reads `prof` only for `auto_renew`/`subscription_status` at lines 431–432; it does NOT fall back to `prof.paid_until`/`prof.promo_until` in the access calculation). This would cause both web and mobile to miss the promo unless `access_grants` has a future date.

---

## 4. Exact Files Involved

| File | Problem |
|------|---------|
| `apps/mobile/src/constants/config.ts` | Defines unused `IAP_PRODUCTS.YEARLY` (line 73) |
| `apps/mobile/src/screens/AccountScreen.tsx` | Renders two IAP buttons unconditionally; shows Restore Purchases when `iapEnabled` (lines 392–425) |
| `apps/mobile/src/hooks/useSubscription.ts` | `requestSubscription({ sku })` — old API broken on Android (line 55); hardcodes `"com.turbotaai.yearly"` in restore (line 124) |
| `apps/mobile/eas.json` | `production-android` sets `EXPO_PUBLIC_IAP_ENABLED=true`, exposing broken IAP UI |
| `apps/mobile/src/constants/i18n.ts` | Defines `accountYearly: "Yearly Subscription (Best Value)"` — translation for dead feature |
| `lib/billing/plans.ts` | Defines yearly plan (lines 20–27) but it's never offered on web; creates false impression of parity |
| `lib/server/access-summary.ts` | Does NOT fall back to `profiles.promo_until` in access calculation (uses profile only for metadata at lines 431–432) |

---

## 5. Which Parts Should Be Removed

| Item | Location | Reason |
|------|----------|--------|
| Yearly subscription button | `AccountScreen.tsx` lines 400–405 | Dead product, not offered on web |
| `IAP_PRODUCTS.YEARLY` | `config.ts` line 73 | Dead constant |
| Restore Purchases button | `AccountScreen.tsx` lines 419–425 | Broken, confusing, no purchases to restore |
| `"com.turbotaai.yearly"` string | `useSubscription.ts` lines 124–126 | Part of broken restore flow |
| `accountYearly` i18n key | `i18n.ts` (all locales) | Dead string for removed feature |
| Yearly plan definition in `lib/billing/plans.ts` | lines 20–27 | Only monthly plan is active |

---

## 6. Which Parts Should Be Simplified

| Item | Current state | Should be |
|------|--------------|-----------|
| `requestSubscription` call | `{ sku: productId }` | Add `getSubscriptions()` prefetch + `subscriptionOffers: [{ sku, offerToken }]` |
| Subscribe CTA block | Two buttons (Monthly + Yearly) | One button (Monthly only) |
| `AccountScreen` subscribe condition | `showSubscribeCTA && iapEnabled` shows two buttons | Single button with `iapEnabled` guard |
| `IAP_PRODUCTS` constant | `{ MONTHLY, YEARLY }` | `{ MONTHLY }` only |
| `restorePurchases` in `useSubscription.ts` | Searches for both monthly and yearly | Either remove or only search monthly |

---

## 7. What Depends on Google Play Console Setup vs Code

### Code-only fixes (no Play Console changes required)
- Remove yearly button
- Fix `requestSubscription` to use `subscriptionOffers`
- Hide Restore Purchases button

### Requires Google Play Console setup
- **Base plan + offer for `com.turbotaai.monthly`**: Must exist in Play Console with a base plan and at least one offer. The `offerToken` used in `subscriptionOffers` is fetched from `getSubscriptions()` at runtime — it's not hardcoded. If the product doesn't exist in Play Console or has no offers configured, `getSubscriptions()` returns empty and the purchase cannot proceed.
- **`com.turbotaai.yearly`**: If this product was created in Play Console, it should be archived/removed since we're removing it from code. If it was never created, no action needed.

### Summary table

| Fix | Code change | Play Console change |
|-----|-------------|---------------------|
| Remove yearly button | Yes | Optional: archive yearly product |
| Fix subscriptionOffers | Yes | No (offerToken fetched at runtime) |
| Make monthly purchase work | Yes | Yes — monthly product must have base plan + offer configured |
| Hide Restore Purchases | Yes | No |
| Fix trial/promo sync | No (user must log in on mobile) | No |

---

## 8. Recommended Final UX for This Release

```
Account screen — subscription card

[State box — one of:]
  ✅ Premium Active      (paid)
  ✅ Promo Active        (promo)  
  🔵 Free Trial — N left (trial)
  ❌ No Active Plan      (none)

[Actions — conditional:]
  Cancel auto-renew      → only if isPaid && autoRenew
  Resume auto-renew      → only if isPaid && !autoRenew
  Cancel promo           → only if isPromo

[Subscribe — only if !unlimited:]
  [Monthly Subscription] → one button only

[Always visible:]
  [Refresh Access]

[Below the divider:]
  Apply promo code [input] [Apply]
```

**Remove:** Yearly button, Restore Purchases button, "Manage Subscription" deep link (only relevant after IAP works).

---

## 9. Minimal Patch Plan for Alpha-4

**Goal:** Build a clean Android AAB that Google Play will accept and that shows correct subscription state.

### Option A — Disable IAP, keep promo/refresh flow (fastest, ~30 min)

1. **`eas.json`** — set `EXPO_PUBLIC_IAP_ENABLED=false` for `production-android`
   - This immediately hides all IAP buttons and Restore Purchases
   - Shows the "coming soon" notice instead (already implemented in AccountScreen)
   - No purchase can be attempted → no `subscriptionOffers` error
2. **`AccountScreen.tsx`** — remove the yearly button from the `iapEnabled=true` branch (one-line change; future-proofs for when IAP is re-enabled)
3. Rebuild → submit → Google Play accepts (subscriptionOffers error is gone)
4. Users with promo/paid access: tell them to log in and tap "Refresh Access"

**Risk:** Users cannot subscribe via app. Acceptable for closed testing.

### Option B — Fix IAP properly, ship monthly only (~2–4 hours)

1. **`config.ts`** — remove `YEARLY` from `IAP_PRODUCTS`
2. **`AccountScreen.tsx`**:
   - Remove yearly button
   - Remove Restore Purchases button
3. **`useSubscription.ts`**:
   - In `purchase()`: add `getSubscriptions({ skus: [productId] })` before `requestSubscription`; extract `offerToken`; pass `subscriptionOffers`
   - Remove yearly from `restorePurchases` product list (or remove the function entirely)
4. **Google Play Console**: Verify `com.turbotaai.monthly` subscription product exists with a base plan and at least one offer (required for `offerToken` to be returned)
5. **`i18n.ts`**: Remove `accountYearly` key from all 3 locales
6. Rebuild → submit

**Risk:** If `com.turbotaai.monthly` doesn't have offers configured in Play Console, purchases still fail — but the error changes to "no subscriptions found" (diagnosable). No crash.

### Recommended: Option A for the immediate closed testing build, Option B for the next iteration.

---

## 10. Risk List

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Monthly product not configured in Play Console | Medium | IAP won't work (Option B fails) | Verify before choosing Option B |
| Yearly product exists in Play Console, causes review confusion | Low | Minor | Archive it in Play Console |
| User still sees trial after logging in on mobile | Medium | Support tickets | Improve UX: auto-refresh on login (already done in `useAuth.ts` line 308) |
| promo_until stored only in `profiles` (old path) not in `access_grants` | Low | User can't see promo on mobile | One-time migration or add `profiles.promo_until` fallback to `buildAccessSummary` |
| `buildAccessSummary` doesn't read `profiles.paid_until`/`profiles.promo_until` | Confirmed | Access mismatch if grants don't have dates | Low risk if promo/redeem always writes to both grant + profile |
| Trial counter guard in `useAuth.ts` (line 203–205) prevents bootstrap from raising count | Low | Trial counter stuck if server count is higher | Acceptable — prevents counter going up after use |
| `EXPO_PUBLIC_IAP_ENABLED=true` in `production` profile (not just `production-android`) | Confirmed | Any future generic production build also exposes broken IAP | Should set explicitly per-platform profile |

---

## File Change Summary

Files requiring edits to fix issues 1–3 (IAP/UI):

```
apps/mobile/src/screens/AccountScreen.tsx       — remove yearly button, remove Restore Purchases
apps/mobile/src/hooks/useSubscription.ts        — fix requestSubscription API, clean restore
apps/mobile/src/constants/config.ts             — remove IAP_PRODUCTS.YEARLY
apps/mobile/src/constants/i18n.ts               — remove accountYearly translations (all 3 locales)
apps/mobile/eas.json                            — set IAP_ENABLED=false for production-android (Option A)
                                                  OR keep true but ensure Play Console setup (Option B)
```

Files that do NOT need changes for this release:
```
android/build.gradle                            — targetSdk 35 already fixed
app.json                                        — no SDK or IAP product refs
lib/server/access-summary.ts                    — backend is correct; mismatch is client-side auth
lib/billing/plans.ts                            — not used by mobile directly
```
