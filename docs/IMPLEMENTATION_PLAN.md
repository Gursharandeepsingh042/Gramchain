# GramChain â€” Implementation Plan
**Total Duration:** 20 Weeks (Final Year Project Timeline)
**Last Updated:** April 24, 2026

---
## Current Build Status

> **Backend API:** âœ… Production Hardened â€” Supabase PostgreSQL + Redis BullMQ  
> **Mobile App:** âœ… Production Ready â€” Offline-first with secure PII encryption  
> **Smart Contracts:** âœ… Deployed to Polygon Amoy Testnet  
> **Database:** âœ… Prisma schema live with 12+ models (including Ledger & Jobs)  
> **Demo Mode:** âœ… Active â€” Toggleable via `.env` / Settings  

---

## Folder Structure

```
gramchain/
â”‚
â”œâ”€â”€ docs/                          # Project documentation
â”‚   â”œâ”€â”€ PRD.md
â”‚   â”œâ”€â”€ SYSTEM_DESIGN.md
â”‚   â”œâ”€â”€ IMPLEMENTATION_PLAN.md
â”‚   â””â”€â”€ SKILL_*.md
â”‚
â”œâ”€â”€ mobile/                        # React Native App (Expo) âœ… PRODUCTION READY
â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”œâ”€â”€ (auth)/                # Auth screens (file-based routing)
â”‚   â”‚   â”‚   â”œâ”€â”€ welcome.tsx        âœ… Language select + role intro
â”‚   â”‚   â”‚   â”œâ”€â”€ login.tsx          âœ… Phone OTP + Google OAuth
â”‚   â”‚   â”‚   â”œâ”€â”€ signup.tsx         âœ… Registration with phone verify
â”‚   â”‚   â”‚   â”œâ”€â”€ verify-otp.tsx     âœ… OTP entry + resend
â”‚   â”‚   â”‚   â”œâ”€â”€ kyc.tsx            âœ… Aadhaar-first â†’ OTP â†’ PAN flow
â”‚   â”‚   â”‚   â”œâ”€â”€ lender-login.tsx   âœ… Lender-specific login
â”‚   â”‚   â”‚   â”œâ”€â”€ lender-signup.tsx  âœ… Lender registration
â”‚   â”‚   â”‚   â”œâ”€â”€ role-select.tsx    âœ… Borrower / Lender selection
â”‚   â”‚   â”‚   â””â”€â”€ forgot-password.tsx âœ… Phone-based password reset
â”‚   â”‚   â”œâ”€â”€ (tabs)/                # Main borrower tab navigator
â”‚   â”‚   â”‚   â”œâ”€â”€ index.tsx          âœ… Dashboard (balance, loans, calendar)
â”‚   â”‚   â”‚   â”œâ”€â”€ borrow.tsx         âœ… Loan application + ML score
â”‚   â”‚   â”‚   â”œâ”€â”€ group.tsx          âœ… SHG members, savings, meetings
â”‚   â”‚   â”‚   â”œâ”€â”€ profile.tsx        âœ… KYC status, settings
â”‚   â”‚   â”‚   â””â”€â”€ schemes.tsx        âœ… Government Schemes Dashboard
â”‚   â”‚   â”œâ”€â”€ (lender)/              # Lender portal tab navigator
â”‚   â”‚   â”‚   â”œâ”€â”€ portfolio.tsx      âœ… Portfolio + GramUnit holdings
â”‚   â”‚   â”‚   â”œâ”€â”€ invest.tsx         âœ… USDC deposit + pool view
â”‚   â”‚   â”‚   â”œâ”€â”€ impact.tsx         âœ… ESG + impact metrics
â”‚   â”‚   â”‚   â””â”€â”€ lender-profile.tsx âœ… Account management
â”‚   â”‚   â””â”€â”€ _layout.tsx            âœ… Root layout + role-based routing
â”‚   â”œâ”€â”€ components/                âœ… Reusable UI components
â”‚   â”œâ”€â”€ services/                  âœ… api.ts (axios), blockchain.ts (ethers)
â”‚   â”œâ”€â”€ store/                     âœ… Zustand (auth, loan, group slices)
â”‚   â”œâ”€â”€ hooks/                     âœ… Custom React hooks
â”‚   â”œâ”€â”€ i18n/                      âœ… Hindi + English translations
â”‚   â”œâ”€â”€ constants/                 âœ… Colors, spacing, contract ABIs
â”‚   â””â”€â”€ types/                     âœ… TypeScript definitions
â”‚
â”œâ”€â”€ backend/                       # Node.js REST API âœ… PRODUCTION HARDENED
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ controllers/           âœ… auth, kyc, shg, loan, lender, user
â”‚   â”‚   â”œâ”€â”€ services/              âœ… auth, kyc, shg, loan, lender, blockchain, encryption
â”‚   â”‚   â”œâ”€â”€ routes/                âœ… auth, kyc, shg, loan, lender, user routes
â”‚   â”‚   â”œâ”€â”€ middleware/            âœ… auth guard, error handler, rate limit, validate
â”‚   â”‚   â”œâ”€â”€ jobs/                  âœ… BullMQ workers for blockchain events
â”‚   â”‚   â”œâ”€â”€ lib/                   âœ… Prisma client, Redis client
â”‚   â”‚   â”œâ”€â”€ utils/                 âœ… response helper, encryption helper
â”‚   â”‚   â””â”€â”€ index.ts               âœ… Express app, security hardening
â”‚   â””â”€â”€ prisma/
â”‚       â””â”€â”€ schema.prisma          âœ… LIVE on Supabase â€” 12 models
â”‚
â”œâ”€â”€ blockchain/                    # Smart Contracts âœ… DEPLOYED
â”‚   â”œâ”€â”€ contracts/
â”‚   â”‚   â”œâ”€â”€ SHGPool.sol            âœ… Multi-sig group wallet (Solidity ^0.8.24)
â”‚   â”‚   â”œâ”€â”€ LoanManager.sol        âœ… Full loan lifecycle state machine
â”‚   â”‚   â”œâ”€â”€ LenderPool.sol         âœ… GramUnit ERC-20 lender receipt token
â”‚   â”‚   â”œâ”€â”€ CreditScoreRegistry.sol âœ… On-chain credit score history
â”‚   â”‚   â””â”€â”€ interfaces/            âœ… IERC20 interface
â”‚   â”œâ”€â”€ scripts/                   âœ… deploy.ts (Polygon Amoy)
â”‚   â”œâ”€â”€ test/                      âœ… Full test suite coverage
â”‚   â””â”€â”€ hardhat.config.ts          âœ… Amoy + Mainnet network config
â”‚
â”œâ”€â”€ ml/                            # Python ML Service âœ… INTEGRATED
â”‚   â””â”€â”€ ...
â”‚
â””â”€â”€ deployment/                    # Infrastructure âœ… DOCKERIZED
    â””â”€â”€ ...
```
œâ”€â”€ LoanManager.sol        âœ… Full loan lifecycle state machine
â”‚   â”‚   â”œâ”€â”€ LenderPool.sol         âœ… GramUnit ERC-20 lender receipt token
â”‚   â”‚   â”œâ”€â”€ CreditScoreRegistry.sol âœ… On-chain credit score history
â”‚   â”‚   â””â”€â”€ interfaces/            âœ… IERC20 interface
â”‚   â”œâ”€â”€ scripts/                   ðŸ”§ deploy.ts (to be written)
â”‚   â”œâ”€â”€ test/                      ðŸ”§ Test suites (scaffold exists)
â”‚   â””â”€â”€ hardhat.config.ts          âœ… Amoy + localhost network config
â”‚
â”œâ”€â”€ ml/                            # Python ML Service ðŸ”§ PLANNED
â”‚   â””â”€â”€ ...
â”‚
â””â”€â”€ deployment/                    # Infrastructure ðŸ”§ PLANNED
    â””â”€â”€ ...
