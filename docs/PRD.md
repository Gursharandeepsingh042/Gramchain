# GramChain — Product Requirements Document (PRD)
**Version:** 1.4.0 | **Status:** Production Readiness | **Author:** Gursharandeep Singh  
**Date:** April 26, 2026 | **Build:** Backend ✅ Live | Mobile ✅ Production Hardened | Contracts ✅ Deployed (Testnet)

---

## Abstract

India's rural Self-Help Groups (SHGs) represent one of the largest grassroots financial networks in the world — yet they remain trapped in a cycle of informal, high-interest borrowing. As of March 2024, India's gross microfinance loan portfolio stood at ₹4.33 lakh crore serving over 7.8 crore borrowers, yet rural SHG members continue to approach unorganized moneylenders charging 3–10% interest *per month*. The gap exists not because SHGs lack creditworthiness, but because the infrastructure connecting them to fair capital is broken, opaque, and heavily intermediated.

**GramChain** is a decentralized micro-lending mobile platform built exclusively for SHGs. It replaces trust-in-intermediaries with trust-in-code — deploying Solidity smart contracts on Polygon (a low-fee EVM chain) to automate loan origination, disbursement, repayment tracking, and penalty enforcement.

*Note on Blockchain & Stablecoins:* While the initial design envisioned USDC transfers, the current phase prioritizes using the blockchain as an **immutable audit ledger**. We are not using USDC stablecoin transfers yet. Instead, we are building the blockchain flow purely to record and verify transactions (deposits, loan approvals, EMI payments), ensuring transparent bookkeeping without regulatory friction or fiat-conversion complexities.

An on-device ML model scores creditworthiness using alternative data (repayment history, SHG meeting attendance, group savings behaviour) rather than requiring a CIBIL score that most rural borrowers don't have. A React Native cross-platform mobile app delivers the experience in Hindi and English with offline-first architecture.

---

## 1. Problem Statement

| Dimension | Current Reality |
|-----------|----------------|
| **Interest Rates** | Informal lenders charge 36–120% APR vs. 12–24% from formal MFIs |
| **Transparency** | Loan ledgers are paper-based, opaque, often manipulated |
| **Credit Scoring** | 70%+ of rural SHG members have no formal credit score |
| **Disbursement Speed** | Formal loans take 2–6 weeks; urgent needs go to moneylenders |
| **Repayment Tracking** | Manual; disputes are common and under-documented |
| **Group Accountability** | SHG collective guarantee is informally enforced, not digitally |

---

## 2. Vision & Mission

**Vision:** A world where every SHG member has access to fair, transparent, and instant credit without needing a bank account or a credit score.

**Mission:** Build the simplest, most trustworthy micro-lending layer for rural India using Web3 infrastructure and ML — invisible to the user, powerful in the backend.

---

## 3. Target Users (Personas)

### 3.1 Meera — SHG Member (Primary Borrower)
- Age 28–55, rural/semi-urban, Rajasthan or Jharkhand
- Basic smartphone literacy (WhatsApp user)
- No CIBIL score, Jan Dhan bank account
- Needs ₹5,000–₹50,000 for agricultural inputs or small business
- Speaks Hindi; reads Devanagari script

### 3.2 Savita — SHG Group Leader (Admin)
- Manages 10–20 members
- Tracks group savings, meetings, loan applications
- Interfaces with NABARD/NRLM officials
- Currently uses physical ledger books

### 3.3 Impact Investor / Lender (Secondary Actor)
- NGO, CSR fund, or individual impact investor
- Wants transparent deployment of capital with on-chain proof
- Needs dashboard with repayment analytics and ESG metrics

---

## 4. Platform Architecture & Features

### 4.1 Mobile Application (React Native / Expo)
The app is divided via a Role Selection flow into two distinct portals: Borrower (SHG) and Lender.

**Auth Flow (`mobile/app/(auth)`):**
- `welcome.tsx`: Initial branding and language selection.
- `role-select.tsx`: Gateway choosing between SHG Member/Borrower and Investor/Lender.
- `login.tsx` / `signup.tsx`: Borrower authentication (Phone + OTP).
- `lender-login.tsx` / `lender-signup.tsx`: Lender authentication.
- `kyc.tsx`: Aadhaar/PAN verification for regulatory compliance.
- `verify-otp.tsx`: General OTP verification.
- `forgot-password.tsx`: Password recovery.

**Borrower / SHG Portal (`mobile/app/(tabs)`):**
- `index.tsx` (Dashboard): Overview of active loans, next EMI, and quick actions.
- `borrow.tsx`: Loan application flow incorporating the on-device ML credit score.
- `group.tsx`: SHG group management, meeting logs, collective savings overview.
- `schemes.tsx`: Discovery dashboard for relevant government schemes (e.g., PM-KISAN).
- `profile.tsx`: User settings, language preferences, connected bank accounts.

