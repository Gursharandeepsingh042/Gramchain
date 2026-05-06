# GramChain — Plan to Production (Cleaned)

> **Updated** after auditing the repo. Items already implemented have been removed.
> **Scope:** What's actually left to do, plus a 24-hour sprint to make the app testing-ready.
> **Tone:** Blunt.

---

## ✅ What's Already Done (removed from active plan)

| Item | Status |
|---|---|
| **F1** — `borrow.tsx` score bug — now calls `loanApi.getCreditScore` | ✅ Fixed |
| **A1** — OTP `requestCount` increment + rate limit | ✅ Fixed |
| **A2** — `sendOtp` documented as Firebase-backed (mobile-driven) | ✅ Done |
| **S1** — `EmiPaid` event has `emiAmountPaise` field | ✅ Done |
| **S2** — `createLoan` reverts on `address(0)` borrower (`ZeroBorrower`) | ✅ Done |
| **DB1** — Switched from `db push` to `prisma migrate` (2 migrations exist) | ✅ Done |
| **DB2** — `DriftAlert` model added | ✅ Done |
| **DB3** — `chainProcessedAt` on `LedgerEntry` | ✅ Done |
| **DB7** — Indexes on `Loan.status`, etc. | ✅ Done |
| **M4** — Backend `GET /api/v1/loan/credit-score` endpoint exists | ✅ Done |
| **T1** — Jest installed in backend, `jest.config.ts` present | ✅ Done |
| **T2** — `auth.service.test.ts` written | ✅ Done |
| **T3** — `loan.service.test.ts` written | ✅ Done |
| **Auth Suite** — Firebase Phone OTP (borrower + lender), Google Sign-In (all 3 screens), Password login with `identifier`, Biometric login, Resend OTP wiring, Expo Go proxy `redirectUri`, iOS `bundleIdentifier` fix, Android OAuth client added to `google-services.json`, email uniqueness guard in `registerUser` | ✅ Done |

---

## 🔴 Still Pending — Categorized

### Blockers for Real Production (not for testing)
- **Payments (P1–P9)** — No real money movement. Razorpay/Cashfree integration, webhooks, refunds, NACH mandates all missing.
- **Security (SEC1–SEC2, SEC10)** — `BACKEND_PRIVATE_KEY` + `ENCRYPTION_KEY` in `.env`. Need KMS. Need Gnosis Safe multisig for contract admin.
- **Contracts (S4–S7)** — Not deployed to Amoy. No UUPS proxy. No Slither/Mythril run. No external audit.
- **ML Model (M1–M3, M5–M9)** — Model never trained in CI. `train.py` exists but unused. Features hardcoded. No re-scoring cron.

### Quality Gates (needed before external beta)
- **Tests (T4–T10)** — Only unit tests for auth + loan service. No API integration tests, no mobile E2E, no fuzz tests, no load tests, no CI gate.
- **DevOps (D1–D10)** — No CI/CD, no staging env, no log aggregation, no metrics, no uptime monitoring, no backups.
- **Docs (DOC1–DOC8)** — No proper README, no OpenAPI, no architecture diagram, no runbooks.

### Mobile Polish (not blockers)
- **F2** Replace deprecated `Clipboard` with `expo-clipboard`
- **F3** Delete dead services: `wallet.ts`, `payment.ts`, `blockchain.ts`, `scoring.ts`, `sync.ts`, `offlineQueue.ts` (confirmed dead in `mobile/services/`)
- **F4** Error boundary + retry UI on data-fetching screens
- **F5** Skeleton loaders on `group.tsx`, `schemes.tsx`
- **F6** Accessibility pass (`accessibilityLabel` everywhere)
- **F7** Dynamic build/version footer (remove hardcoded `Build 2026.04.08`)
- **F8** Pull-to-refresh on tabs
- **F9** Wire `invest.tsx` states to `/geo` endpoint
- **F10** Push notification deep links
- **F11** Offline queue (expo-sqlite)

### Backend Polish
- **B1** Nonce manager for concurrent txns
- **B2** Gas price oracle (`provider.getFeeData()` + 20% buffer)
- **B3** Stuck-tx watchdog (bump gas if pending > 5min)
- **B4** Idempotency check in `mark-disbursed` / `mark-emi`
- **B5** Dead-letter queue for unparseable events
- **B6** Reconcile worker (uses `DriftAlert` model that already exists)
- **B7** Replace `console.log` with `logger` in `default-checker.job.ts`

### Auth Polish
- **A3** Fix remaining `@ts-ignore` in `auth.service.ts` (if any left)
- **A4** Brute-force lockout on `loginWithPassword` (5 attempts, 15min, Redis counter)
- **A5** Rename `googleId` → `firebaseUid` (migration)
- **A6** KYC document upload (S3)
- **A7** Admin KYC verify/reject endpoint

### Notifications
- **N1** Clear FCM token on logout
- **N2–N3** Multi-language templates + `preferredLanguage` field
- **N4** Quiet hours (10PM–7AM IST)
- **N5** `deliveredAt`, `clickedAt` fields
- **N6** Batch digest (15min window)
- **N7** Deep-link routing in notification `data` payload

