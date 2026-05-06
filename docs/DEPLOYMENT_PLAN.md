# GramChain Deployment Plan

## 1. Pre-Deployment Checklist

### 1.1 Infrastructure & Environment
- [ ] Verify Supabase PostgreSQL is running and accessible.
- [ ] Ensure `DATABASE_URL` is securely set in production environment variables.
- [ ] Confirm RPC URL (Alchemy/Infura) for Polygon Amoy/Testnet is active and funded with test MATIC.
- [ ] Validate third-party API keys (SurePass/Sandbox for KYC, Twilio for SMS).
- [ ] Double-check `.env` values on all production servers (Backend & Mobile Build).

### 1.2 Backend Deployment (Render / AWS / DigitalOcean)
- [ ] Dockerize the Node.js Express backend.
- [ ] Run Prisma migrations against the production database (`npx prisma migrate deploy`).
- [ ] Deploy backend container.
- [ ] Set up Redis instance for BullMQ (background blockchain queue).
- [ ] Configure CI/CD pipeline (GitHub Actions) to run tests and deploy on push to `main`.
- [ ] Set up basic monitoring and alerting (e.g., Sentry, PM2 logs).

### 1.3 Smart Contracts Deployment (Polygon)
- [ ] Run final hardhat tests.
- [ ] Deploy `SHGPoolFactory`, `LoanManager`, and `CreditScoreRegistry` to Polygon Testnet.
- [ ] Verify contracts on Polygonscan.
- [ ] Update contract ABIs and addresses in the Backend (`backend/src/constants/contracts.ts`) and Mobile app (`mobile/src/constants/contracts.ts`).

### 1.4 Mobile Application (Expo / Play Store)
- [ ] Ensure all API base URLs point to the production backend (`https://api.gramchain.com`).
- [ ] Increment version numbers in `app.json`.
- [ ] Run `npx expo export` or `eas build` for Android (AAB/APK).
- [ ] Thoroughly test the final APK on real Android devices (especially budget offline-first scenarios).
- [ ] Submit AAB to Google Play Console for Internal Testing track.

## 2. Launch Phases

### Phase 1: Internal Alpha (Days 1-3)
- Deploy backend to a staging environment.
- Distribute APK via direct download or Play Store Internal Track to the core team.
- **Objective:** Test end-to-end flows (Lender Signup -> Deposit -> SHG Loan Request -> ML Scoring -> Approval -> EMI Repayment -> On-chain Audit logging).

### Phase 2: Closed Beta (Days 4-10)
- Move to production backend infrastructure.
- Onboard 2-3 friendly SHGs (approx. 20-30 members).
- Monitor BullMQ workers for any failed blockchain jobs (especially due to gas spikes or RPC rate limits).
- **Objective:** Gather real-world feedback on KYC flows, Hindi localization, and app performance on low-end devices.

### Phase 3: Public Testnet Launch (Day 14+)
- Open app access on the Play Store.
- Launch a landing page to attract Impact Investors / Lenders to fund the testnet pools.
- **Objective:** Stress-test the concurrent connections and evaluate the impact reporting dashboard.

## 3. Rollback & Contingency Plan
- **Database:** Daily automated backups via Supabase.
- **Backend Failures:** PM2 will auto-restart the Node process. If fatal, rollback to the previous Docker image hash.
- **Blockchain RPC Outage:** The backend queue (BullMQ) is designed to retry failed blockchain transactions exponentially. No data is lost; it simply waits for the RPC to recover.
- **Smart Contract Bugs:** Since the current phase uses blockchain purely as an audit ledger (no USDC locks), bugs won't trap user funds. We can redeploy updated contracts and update the pointers in the backend.