**Lender / Investor Portal (`mobile/app/(lender)`):**
- `portfolio.tsx`: Track active investments, yield, and overall capital deployed.
- `invest.tsx`: Marketplace of verified SHG pools to deposit funds into.
- `impact.tsx`: ESG reporting, social impact metrics (e.g., women empowered, jobs created).
- `lender-profile.tsx`: Investor settings and withdrawal methods.

### 4.2 Backend Logic (Node.js / Express)
The backend serves as the orchestration layer between the mobile app, PostgreSQL database, and Polygon blockchain.

- **Auth Controller:** Handles OTP generation/verification (rate-limited via rolling window, Twilio/Mock) and issues JWTs.
- **KYC Controller:** Integrates with third-party APIs (SurePass/Sandbox) for Aadhaar XML validation and PAN fetching.
- **SHG Controller:** Manages group creation, adding members, role assignments (MEMBER vs. LEADER).
- **Loan Controller:** Processes loan applications, calculates EMIs, stores the ML risk band, and triggers blockchain events.
- **Lender Controller:** Fetches portfolio metrics, handles investment commitments.
- **Transactional Outbox Service:** Guarantees atomicity between Postgres database writes and BullMQ blockchain tasks.
- **Blockchain Event Listener:** Actively listens to Polygon smart contract events (LoanDisbursed, LoanRepaid), synchronizes off-chain states, and dispatches push notifications (FCM). Backfills missing blocks on startup.

### 4.3 Database Schema (Prisma / PostgreSQL)
- `User`: Stores phone, KYC status, wallet address, hashed credentials, FCM tokens.
- `SHGGroup`: SHG metadata, district/state, linked `poolContractAddress`.
- `SHGMember`: Junction table mapping Users to Groups with roles (MEMBER/LEADER).
- `Loan`: Core entity tracking `amount`, `interestRateBps`, `tenureMonths`, `emisPaid`, `mlScore`, `status`, `isSyncedOnChain` and `contractLoanId` for on-chain mapping.
- `Repayment`: Tracks individual EMI payments and their respective transaction hashes.
- `LedgerEntry`: Immutable off-chain financial accounting (LENDER_DEPOSIT, LOAN_DISBURSAL, EMI_RECEIVED).
- `OutboxJob` & `BlockchainSyncState`: Manages transactional outbox queueing and recovers missed smart contract events on server restarts.
- `OtpRecord` / `Meeting` / `FailedBlockchainJob`: Auxiliary tables for operations and reliability.

### 4.4 Smart Contracts (Solidity on Polygon Testnet)
The blockchain acts as the ultimate, immutable source of truth for financial transactions.
- `SHGPoolFactory.sol`: Factory pattern contract to deploy independent pools for newly onboarded SHGs.
- `SHGPool.sol`: Manages pooled lender capital mapped to a specific SHG. Records deposits and total liquidity.
- `LoanManager.sol`: Core logic for loan state machines. It records loan origination, disbursals, and EMI payments on-chain.
- `CreditScoreRegistry.sol`: Periodically logs on-chain hashes or tiers of the off-chain ML credit scores for immutable reputation tracking.

---

## 5. Success Metrics (KPIs)

| Metric | 6-Month Target |
|--------|---------------|
| SHGs onboarded | 50 groups |
| Total transactions recorded on-chain | 5,000+ |
| Average interest rate reduction | 40% vs. moneylenders |
| Repayment rate | > 92% |
| ML model accuracy (default prediction) | > 85% F1 |
| App crash rate | < 0.1% |

---

## 6. Regulatory Considerations

- Platform operates as a **technology layer** connecting SHGs — not classified as NBFC.
- KYC: Aadhaar + PAN via DigiLocker (PMLA compliant).
- Blockchain usage is restricted to an immutable ledger; no real fiat/crypto swapping happens on the platform yet.
- Partner with a licensed NBFC or registered MFI for formal loan origination in Phase 2.
- Data stored in India (compliance with DPDP Act 2023).

---

## 7. Assumptions & Constraints

- **Assumption:** SHG leaders have Android smartphones (Android 8+).
- **Constraint:** Smart contracts deployed on Polygon Testnet (not Ethereum mainnet) for gas cost reasons.
- **Constraint:** ML model must run on-device (TFLite) to protect user financial privacy.
- **Constraint:** This is a final-year academic project; scope is MVP + demo deployment on testnet.