### Database
- **DB4** `maxAttempts` on `OutboxJob` (code has `MAX_OUTBOX_ATTEMPTS` constant, schema doesn't enforce)
- **DB5** Compound unique on `LedgerEntry(entityType, entityId, ref)`
- **DB6** `Payment` model (blocked on payment gateway decision)

### Smart Contracts
- **S3** `require(_quorum <= memberCount)` in `setQuorum`
- **S4** UUPS proxy wrap
- **S5–S6** Deploy to Polygon Amoy
- **S7** Slither/Mythril static analysis
- **S8** `QuorumChanged`, `PoolCreated` events
- **S9** Contract upgrade runbook

---

# 🕐 24-Hour Sprint — Make It Testing-Ready

> **Goal:** A demoable build you can hand to testers tomorrow evening. Not production-hard. Testing-ready.
> **Assumption:** You work ~10 focused hours across the 24h window (plus sleep).

## Hour 0–2 — Smoke Test Prep (PRIORITY)

| Time | Task | Why |
|---|---|---|
| 0:00–0:30 | **Start backend + mobile, run through every auth flow manually** (borrower signup, borrower password login, borrower OTP login, borrower Google, lender signup, lender password login, lender Google, biometric) | Catch regressions from recent auth fixes |
| 0:30–1:00 | **Add test phone numbers in Firebase Console** → `Authentication → Sign-in method → Phone → Phone numbers for testing`. Set at least 2 numbers (e.g. `+919999999999` with OTP `123456`). | Testers can log in without SMS limits |
| 1:00–1:30 | **Verify `.env` files** — backend needs `DATABASE_URL`, `REDIS_URL`, JWTs, Firebase service account. Mobile needs all 3 Google client IDs (now including Android). | Prevents "it works on my machine" |
| 1:30–2:00 | **Run the jest tests** — `cd backend && npm test`. Fix any failing tests from recent auth changes. | CI sanity |

## Hour 2–6 — Mobile Polish (HIGH VISIBILITY FIXES)

| Time | Task | Effort |
|---|---|---|
| 2:00–2:30 | **F3** — Delete dead services (`wallet.ts`, `payment.ts`, `blockchain.ts`, `scoring.ts`, `sync.ts`, `offlineQueue.ts`). Grep for imports first, delete after. | Cleanup |
| 2:30–3:00 | **F2** — `npm i expo-clipboard`, replace `import { Clipboard } from 'react-native'` everywhere | 30min |
| 3:00–4:00 | **F7** — Dynamic version footer. Read from `Constants.expoConfig.version` and `Constants.expoConfig.runtimeVersion`. Remove `Build 2026.04.08`. | 1h |
| 4:00–5:00 | **F4** — Error boundary component + retry buttons on `(tabs)/index.tsx`, `borrow.tsx`, `invest.tsx`, `impact.tsx` (wrap data fetches in try/catch → show retry UI) | 1h |
| 5:00–6:00 | **F8** — Pull-to-refresh (`RefreshControl`) on borrow, invest, portfolio, impact screens | 1h |

## Hour 6–10 — Build the APK (testers need an installable)

| Time | Task |
|---|---|
| 6:00–6:30 | **Install EAS CLI if not already** (`npm i -g eas-cli`), `eas login`, `eas build:configure` |
| 6:30–7:00 | **Configure `eas.json`** — add `preview` profile (internal distribution APK, not AAB) |
| 7:00–8:00 | **Add release keystore SHA-1 to Firebase Console** → Android app → Add fingerprint. Run `eas credentials` → view SHA-1 after first build spawns keystore. |
| 8:00–10:00 | **`eas build --profile preview --platform android`** — first build takes ~15–25 min on cloud. Download APK, install on test device, verify Firebase OTP + Google Sign-In both work on the real APK (not Expo Go). |

## Hour 10–14 — Break Point (sleep or long break)

## Hour 14–18 — Backend Hardening for Multi-Tester Load

| Time | Task | Effort |
|---|---|---|
| 14:00–15:00 | **A4** — Brute-force lockout on `loginWithPassword`. Redis `INCR login:fail:{identifier}` with 15-min EXPIRE. Block after 5. | 1h |
| 15:00–16:00 | **SEC5–SEC6** — Rate limit KYC routes (5/min PAN, 3/min Aadhaar) and loan apply (3/min per user) using existing `express-rate-limit` | 1h |
| 16:00–17:00 | **A3** — Remove any remaining `@ts-ignore`. Run `npx prisma generate` to refresh types. | 1h |
| 17:00–18:00 | **SEC9** — Env validation at startup. Add a `validateEnv()` function called from `index.ts` that exits with a clear error if any required var is missing. | 1h |

## Hour 18–22 — Smoke Test with Real Data

| Time | Task |
|---|---|
| 18:00–19:00 | Seed the DB with 3 test SHGs, 5 borrowers, 2 lenders, 2 loans at different stages. Script in `backend/prisma/seed.ts` if one doesn't exist. |
| 19:00–20:00 | Install the APK on 2–3 devices. Run full user journey: signup → KYC (mock) → join SHG → apply loan → approve loan → repay EMI. Log every bug. |
| 20:00–21:00 | Fix the top 3 most-visible bugs found. |
| 21:00–22:00 | Write a tester onboarding doc: `TESTER_GUIDE.md` — test accounts, known issues, feedback form link. |

## Hour 22–24 — Buffer + Ship

| Time | Task |
|---|---|
| 22:00–23:00 | Deploy backend to Railway/Render (quick, managed). Set `EXPO_PUBLIC_API_URL` in EAS secrets, trigger one more APK build against the hosted backend. |
| 23:00–24:00 | Distribute APK via EAS internal distribution link. Share `TESTER_GUIDE.md`. |

---

## What's NOT in the 24h Sprint (deferred)
- Real payment gateway (Razorpay) — too big, use demo mode for testers
- KMS / Gnosis Safe — not needed until real funds on mainnet
- Contract deployment to Amoy — testers don't need on-chain
- ML model retraining — rule-based fallback is fine for demo
- CI/CD — can run tests locally for now
- Full accessibility pass — do it after first feedback round

---

# 📱 Question: Will the APK Receive Firebase OTP?

## Short Answer: **Yes, with one mandatory setup step.**

## How It Works (Current Implementation)

Your app uses `expo-firebase-recaptcha` + `PhoneAuthProvider.verifyPhoneNumber`. This is a **web-reCAPTCHA-based flow** (not native Google Play Integrity), which means:

| Build Type | OTP Delivery | Requirements |
|---|---|---|
| **Expo Go (dev)** | ✅ Works | Just the `FirebaseRecaptchaVerifierModal` (already in your code) |
| **APK standalone (preview/production)** | ✅ Works | **MUST add signing keystore SHA-1 to Firebase Console** |
| **Test phone numbers** (Firebase Console whitelist) | ✅ Works anywhere | No SMS, no SHA-1 needed. Just set OTP in console. |

## ⚠️ Critical APK Requirements

1. **SHA-1 fingerprint of the APK's signing keystore MUST be registered** in:
   - Firebase Console → Project Settings → Your Android app → "Add fingerprint"
   - Without this, `verifyPhoneNumber` will silently fail or return `auth/app-not-authorized` on the APK.

2. **`google-services.json` must match the APK's package name**
   - Your `app.json` android package: `com.gramchain.gramchain` ✅
   - Your `google-services.json` package_name: `com.gramchain.gramchain` ✅
   - **These match** — good.

3. **The APK must use the same keystore you registered**
   - EAS Build generates one keystore per project. Use `eas credentials` to view/export the SHA-1.
   - If you rotate the keystore, you must re-register the SHA-1 in Firebase.

4. **Phone Auth billing (Blaze plan)**
   - Firebase Spark plan: 10 free SMS/day per project to Indian numbers. After that, phone auth **fails silently**.
   - For testing with 2–5 testers over 24h, Spark is enough.
   - For wider beta, upgrade to Blaze (~₹0.05 per SMS in India).
   - **Workaround for dev/testing:** add everyone's number as a test number in Firebase → unlimited, no billing, no SMS.

## How to Verify OTP Works on Your APK (5-minute test)

```powershell
# 1. Build preview APK
cd mobile
eas build --profile preview --platform android

# 2. Once built, view credentials & grab SHA-1
eas credentials
# Select: Android → production → Keystore → View credentials
# Copy the SHA-1 fingerprint

# 3. Register SHA-1 in Firebase Console
# → Project Settings → Your Android app → "Add fingerprint" → paste SHA-1 → Save

# 4. Wait 2 minutes for Firebase to propagate, then:
# Install APK on device, try phone signup → OTP should arrive via SMS
```

## If OTP Doesn't Arrive on APK (Debug Checklist)

1. ❓ Is the SHA-1 registered? — `eas credentials` → compare to Firebase Console
2. ❓ Is the package name matching? — `app.json` vs `google-services.json`
3. ❓ Is Phone provider enabled? — Firebase Console → Authentication → Sign-in method → Phone
4. ❓ Check `adb logcat | Select-String "Firebase\|Recaptcha"` on the device
5. ❓ Try a test phone number (whitelisted in Firebase) — if this works but real numbers don't, it's a billing/SMS quota issue
6. ❓ Network firewall — reCAPTCHA needs access to `recaptcha.net` and `firebaseapp.com`

---

## Files You'll Touch During the 24h Sprint

- `mobile/services/` — delete 6 dead files
- `mobile/eas.json` — add `preview` profile
- `mobile/app.json` — verify version bump
- `backend/src/services/auth.service.ts` — brute-force lockout
- `backend/src/routes/kyc.routes.ts` — add rate limiter
- `backend/src/index.ts` — `validateEnv()`
- `backend/prisma/seed.ts` — test data
- New: `TESTER_GUIDE.md` at repo root

---

*Everything removed from the original plan has been verified as implemented in the codebase. What remains is genuinely pending. The 24h sprint focuses on "testing-ready" not "production-ready" — two very different bars.*
