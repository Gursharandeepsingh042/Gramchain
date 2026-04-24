# GramChain — Implementation Plan
**Total Duration:** 20 Weeks (Final Year Project Timeline)

---

## Folder Structure

```
gramchain/
│
├── docs/                          # Project documentation
│   ├── PRD.md
│   ├── SYSTEM_DESIGN.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── API_SPEC.md
│
├── mobile/                        # React Native App (Expo)
│   ├── app/
│   │   ├── (auth)/                # Auth screens (file-based routing)
│   │   │   ├── welcome.tsx
│   │   │   ├── login.tsx
│   │   │   ├── signup.tsx
│   │   │   ├── verify-otp.tsx
│   │   │   ├── kyc.tsx
│   │   │   └── forgot-password.tsx
│   │   ├── (tabs)/                # Main app tabs
│   │   │   ├── index.tsx          # Dashboard
│   │   │   ├── borrow.tsx
│   │   │   ├── group.tsx
│   │   │   ├── profile.tsx
│   │   │   └── schemes.tsx        # Govt Schemes DB
│   │   └── _layout.tsx
│   ├── components/
│   │   ├── ui/                    # Reusable primitives
│   │   ├── loan/                  # Loan-specific components
│   │   └── group/                 # SHG group components
│   ├── hooks/                     # Custom React hooks
│   ├── services/
│   │   ├── api.ts                 # API client (axios)
│   │   ├── blockchain.ts          # ethers.js wrapper
│   │   ├── storage.ts             # SQLite + MMKV
│   │   ├── wallet.ts              # Key management
│   │   └── ml.ts                  # TFLite inference
│   ├── store/                     # Zustand global state
│   ├── i18n/                      # Translations
│   │   ├── en.json
│   │   └── hi.json
│   ├── types/                     # TypeScript types
│   ├── utils/                     # Helpers
│   ├── constants/                 # Config, contract ABIs
│   ├── assets/                    # Images, fonts, ML model
│   │   └── models/
│   │       └── credit_score.tflite
│   ├── app.json
│   ├── eas.json
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                       # Node.js REST API
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── shg.controller.ts
│   │   │   ├── loan.controller.ts
│   │   │   └── user.controller.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── blockchain.service.ts
│   │   │   ├── kyc.service.ts
│   │   │   ├── loan.service.ts
│   │   │   └── notification.service.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── validate.middleware.ts
│   │   │   └── rateLimit.middleware.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── shg.routes.ts
│   │   │   └── loan.routes.ts
│   │   ├── jobs/                  # BullMQ workers
│   │   │   ├── blockchain-listener.job.ts
│   │   │   ├── repayment-reminder.job.ts
│   │   │   └── default-checker.job.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── utils/
│   │   ├── types/
│   │   └── index.ts
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── ml/                            # Python ML Service
│   ├── api/
│   │   ├── main.py                # FastAPI app
│   │   ├── routes/
│   │   │   └── score.py
│   │   └── schemas.py
│   ├── model/
│   │   ├── train.py               # Training pipeline
│   │   ├── features.py            # Feature engineering
│   │   ├── evaluate.py
│   │   └── export_tflite.py       # TFLite export
│   ├── data/
│   │   ├── synthetic_generator.py # Generate training data
│   │   └── sample_data.csv
│   ├── notebooks/
│   │   └── exploration.ipynb
│   ├── tests/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── mlflow_config.yaml
│
├── blockchain/                    # Smart Contracts
│   ├── contracts/
│   │   ├── SHGPool.sol
│   │   ├── LoanManager.sol
│   │   ├── CreditScoreRegistry.sol
│   │   └── interfaces/
│   │       └── IERC20.sol
│   ├── scripts/
│   │   ├── deploy.ts
│   │   └── verify.ts
│   ├── test/
│   │   ├── SHGPool.test.ts
│   │   ├── LoanManager.test.ts
│   │   └── CreditScore.test.ts
│   ├── hardhat.config.ts
│   ├── package.json
│   └── .env.example
│
├── deployment/                    # Infrastructure as Code
│   ├── docker-compose.yml         # Local dev environment
│   ├── docker-compose.prod.yml
│   ├── nginx/
│   │   └── nginx.conf
│   ├── terraform/                 # AWS infra
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── k8s/                       # Optional Kubernetes
│       ├── backend-deployment.yaml
│       └── ml-deployment.yaml
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-backend.yml
│       └── deploy-mobile.yml
│
├── requirements.txt               # Project-level Python deps
└── README.md
```