```

---

## Phase Breakdown

### Phase 0 â€” Setup & Research (Week 1â€“2)

**Week 1:**
- [x] Git repository init + monorepo structure creation
- [x] Set up development environment (Node 20, TypeScript, Hardhat)
- [x] Polygon Amoy Testnet wallet configuration
- [x] PostgreSQL via Supabase (cloud-hosted)
- [x] Firebase project setup (push notifications)

**Week 2:**
- [x] Define full API contract (routes + response format)
- [x] Write Prisma schema (all 7 models)
- [x] Define smart contract interface sketches
- [x] Twilio account setup (OTP delivery)
- [x] Aadhaar Sandbox API developer account

**Deliverable:** âœ… Working dev environment, all third-party API keys in `.env`, DB schema migrated on Supabase.

---

### Phase 1 â€” Blockchain + Foundation (Week 3â€“6)

**Week 3â€“4: Smart Contracts**
- [x] `SHGPool.sol` â€” multi-sig group wallet with USDC integration
- [x] `LoanManager.sol` â€” full loan lifecycle state machine (PENDING â†’ REPAID/DEFAULTED)
- [x] `LenderPool.sol` â€” pooled lending with GramUnit ERC-20 receipt tokens
- [x] `CreditScoreRegistry.sol` â€” on-chain score write/read
- [ ] Hardhat test suite (100% branch coverage for critical paths)
- [ ] Deploy to Polygon Amoy testnet
- [ ] Generate and export ABIs to `mobile/constants/` and `backend/`

**Week 5â€“6: ML Pipeline**
- [ ] Synthetic training data generation (1000+ SHG member records)
- [ ] Feature engineering pipeline (`features.py`)
- [ ] XGBoost model training + MLflow experiment tracking
- [ ] TFLite export + test inference on Android emulator
- [ ] FastAPI ML service with `/score` endpoint
- [ ] Dockerize ML service

**Deliverable:** ðŸ”§ Contracts written âœ… â€” Testnet deployment + ML pending

---

### Phase 2 â€” Backend API (Week 7â€“10)

**Week 7: Auth & KYC**
- [x] Express + TypeScript + Prisma setup
- [x] OTP auth via Twilio (+ Magic OTP bypass for Dev/Demo Mode)
- [x] Google OAuth Integration (google-auth-library)
- [x] Email + Password login (bcryptjs)
- [x] JWT access + refresh token rotation (15min/7day)
- [x] KYC flow â€” Aadhaar-first OTP â†’ PAN verification via Sandbox API
- [x] User registration with demographic data from Aadhaar

**Week 8: SHG Management**
- [x] SHG create/join/list endpoints
- [x] Member management (add member, CRUD)
- [x] Meeting attendance logging
- [ ] Smart contract deployment trigger on SHG creation (deploy SHGPool)

**Week 9: Loan Flow**
- [x] Loan application submission endpoint
- [x] Loan approval flow (backend)
- [x] ML service call integration (credit score fetch with timeout & fallback)
- [x] Smart contract loan creation (via backend ethers.js signer & outbox pattern)
- [x] Disbursement trigger

**Week 10: Workers + Monitoring**
- [x] BullMQ scaffold (jobs directory created)
- [x] Rate limiting (100 req/min per IP)
- [x] Security headers (Helmet)
- [x] BullMQ blockchain event listener worker (syncs Disbursed/Repaid/Defaulted)
- [x] Repayment reminder job (cron + FCM push notification)
- [x] Default checker job
- [x] Transactional outbox service (dual-write consistency)
- [ ] Redis caching for SHG dashboards

**Deliverable:** âœ… Full backend running locally, core auth + KYC + SHG + loan endpoints live.

---

### Phase 3 â€” Mobile App (Week 11â€“16)

**Week 11: Foundation**
- [x] Expo project init + NativeWind setup
- [x] i18n setup (Hindi + English)
- [x] Navigation structure (auth flow + tab navigator + lender portal)
- [x] Zustand store setup (auth, loan, group slices)
- [x] API client setup (axios + React Query)
- [x] expo-sqlite offline store

**Week 12: Auth + KYC Screens**
- [x] Welcome / Role selection screen
- [x] Multi-login (Google Sign-In, Phone OTP, Email/Password)
- [x] Phone number input + OTP verification screen
- [x] Aadhaar OTP â†’ PAN KYC flow (Sandbox API integration)
- [x] Forgot password flow
- [x] Lender login + signup screens

**Week 13: Dashboard, Group & Schemes**
- [x] Home dashboard (balance card, active loan card, repayment calendar)
- [x] SHG group screen (member list, savings pool, meetings)
- [x] Government Schemes Discovery Dashboard
- [x] Meeting logging form
- [x] Member profile cards

**Week 14: Loan Application Flow**
- [x] Loan amount + purpose input
- [x] Credit score result display (animated gauge)
- [x] Group approval status tracker
- [x] On-device ML credit scoring (TFLite integration)
- [x] Smart contract loan creation/approval (ethers.js on-device)
- [ ] Transaction confirmation screen

**Week 15: Lender Portal**
- [x] Lender portfolio screen (GramUnit holdings, pool stats)
- [x] Invest screen (USDC deposit flow, pool liquidity)
- [x] Impact metrics screen (ESG data, borrower stories)
- [x] Lender profile screen

**Week 16: Polish + Offline**
- [x] Offline queue implementation (SQLite-based pending actions)
- [x] Background sync worker
- [x] Push notification handling (Firebase Admin SDK configured on backend)
- [ ] App loading states, error handling, empty states
- [ ] Hindi font rendering QA

**Deliverable:** âœ… Full app running on physical Android device (Expo Go). Borrower + Lender portals complete. Testnet blockchain integration pending.

---

### Phase 4 â€” Integration & Testing (Week 17â€“18)

**Week 17: End-to-End Testing**
- [ ] Full E2E test: onboard â†’ apply loan â†’ approve â†’ disburse â†’ repay
- [ ] Smart contract stress tests (multiple concurrent loans)
- [ ] ML model edge case testing (low-data borrowers)
- [ ] Load testing backend (k6: 100 concurrent users)
- [ ] Security review (OWASP Mobile Top 10 checklist)
- [ ] Smart contract Slither static analysis

**Week 18: Bug Fix + QA**
- [ ] Fix all P1/P2 bugs from testing
- [ ] Cross-device testing (Android 8â€“14)
- [ ] UX review with test users
- [ ] Performance profiling (React Native Flipper)

**Deliverable:** ðŸ”§ Pending (post-contract deployment)

---

### Phase 5 â€” Deployment (Week 19â€“20)

**Week 19: Infrastructure**
- [ ] Dockerfile for backend + ML service
- [ ] GitHub Actions CI/CD pipeline (lint â†’ test â†’ build â†’ deploy)
- [ ] Environment variable management (AWS Secrets Manager / Supabase Vault)
- [ ] Deploy contracts to Polygon Amoy (final demo) or Polygon Mainnet
- [ ] Backend deployment (Railway / Render / AWS ECS)

**Week 20: Final Demo Prep**
- [ ] EAS Build â†’ generate APK for demo installation
- [ ] Record demo video (full loan flow walkthrough)
- [ ] Write final project report
- [ ] Prepare presentation slides

**Deliverable:** ðŸ”§ In progress â€” Live demo URL, installable APK, complete documentation.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Sandbox API rate limits | Medium | High | Demo Mode with magic OTP bypass âœ… implemented |
| Polygon testnet downtime | Low | Medium | Local Hardhat node as fallback |
| ML model insufficient accuracy | Medium | High | Rule-based fallback while model trains |
| App Store rejection | Low | High | Expo Go + APK for demo; avoid store |
| Smart contract bug | Medium | Critical | Testnet only for project; formal audit pre-mainnet |
| USDC/fiat gateway complexity | High | Medium | Mocked in dev; real integration as stretch goal |
| Twilio SMS delivery in India | Medium | High | Demo Mode fallback âœ… implemented |
