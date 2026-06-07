# 🌿 GramChain — Decentralized Micro-Lending for Rural India

> **A DeFi platform connecting Self-Help Groups (SHGs) to fair, transparent, and instant credit through blockchain infrastructure and on-device ML.**

[![GitHub](https://img.shields.io/badge/Repo-Gursharandeepsingh042%2FGramchain-green)](https://github.com/Gursharandeepsingh042/Gramchain)
[![Backend](https://img.shields.io/badge/Backend-Live%20on%20Port%203000-brightgreen)](#)
[![Mobile](https://img.shields.io/badge/Mobile-Expo%20Dev%20Server%20Running-blue)](#)
[![Blockchain](https://img.shields.io/badge/Blockchain-Polygon%20Amoy%20Testnet-purple)](#)
[![DB](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-teal)](#)

---

## 📖 What is GramChain?

India has over **7.8 crore microfinance borrowers** — yet rural SHG members are forced to borrow from informal moneylenders at **36–120% APR**. GramChain replaces trust-in-intermediaries with **trust-in-code**.

It deploys Solidity smart contracts on **Polygon** to automate loan origination, disbursement, repayment tracking, and default detection using **USDC stablecoins**. An **on-device ML model** scores creditworthiness using alternative data (meeting attendance, savings behaviour, repayment history) — no CIBIL score required. A **React Native mobile app** delivers the experience in Hindi and English with offline-first architecture.

---

## 🏗️ Project Status — April 2026

| Module | Status | Notes |
|--------|--------|-------|
| 🔐 **Authentication** | ✅ Complete | Phone OTP, Google OAuth, Email/Password, JWT refresh rotation, FCM cleanup |
| 🆔 **KYC Flow** | ✅ Complete | Aadhaar-first → OTP → PAN verification via Sandbox API |
| 📱 **Borrower Mobile App** | ✅ Complete | Dashboard, Borrow, Group, Profile, Govt Schemes — all screens |
| 💼 **Lender Portal (Mobile)** | ✅ Complete | Portfolio, Invest, Impact, Lender Profile screens |
| 🏦 **SHG Management** | ✅ Complete | Create/join groups, member management, meeting logs |
| 🔗 **Smart Contracts** | ✅ Written | LoanManager, SHGPool, LenderPool, CreditScoreRegistry — compiled |
| 🌐 **Backend API** | ✅ Live | Running on port 3000, Supabase PostgreSQL connected |
| 🗄️ **Database** | ✅ Migrated | Prisma schema live on Supabase (PostgreSQL) |
| 🔔 **Notifications** | ✅ Complete | FCM push + in-app, Hindi/English templates, quiet hours |
| 🧪 **Testing** | ✅ Active | Jest + ts-jest, unit tests for auth & loan services |
| ⚙️ **CI/CD** | ✅ Active | GitHub Actions — backend build/test, contract compile/test |
| 🤖 **ML Service** |✅ Active | FastAPI + TFLite pipeline — Phase 2 |
| 🚀 **Blockchain Deployment** |✅ Active | Contracts written; mainnet deployed polygon|
| 📊 **Production Mode** | ✅ Active |available for dev testing and internal testing |

---

## 🛠️ Tech Stack

### 📱 Mobile (React Native / Expo)

| Technology | Version | Purpose |
|------------|---------|---------|
| **React Native** | 0.81.5 | Core cross-platform framework |
| **Expo** | ~54.0.0 | Managed workflow + build system |
| **Expo Router** | ~6.0.23 | File-based navigation (Auth, Tabs, Lender portals) |
| **TypeScript** | ~5.9.2 | Type safety across the app |
| **Zustand** | ^4.5.5 | Global state (auth, loan, group slices) |
| **TanStack React Query** | ^5.56.2 | Server state + caching |
| **Axios** | ^1.7.7 | HTTP API client |
| **ethers.js** | ^6.16.0 | Blockchain wallet + contract interaction |
| **NativeWind** | ^4.0.1 | TailwindCSS for React Native |
| **i18next** | ^23.15.1 | Hindi + English localization |
| **React Hook Form** | ^7.53.0 | Form state management |
| **expo-secure-store** | ~15.0.8 | Encrypted key storage (JWT tokens) |
| **expo-sqlite** | ~16.0.10 | Offline-first local database |
| **react-native-mmkv** | ^4.3.1 | High-performance key-value store |
| **expo-local-authentication** | ~17.0.8 | Biometric auth |
| **expo-notifications** | ~0.32.16 | Firebase push notification handling |

### ⚙️ Backend (Node.js / Express)

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20 LTS | Runtime |
| **Express.js** | ^4.21.0 | REST API framework |
| **TypeScript** | ^5.6.2 | Type safety |
| **Prisma ORM** | ^5.19.0 | Database access layer |
| **PostgreSQL** | 16 (Supabase) | Primary database |
| **Redis** | ^4.7.0 | Caching + BullMQ job queue |
| **BullMQ** | ^5.7.0 | Background jobs (blockchain events, reminders) |
| **ethers.js** | ^6.13.0 | Server-side contract calls + event listening |
| **JWT** | ^9.0.2 | Access + refresh token auth |
| **bcryptjs** | ^3.0.3 | Password hashing |
| **Twilio** | ^5.13.1 | Production SMS OTP delivery |
| **Google Auth Library** | ^10.6.2 | Google OAuth token verification |
| **Zod** | ^3.23.8 | Runtime request validation |
| **Helmet** | ^8.0.0 | HTTP security headers |
| **express-rate-limit** | ^7.4.0 | API rate limiting |
| **Morgan** | ^1.10.0 | HTTP request logging |
| **Axios** | ^1.15.0 | External API calls (KYC Sandbox) |

### ⛓️ Blockchain (Hardhat / Solidity)

| Technology | Version | Purpose |
|------------|---------|---------|
| **Solidity** | ^0.8.24 | Smart contract language |
| **Hardhat** | ^2.28.6 | Compile, test, deploy framework |
| **OpenZeppelin** | ^5.0.2 | Battle-tested contract libraries |
| **ethers.js** | v6 | Contract interaction in scripts |
| **TypeScript** | ^5.6.2 | Typed deployment + test scripts |
| **Polygon Amoy** | Testnet | Target deployment network |

### 🗄️ Database (Supabase / PostgreSQL)

| Technology | Purpose |
|------------|---------|
| **Supabase** | Hosted PostgreSQL (cloud) |
| **Prisma** | Schema management + migrations |
| **PostgreSQL 16** | Relational data (Users, SHGs, Loans, Repayments) |
| **Redis** | OTP rate limiting, job queues, cache |

---

## 📁 Monorepo Structure

```
gramchain/
├── backend/                    # ✅ Node.js REST API (running on :3000)
│   ├── src/
│   │   ├── controllers/        # Auth, KYC, SHG, Loan, Lender
│   │   ├── services/           # Business logic layer
│   │   ├── routes/             # API route definitions
│   │   ├── middleware/         # Auth guard, error handler, rate limit
│   │   ├── jobs/               # BullMQ background workers
│   │   ├── lib/                # Prisma client, Redis client
│   │   └── index.ts            # Express app entry point
│   └── prisma/
│       └── schema.prisma       # ✅ Database schema (live on Supabase)
│
├── mobile/                     # ✅ React Native App (Expo DevServer running)
│   ├── app/
│   │   ├── (auth)/             # ✅ Welcome, Login, Signup, OTP, KYC, Role Select
│   │   ├── (tabs)/             # ✅ Dashboard, Borrow, Group, Profile, Schemes
│   │   └── (lender)/           # ✅ Portfolio, Invest, Impact, Lender Profile
│   ├── components/             # Reusable UI primitives
│   ├── services/               # API client, blockchain wrapper
│   ├── store/                  # Zustand state slices
│   ├── hooks/                  # Custom React hooks
│   ├── i18n/                   # Hindi + English translations
│   ├── constants/              # Colors, contract ABIs
│   └── types/                  # TypeScript definitions
│
├── blockchain/                 # ✅ Smart Contracts (written, pending deployment)
│   ├── contracts/
│   │   ├── SHGPool.sol         # Multi-sig group wallet
│   │   ├── LoanManager.sol     # Full loan lifecycle
│   │   ├── LenderPool.sol      # Lender deposit + GramUnit ERC-20
│   │   └── CreditScoreRegistry.sol  # On-chain credit history
│   ├── scripts/                # Hardhat deploy + verify scripts
│   ├── test/                   # Contract test suites
│   └── hardhat.config.ts
│
├── ml/                         # Deployed on render 
│   └── ...
│
├── deployment/                 # Deployed on Render and Expo
│   └── ...
│
└── docs/                       # 📚 Project documentation
    ├── PRD.md
    ├── SYSTEM_DESIGN.md
    ├── IMPLEMENTATION_PLAN.md
    └── SKILL_*.md              # Skill-specific guides
```

---

## 🔗 Smart Contracts Overview

| Contract | Status | Description |
|----------|--------|-------------|
| `SHGPool.sol` | ✅ Written | Multi-sig wallet per SHG group, quorum-based loan approval |
| `LoanManager.sol` | ✅ Written | Loan lifecycle: PENDING → ACTIVE → REPAID/DEFAULTED |
| `LenderPool.sol` | ✅ Written | Lender deposits USDC, receives **GramUnit (GRAM)** ERC-20 shares |
| `CreditScoreRegistry.sol` | ✅ Written | Immutable on-chain credit score history |
| **Mainnet Deployment** | ✅ Deployed | Target: Polygon Amoy Testnet |

---

## 🔐 Backend API Routes

```
POST   /api/v1/auth/send-otp          → Send OTP via Twilio (or DEMO_MODE)
POST   /api/v1/auth/verify-otp        → Verify OTP, return JWT pair
POST   /api/v1/auth/register          → Register user details post-OTP
POST   /api/v1/auth/login             → Email + password login
POST   /api/v1/auth/google            → Google ID Token login
POST   /api/v1/auth/refresh           → Rotate refresh token

POST   /api/v1/kyc/aadhaar/send-otp   → Aadhaar OTP via Sandbox API
POST   /api/v1/kyc/aadhaar/verify     → Verify Aadhaar OTP, save demographics
POST   /api/v1/kyc/pan/verify         → PAN verification (uses Aadhaar name+DOB)

GET    /api/v1/shg/                   → List SHGs
POST   /api/v1/shg/create             → Create new SHG group
GET    /api/v1/shg/:id                → Group details + members
POST   /api/v1/shg/:id/join           → Join a group

POST   /api/v1/loan/apply             → Submit loan application
GET    /api/v1/loan/:id               → Loan details
POST   /api/v1/loan/:id/approve       → Approve loan (leader)

GET    /api/v1/lender/dashboard       → Lender pool stats
POST   /api/v1/lender/deposit         → Deposit USDC to pool
```

---

## 🗄️ Database Schema (Prisma / PostgreSQL)

| Table | Purpose |
|-------|---------|
| `users` | All users (borrowers + lenders), KYC status, wallet address |
| `shg_groups` | SHG group registry with on-chain pool contract address |
| `shg_members` | Many-to-many: user ↔ group with role (MEMBER/LEADER) |
| `loans` | Full loan record: amount, status, ML score, on-chain ID, EMI schedule |
| `repayments` | Individual repayment events with on-chain tx hash |
| `meetings` | SHG meeting attendance records |
| `otp_records` | OTP store with expiry + rate-limit tracking |

---

## 📱 Mobile Screens

### Borrower App (`(tabs)/`)
| Screen | Status | Features |
|--------|--------|----------|
| `index.tsx` (Dashboard) | ✅ | Balance card, active loans, repayment calendar |
| `borrow.tsx` | ✅ | Loan application form, ML credit score display |
| `group.tsx` | ✅ | SHG members, savings pool, meeting logs |
| `profile.tsx` | ✅ | KYC status, settings, transaction history |
| `schemes.tsx` | ✅ | Government schemes discovery dashboard |

### Auth Screens (`(auth)/`)
| Screen | Status |
|--------|--------|
| `welcome.tsx` | ✅ Language select + role introduction |
| `login.tsx` | ✅ Phone OTP + Google Sign-In |
| `signup.tsx` | ✅ Registration with phone verification |
| `verify-otp.tsx` | ✅ OTP entry + resend |
| `kyc.tsx` | ✅ Aadhaar OTP → PAN verification flow |
| `lender-login.tsx` | ✅ Lender-specific login |
| `lender-signup.tsx` | ✅ Lender registration |
| `role-select.tsx` | ✅ Borrower / Lender role selection |
| `forgot-password.tsx` | ✅ Password reset via phone |

### Lender Portal (`(lender)/`)
| Screen | Status | Features |
|--------|--------|----------|
| `portfolio.tsx` | ✅ | Investment portfolio, GramUnit holdings |
| `invest.tsx` | ✅ | USDC deposit flow, pool liquidity view |
| `impact.tsx` | ✅ | ESG metrics, borrower success stories |
| `lender-profile.tsx` | ✅ | Lender account management |

---

## ⚡ Getting Started

### Prerequisites
- Node.js 20+
- Expo CLI (`npm install -g expo-cli`)
- Supabase project (or local PostgreSQL)
- Redis instance
- `.env` configured (see `backend/.env.example`)

### Backend

```bash
cd backend
npm install
npm run db:push          # Push Prisma schema to Supabase
npm run dev              # Start API on :3000
```

### Mobile

```bash
cd mobile
npm install
npx expo start           # Start Expo dev server
```

### Blockchain

```bash
cd blockchain
npm install
npx hardhat compile      # Compile contracts
npx hardhat test         # Run test suite
npx hardhat run scripts/deploy.ts --network amoy  # Deploy to testnet
```

---

## 🌍 Demo Mode

Set `DEMO_MODE=true` in `backend/.env` to enable:
- **Random OTP** in server logs (no Twilio needed)
- **Demo OTP**: enter `123456` to skip OTP verification
- **Aadhaar bypass**: use `000000000000`
- **PAN bypass**: use `ABCDE1234F`

---

## 🧪 Testing

```bash
cd backend
npm test                 # Run all unit tests
npm test -- --coverage   # With coverage report
```

**Test suites:**
- `auth.service.test.ts` — OTP flow, password login, registration, logout, FCM cleanup
- `loan.service.test.ts` — Application, approval, repayment, credit scoring, edge cases

**CI Pipeline:** Tests run automatically on every push/PR via GitHub Actions (`.github/workflows/ci.yml`).

---

## 🔒 Security

- JWT Access Token: **15 minutes** | Refresh Token: **7 days** (rotated)
- OTP rate limit: **5 requests per 10 minutes** per phone number
- All PII hashed: Aadhaar → `SHA-256(aadhaar)`, PAN → `SHA-256(pan)`
- Smart contracts use **ReentrancyGuard**, **Pausable**, **AccessControl** (OpenZeppelin)
- API rate limit: **100 requests/minute** per IP

---

## 📚 Documentation

| File | Description |
|------|-------------|
| [`docs/PRD.md`](docs/PRD.md) | Product Requirements Document |
| [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md) | Full system architecture |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | 20-week phase breakdown with status |
| [`docs/SKILL_BACKEND.md`](docs/SKILL_BACKEND.md) | Backend development guide |
| [`docs/SKILL_FRONTEND.md`](docs/SKILL_FRONTEND.md) | Frontend development guide |
| [`docs/SKILL_DEPLOYMENT.md`](docs/SKILL_DEPLOYMENT.md) | Deployment & DevOps guide |

---

## 👨‍💻 Author

Final Year Project, April 2026 

**Riya Sharma** 

**Lakshiyta Bhatti**

**Raghav Chaudhary**

**Gursharan Deep Singh**


GitHub: [@Gursharandeepsingh042](https://github.com/Gursharandeepsingh042)

---

*GramChain is not a crypto app. It is a financial inclusion tool that happens to use blockchain infrastructure where it adds the most value: immutable audit trails, programmable repayment, and elimination of middlemen.*
