# GramChain — Deployment Plan

> **Audience:** You (operator) deploying GramChain end-to-end.
> **Scope:** Backend, Mobile APK, Smart Contracts (testnet), and required external services.
> **Output of this run:** A staging-ready deployment with installable APK and reachable backend.

---

## 0. Prerequisites Checklist

Before you start, confirm you have:

- [ ] **Node.js 20+** locally (`node -v`)
- [ ] **Git** repo pushed to GitHub (private repo OK)
- [ ] **Firebase project** `gramchainn` exists and you are an editor
- [ ] **Google Cloud Console** access for `gramchainn` project (OAuth credentials)
- [ ] **Polygon Amoy** testnet wallet funded with at least 0.5 POL (faucet: <https://faucet.polygon.technology/>)
- [ ] **Polygonscan API key** (free at <https://polygonscan.com/myapikey>)
- [ ] **Hosting account** for backend (Railway recommended — free tier works for staging)
- [ ] **Managed Postgres + Redis** (Railway provides both, or Neon + Upstash)
- [ ] **Expo / EAS account** (`npm i -g eas-cli && eas login`)

If any of these are missing, stop and provision them first.

---

## 1. Architecture Overview

```
┌──────────────────────┐      HTTPS       ┌──────────────────────┐
│  Mobile APK          │ ───────────────> │  Backend (Express)   │
│  (Expo / RN)         │                  │  Railway / Render    │
│  Firebase Phone Auth │                  │  ├─ Prisma → Postgres│
│  Google Sign-In      │                  │  ├─ Redis (BullMQ)   │
└──────────────────────┘                  │  └─ ethers → Amoy    │
                                          └──────────┬───────────┘
                                                     │
                                          Polygon Amoy Testnet
                                          ├─ LoanManager.sol
                                          ├─ SHGPoolFactory.sol
                                          └─ CreditScoreRegistry.sol
```

---

## 2. Stage 1 — Smart Contracts → Polygon Amoy

### 2.1 Configure secrets

Create `blockchain/.env`:

```env
DEPLOYER_PRIVATE_KEY=0x<your-funded-amoy-wallet-private-key>
BACKEND_WALLET_ADDRESS=0x<address-the-backend-will-sign-with>
POLYGONSCAN_API_KEY=<your-polygonscan-key>
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```

> **Important:** `BACKEND_WALLET_ADDRESS` is the address derived from `BACKEND_PRIVATE_KEY` (used by the backend). Both wallets need a small POL balance — deployer for deployment fees, backend for ongoing tx fees.

### 2.2 Compile + Test

```powershell
cd blockchain
npm install
npx hardhat compile
npx hardhat test                              # all 79+ tests should pass
```

### 2.3 Deploy

```powershell
npx hardhat run scripts/deploy.ts --network amoy
```

The script auto-writes addresses to:
- `backend/src/constants/contracts.json`
- `mobile/constants/contracts.json`

### 2.4 Verify on Polygonscan

```powershell
npx hardhat verify --network amoy <LoanManagerAddress> <constructor-args>
npx hardhat verify --network amoy <SHGPoolFactoryAddress> <constructor-args>
npx hardhat verify --network amoy <CreditScoreRegistryAddress> <constructor-args>
```

### 2.5 Sanity check

Open <https://amoy.polygonscan.com/address/{LoanManagerAddress}> — confirm contract source visible and `BACKEND_ROLE` is granted to your `BACKEND_WALLET_ADDRESS`.

---

## 3. Stage 2 — Backend → Railway (or Render)

### 3.1 Create services on Railway

1. New Project → Deploy from GitHub repo
2. Add **PostgreSQL** plugin (auto-creates `DATABASE_URL`)
3. Add **Redis** plugin (auto-creates `REDIS_URL`)
4. Set the **service root directory** to `backend`
5. Build command: `npm ci && npx prisma generate && npm run build`
6. Start command: `npx prisma migrate deploy && node dist/index.js`

### 3.2 Required environment variables

In Railway → Variables, set:

```env
# Required (validated at startup by SEC9 — server crashes if missing)
NODE_ENV=production
DATABASE_URL=<auto-set-by-railway>
REDIS_URL=<auto-set-by-railway>
JWT_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
BACKEND_PRIVATE_KEY=0x<funded-amoy-wallet-private-key>
ENCRYPTION_KEY=<openssl rand -hex 32>

# Contract addresses from Stage 1
LOAN_MANAGER_ADDRESS=0x...
SHG_POOL_FACTORY_ADDRESS=0x...
CREDIT_SCORE_REGISTRY_ADDRESS=0x...
RPC_URL=https://rpc-amoy.polygon.technology

# Firebase Admin (download service account JSON from Firebase Console → IAM)
FIREBASE_SERVICE_ACCOUNT_JSON=<paste-json-as-single-line>
FIREBASE_PROJECT_ID=gramchainn

# OAuth
GOOGLE_CLIENT_ID=51986108180-t83208fe8ia5ebr40i49u8jr472lsb9r.apps.googleusercontent.com

# KYC (Sandbox API for staging)
SANDBOX_API_KEY=<your-key>
SANDBOX_API_SECRET=<your-secret>

# ML Service (optional in staging — falls back to rule-based)
ML_SERVICE_URL=http://ml:8000
ML_INTERNAL_SECRET=<openssl rand -hex 32>

# Demo mode OFF in production
DEMO_MODE=false

# Allowed origins for CORS
ALLOWED_ORIGINS=gramchain://,https://your-staging-domain.up.railway.app
```

### 3.3 Run migrations

Railway auto-runs `prisma migrate deploy` on startup (per the start command above). Confirm in logs:

```
$ prisma migrate deploy
Database is now in sync with the migration history.
```

### 3.4 Smoke test

```powershell
$base = "https://your-staging-domain.up.railway.app"
curl "$base/health"
# Expected: {"status":"ok","version":"1.0.0","db":"ok","redis":"ok"}
```

### 3.5 Seed test data (optional)

```powershell
# From your local machine, pointed at the production DB:
$env:DATABASE_URL="<railway-postgres-url>"
cd backend
npx ts-node prisma/seed.ts
```

---

## 4. Stage 3 — Firebase Configuration for Production APK

### 4.1 Add APK SHA-1 fingerprint

This is **mandatory** for Firebase Phone Auth on the standalone APK.

```powershell
cd mobile
eas credentials
# Select: Android → production → Keystore → View credentials
# Copy the SHA-1 fingerprint
```

Then in Firebase Console:
1. Project Settings → Your Apps → Android app (`com.gramchain.gramchain`)
2. Click "Add fingerprint"
3. Paste SHA-1 → Save
4. Wait 2 minutes for propagation

### 4.2 Test phone numbers (for testers without burning SMS quota)

Firebase Console → Authentication → Sign-in method → Phone → "Phone numbers for testing":

```
+919999900001 → 100001
+919999900002 → 100002
+919999900003 → 100003
```

### 4.3 Authorized OAuth redirect URIs

Google Cloud Console → APIs & Services → Credentials → OAuth Web Client:
- `https://auth.expo.io/@<your-expo-username>/gramchain`

---

## 5. Stage 4 — Mobile APK Build (EAS)

### 5.1 Configure `eas.json`

Confirm `mobile/eas.json` has a `preview` profile. If not, add:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://your-staging-domain.up.railway.app/api/v1"
      }
    },
    "production": {
      "android": { "buildType": "app-bundle" },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://your-prod-domain.com/api/v1"
      }
    }
  }
}
```

### 5.2 Required `.env` for EAS build

Set as EAS secrets (not in source control):

```powershell
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value 51986108180-t83208fe8ia5ebr40i49u8jr472lsb9r.apps.googleusercontent.com
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value 51986108180-uncj5n0cqho9g4henb4an840gdro302o.apps.googleusercontent.com
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value <your-ios-client-id>
```

### 5.3 Build APK

```powershell
cd mobile
eas build --profile preview --platform android
```

Build takes ~15-25 minutes on Expo cloud. Output is a downloadable APK link.

### 5.4 Install + Test on real device

1. Download APK on Android phone (allow "install from unknown sources")
2. Test all auth flows:
   - [ ] Borrower phone signup → Firebase OTP arrives via SMS
   - [ ] Borrower password login
   - [ ] Borrower Google sign-in
   - [ ] Borrower biometric login (after first password login)
   - [ ] Lender phone signup
   - [ ] Lender password + Google login
3. Test core flows:
   - [ ] Apply for loan → credit score appears → ↻ Refresh button updates score
   - [ ] Lender approves loan from `/portfolio`
   - [ ] Repay EMI

---

## 6. Stage 5 — Post-Deployment Verification

### 6.1 Backend health checks

```powershell
$base = "https://your-staging-domain.up.railway.app"

