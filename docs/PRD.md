# GramChain — Product Requirements Document (PRD)
**Version:** 1.0.0 | **Status:** Draft | **Author:** Final Year Project  
**Date:** April 2026

---

## Abstract

India's rural Self-Help Groups (SHGs) represent one of the largest grassroots financial networks in the world — yet they remain trapped in a cycle of informal, high-interest borrowing. As of March 2024, India's gross microfinance loan portfolio stood at ₹4.33 lakh crore serving over 7.8 crore borrowers, yet rural SHG members continue to approach unorganized moneylenders charging 3–10% interest *per month*. The gap exists not because SHGs lack creditworthiness, but because the infrastructure connecting them to fair capital is broken, opaque, and heavily intermediated.

**GramChain** is a decentralized micro-lending mobile platform built exclusively for SHGs. It replaces trust-in-intermediaries with trust-in-code — deploying Solidity smart contracts on Polygon (a low-fee EVM chain) to automate loan origination, disbursement, repayment tracking, and penalty enforcement using USDC stablecoins, eliminating fiat volatility. An on-device ML model scores creditworthiness using alternative data (repayment history, SHG meeting attendance, group savings behaviour) rather than requiring a CIBIL score that most rural borrowers don't have. A React Native cross-platform mobile app delivers the experience in Hindi and English with offline-first architecture, because rural broadband is patchy.

GramChain is not a crypto app. It is a **financial inclusion tool** that happens to use blockchain infrastructure where it adds the most value: immutable audit trails, programmable repayment, and elimination of middlemen.

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

## 4. Competitive Landscape & Differentiation

| Platform | Target | Blockchain | ML Scoring | SHG-Native | Offline |
|----------|--------|-----------|-----------|-----------|---------|
| Rang De | P2P Social | ❌ | ❌ | ❌ | ❌ |
| IndiaP2P | NBFC P2P | ❌ | Partial | ❌ | ❌ |
| SmartCoin | Urban blue-collar | ❌ | ✅ | ❌ | ❌ |
| Aave/Compound | Crypto holders | ✅ | ❌ | ❌ | ❌ |
| **GramChain** | **SHGs** | **✅ Polygon** | **✅ On-device** | **✅** | **✅** |

**What makes GramChain unique:**
1. **SHG-group-native smart contracts** — lending pools are scoped per SHG, enforcing collective accountability on-chain
2. **No-CIBIL ML scoring** — trained on SHG repayment patterns, savings frequency, meeting attendance using federated learning
3. **USDC stablecoins + INR gateway** — borrowers never see crypto; UPI off-ramp converts seamlessly
4. **Offline-first React Native** — core features function without internet; sync when connected
5. **Multilingual** — Hindi, English; built for Devanagari input
6. **Group Guarantee Module** — smart contract enforces Grameen-style peer accountability programmatically

---

## 5. Core Features

### 5.1 MVP (Phase 1)
- [x] SHG onboarding & KYC (Aadhaar & PAN based via Sandbox API limits/Digilocker)
- [x] Advanced Authentication (Google OAuth, Phone/Password login, Magic OTP for Dev)
- [x] Group wallet creation (multi-sig smart contract per SHG)
- [x] Loan application flow with ML credit score
- [x] Smart contract loan disbursement (USDC → UPI via Transak/Mudrex)
- [x] Automated EMI repayment tracking on-chain
- [x] Member repayment dashboard
- [x] Government Schemes Discovery Dashboard
- [x] Hindi + English UI

### 5.2 Phase 2
- [ ] Lender/Investor portal (web dashboard)
- [ ] Impact metrics & ESG reporting
- [ ] Group savings pool (earn yield on idle funds via Aave integration)
- [ ] SMS/USSD fallback for feature phones
- [ ] WhatsApp bot integration for loan status

### 5.3 Phase 3
- [ ] Cross-SHG lending federation
- [ ] Tokenized SHG reputation NFT (non-transferable soulbound)
- [ ] NABARD/NRLM official API integration
- [ ] Geospatial risk mapping (crop-loan risk by region)

---

## 6. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| App startup time | < 2 seconds |
| Loan application flow | < 3 minutes end-to-end |
| Smart contract execution | < 30 seconds (Polygon finality) |
| Offline capability | Core read/write features functional |
| Security | E2E encryption, biometric auth, smart contract audit |
| Availability | 99.5% uptime (backend) |
| Localization | Hindi, English (Marathi, Tamil in Phase 2) |
| Accessibility | WCAG 2.1 AA compliant |

---

## 7. Success Metrics (KPIs)

| Metric | 6-Month Target |
|--------|---------------|
| SHGs onboarded | 50 groups |
| Total loans disbursed | ₹25 lakh |
| Average interest rate reduction | 40% vs. moneylenders |
| Repayment rate | > 92% |
| ML model accuracy (default prediction) | > 85% F1 |
| App crash rate | < 0.1% |

---

## 8. Regulatory Considerations

- Platform operates as a **technology layer** connecting SHGs — not classified as NBFC
- KYC: Aadhaar + PAN via DigiLocker (PMLA compliant)
- Stablecoin transactions flagged per FEMA/RBI guidelines
- Partner with a licensed NBFC or registered MFI for formal loan origination in Phase 2
- Data stored in India (compliance with DPDP Act 2023)

---

## 9. Assumptions & Constraints

- **Assumption:** SHG leaders have Android smartphones (Android 8+)
- **Assumption:** USDC ↔ INR gateway available via licensed crypto-fiat providers
- **Constraint:** Smart contracts deployed on Polygon (not Ethereum mainnet) for gas cost reasons
- **Constraint:** ML model must run on-device (TFLite) to protect user financial privacy
- **Constraint:** This is a final-year academic project; scope is MVP + demo deployment on testnet

---