---

## Phase Breakdown

### Phase 0 — Setup & Research (Week 1–2)

**Week 1:**
- [ ] Git repository init + monorepo structure creation
- [ ] Set up development environment (Node 20, Python 3.11, Foundry/Hardhat)
- [ ] Polygon Amoy Testnet wallet + MATIC faucet
- [ ] USDC testnet setup (Circle developer account)
- [ ] Figma design file init (design system + wireframes)
- [ ] PostgreSQL + Redis local setup via Docker Compose
- [ ] Firebase project creation (push notifications)

**Week 2:**
- [ ] Review NABARD SHG data reports for ML feature design
- [ ] DigiLocker API developer account + sandbox testing
- [ ] Transak API sandbox account (fiat ↔ crypto gateway)
- [ ] Define full API contract (OpenAPI 3.0 spec)
- [ ] Write Prisma schema (all tables)
- [ ] Define smart contract interface sketches

**Deliverable:** Working dev environment, all third-party API keys in `.env`, DB schema migrated locally.

---

### Phase 1 — Blockchain + ML Foundation (Week 3–6)

**Week 3–4: Smart Contracts**
- [ ] `SHGPool.sol` — multi-sig group wallet with USDC integration
- [ ] `LoanManager.sol` — full loan lifecycle state machine
- [ ] `CreditScoreRegistry.sol` — on-chain score write/read
- [ ] Hardhat test suite (100% branch coverage for critical paths)
- [ ] Deploy to Polygon Amoy testnet
- [ ] Generate and export ABIs to `mobile/constants/` and `backend/`

**Week 5–6: ML Pipeline**
- [ ] Synthetic training data generation (1000+ SHG member records)
- [ ] Feature engineering pipeline (`features.py`)
- [ ] XGBoost model training + MLflow experiment tracking
- [ ] Model evaluation (precision, recall, F1, AUC-ROC)
- [ ] TFLite export + test inference on Android emulator
- [ ] FastAPI ML service with `/score` endpoint
- [ ] Dockerize ML service

**Deliverable:** All 3 contracts deployed on testnet, ML model with >80% F1, TFLite file ready for bundling.

---

### Phase 2 — Backend API (Week 7–10)

**Week 7: Project Setup + Auth**
- [ ] Express + TypeScript + Prisma setup
- [ ] OTP auth (Fast2SMS/MSG91 + Magic OTP bypass)
- [ ] Google OAuth Integration
- [ ] JWT auth middleware (with refresh tokens)
- [ ] KYC flow (PAN verification + Aadhaar Sandbox)
- [ ] User registration + wallet generation API

**Week 8: SHG Management**
- [ ] SHG create/join/manage endpoints
- [ ] Smart contract deployment trigger (on SHG creation, deploy SHGPool)
- [ ] Meeting attendance logging
- [ ] Member management CRUD

**Week 9: Loan Flow**
- [ ] Loan application submission
- [ ] ML service call integration (credit score fetch)
- [ ] Smart contract loan creation (via backend signer)
- [ ] Loan approval flow (multi-sig quorum tracking)
- [ ] Disbursement trigger

**Week 10: Workers + Monitoring**
- [ ] BullMQ blockchain event listener worker
- [ ] Repayment reminder job (cron-based, push notification)
- [ ] Default checker job (checks overdue EMIs)
- [ ] Redis caching for SHG dashboards
- [ ] Sentry error tracking integration
- [ ] API rate limiting + security headers

**Deliverable:** Full backend running locally, all endpoints tested with Postman/Thunder Client.

---

### Phase 3 — Mobile App (Week 11–16)