# Health
curl "$base/health"

# OTP rate limit (should 429 after 6 hits)
1..6 | ForEach-Object { curl -X POST "$base/api/v1/auth/check-phone?phone=9999999999" }

# Login brute-force lockout (A4 — should 429 after 5 failed attempts)
1..6 | ForEach-Object {
  curl -X POST "$base/api/v1/auth/login" -H "Content-Type: application/json" `
    -d '{"identifier":"test@test.com","password":"wrong"}'
}
```

### 6.2 Confirm contracts wired

```powershell
# Apply a test loan via API → check Polygonscan for emitted LoanCreated event
curl -X POST "$base/api/v1/loan/apply" `
  -H "Authorization: Bearer <test-token>" `
  -H "Content-Type: application/json" `
  -d '{"shgId":"test-shg","amount":"10000","tenureMonths":6,"purpose":"agriculture"}'

# Then visit https://amoy.polygonscan.com/address/<LoanManagerAddress>#events
```

### 6.3 Tester onboarding

Share with testers:
- APK download link (from EAS build output)
- Test phone numbers (from §4.2) OR their own real numbers
- Known issues list
- Feedback form (Google Form / Typeform)

---

## 7. Rollback Plan

If a deploy goes wrong:

| Failure | Action |
|---|---|
| **Bad backend deploy** | Railway → Deployments → previous green build → "Redeploy" |
| **Bad migration** | `npx prisma migrate resolve --rolled-back <name>` then redeploy with reverted code |
| **Bad APK** | Re-distribute previous EAS build link from `eas build:list` |
| **Compromised secret** | Rotate in Railway → restart service. For `BACKEND_PRIVATE_KEY`, also revoke contract role: `LoanManager.revokeRole(BACKEND_ROLE, oldAddr)` and `grantRole(BACKEND_ROLE, newAddr)` |

---

## 8. Monitoring (Minimum Viable)

For staging, set up at least these:

- **Uptime:** UptimeRobot hitting `/health` every 5 min, alert email/Slack
- **Logs:** Railway built-in log viewer (free) — search for `level:50` (fatal) or `level:40` (error)
- **DB backups:** Railway managed Postgres takes daily snapshots automatically
- **Error tracking:** Optional — wire Sentry by adding `SENTRY_DSN` env var (Sentry SDK already optional in `index.ts`)

---

## 9. Production Hardening (Before Mainnet / Real Money)

These are **NOT** required for staging/beta but **ARE** required before handling real funds:

| Item | Why |
|---|---|
| Move `BACKEND_PRIVATE_KEY` to AWS/GCP KMS | Single point of failure if leaked |
| Move `ENCRYPTION_KEY` to KMS | KYC PII at risk |
| Deploy Gnosis Safe as contract admin | No single-key takeover |
| 24h timelock on `DEFAULT_ADMIN_ROLE` grants | Admin can't rug instantly |
| External smart contract audit (CertiK / Trail of Bits) | Required for institutional trust |
| Razorpay/Cashfree payment gateway integration | Currently no real money moves |
| WAF + DDoS protection (Cloudflare) | Public surface area |
| Sentry/Datadog error + APM | Observability |
| Load testing with k6 / artillery | Confirm capacity |
| Penetration test | Find what tests miss |

---

## 10. Quick Reference — Commands Cheat Sheet

```powershell
# Backend
cd backend
npm ci
npx prisma migrate deploy
npm run build
node dist/index.js

# Backend tests
npm test

# Smart contracts
cd blockchain
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.ts --network amoy
npx hardhat verify --network amoy <addr> <args>

# Mobile
cd mobile
npx expo start                                    # local dev
eas build --profile preview --platform android    # APK
eas build:list                                    # past builds
eas credentials                                   # SHA-1 lookup
eas secret:list                                   # secrets

# Diagnostics
curl https://<host>/health
adb logcat | Select-String "Firebase|Recaptcha"   # APK on-device debugging
```

---

## 11. Ownership & Sign-Off

Before declaring deploy "done":

- [ ] All §6.1 health checks return green
- [ ] At least 2 testers complete the full borrower journey (signup → loan → repay)
- [ ] At least 1 tester completes the lender journey (signup → approve loan)
- [ ] Polygonscan shows real on-chain events from the test loans
- [ ] No `level:50` (fatal) logs in the last 24h
- [ ] Brute-force lockout returns 429 (A4 verified live)
- [ ] Credit score `↻ Refresh` button refetches a new score (M4 verified live)
- [ ] APK install works on at least 2 different Android devices

When all checked, tag the release in git:

```powershell
git tag -a v0.1.0-staging -m "First staging deploy"
git push origin v0.1.0-staging
```

---

*If anything in this doc is wrong or missing for your specific hosting choice, fix it in PR — this doc IS the deployment runbook.*