**Week 11: Foundation**
- [ ] Expo project init + NativeWind setup
- [ ] i18n setup (Hindi + English)
- [ ] Navigation structure (auth flow + tab navigator)
- [ ] Zustand store setup (auth, loan, group, wallet slices)
- [ ] API client setup (axios + React Query)
- [ ] SQLite offline store setup

**Week 12: Auth + KYC Screens**
- [ ] Welcome / Language selection screen
- [ ] Multi-login (Google Sign-In, Phone/Password)
- [ ] Phone number input + OTP verification
- [ ] PAN Check + Aadhaar KYC integration (Sandbox)
- [ ] Wallet generation + secure storage
- [ ] SHG registration / join flow

**Week 13: Dashboard, Group, & Schemes**
- [ ] Home dashboard (balance, active loan card, repayment calendar)
- [ ] SHG group screen (member list, savings pool, meetings)
- [ ] Government Schemes Discovery Dashboard
- [ ] Meeting logging form
- [ ] Member profile cards

**Week 14: Loan Application Flow**
- [ ] Loan amount + purpose input
- [ ] On-device ML credit scoring (TFLite integration)
- [ ] Credit score result display (animated gauge)
- [ ] Group approval status tracker
- [ ] Smart contract loan creation (ethers.js)
- [ ] Transaction confirmation screen

**Week 15: Repayment + Wallet**
- [ ] Active loan repayment flow (EMI payment button)
- [ ] USDC → UPI off-ramp integration (Transak widget)
- [ ] Transaction history screen
- [ ] On-chain receipt viewer
- [ ] Wallet balance + QR code

**Week 16: Polish + Offline**
- [ ] Offline queue implementation (SQLite-based pending actions)
- [ ] Background sync worker
- [ ] Push notification handling (Firebase)
- [ ] App loading states, error handling, empty states
- [ ] Accessibility audit (screen reader support)
- [ ] Hindi font rendering QA

**Deliverable:** Full app running on physical Android device, end-to-end loan flow working on testnet.

---

### Phase 4 — Integration & Testing (Week 17–18)

**Week 17: End-to-End Testing**
- [ ] Full E2E test: onboard → apply loan → approve → disburse → repay
- [ ] Smart contract stress tests (multiple concurrent loans)
- [ ] ML model edge case testing (low-data borrowers)
- [ ] Load testing backend (k6: 100 concurrent users)
- [ ] Security review (OWASP Mobile Top 10 checklist)
- [ ] Smart contract Slither static analysis

**Week 18: Bug Fix + QA**
- [ ] Fix all P1/P2 bugs from testing
- [ ] Cross-device testing (Android 8–14)
- [ ] UX review with test users (if available)
- [ ] Performance profiling (React Native Flipper)

**Deliverable:** Stable build, all critical bugs resolved.

---

### Phase 5 — Deployment (Week 19–20)

**Week 19: Infrastructure**
- [ ] AWS account setup + Terraform apply (ECS, RDS, Redis, S3)
- [ ] GitHub Actions CI/CD pipeline setup
- [ ] Environment variable management (AWS Secrets Manager)
- [ ] SSL certificate (ACM) + domain setup
- [ ] Deploy backend + ML service to ECS Fargate
- [ ] Run DB migrations on RDS
- [ ] Deploy contracts to Polygon Mainnet (or keep on Amoy for project demo)

**Week 20: Final Demo Prep**
- [ ] EAS Build → generate APK for demo installation
- [ ] Record demo video (full loan flow walkthrough)
- [ ] Write final project report
- [ ] Prepare presentation slides
- [ ] Deploy demo frontend dashboard (Next.js on Vercel — optional)

**Deliverable:** Live demo URL, installable APK, complete documentation.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| DigiLocker API rate limits in sandbox | Medium | High | Cache KYC responses, mock in dev |
| Polygon testnet downtime | Low | Medium | Local Hardhat node as fallback |
| ML model insufficient accuracy | Medium | High | Start with rule-based fallback, improve iteratively |
| App Store rejection | Low | High | Use Expo Go + APK for demo; avoid store submission |
| Smart contract bug with funds | Medium | Critical | Testnet only for project; formal audit pre-mainnet |
| USDC/fiat gateway integration complexity | High | Medium | Mock gateway in dev; real integration as stretch goal |
