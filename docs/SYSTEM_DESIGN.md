# GramChain — System Design Document
**Version:** 1.0.0 | **Classification:** Technical Architecture

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   CLIENT LAYER                          │
│  React Native App (iOS + Android)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Auth     │ │ Loan     │ │ Wallet   │ │ Dashboard│  │
│  │ Module   │ │ Module   │ │ Module   │ │ Module   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Offline-First Local Store (SQLite/MMKV)  │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS / WebSocket
┌───────────────────────▼─────────────────────────────────┐
│                   API GATEWAY                            │
│   AWS API Gateway / NGINX + rate limiting + auth guard  │
└───────────────────────┬─────────────────────────────────┘
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  Auth       │ │  Core API   │ │  ML Service │
│  Service    │ │  (Node.js)  │ │  (FastAPI)  │
│  (Node.js)  │ │             │ │             │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │
┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│  PostgreSQL │ │  Redis      │ │  ML Model   │
│  (Users,    │ │  (Cache,    │ │  Store      │
│   SHGs)     │ │   Sessions) │ │  (S3/local) │
└─────────────┘ └─────────────┘ └─────────────┘
          │
┌─────────▼──────────────────────────────────────┐
│              BLOCKCHAIN LAYER                   │
│  ┌──────────────────────────────────────────┐  │
│  │  Polygon Amoy Testnet / Polygon Mainnet  │  │
│  │                                          │  │
│  │  ┌───────────────┐  ┌─────────────────┐ │  │
│  │  │ SHGPool.sol   │  │ LoanManager.sol │ │  │
│  │  │ (Multi-sig    │  │ (Loan lifecycle │ │  │
│  │  │  group wallet)│  │  + repayments)  │ │  │
│  │  └───────────────┘  └─────────────────┘ │  │
│  │  ┌───────────────┐  ┌─────────────────┐ │  │
│  │  │ CreditScore   │  │ USDC ERC-20     │ │  │
│  │  │ Registry.sol  │  │ (Circle)        │ │  │
│  │  └───────────────┘  └─────────────────┘ │  │
│  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
          │
┌─────────▼──────────────────────────────────────┐
│            EXTERNAL INTEGRATIONS                │
│  DigiLocker/Sandbox│ Transak (Fiat↔USDC)        │
│  Fast2SMS/MSG91    │ Google OAuth API           │
│  IPFS (Docs)       │ Firebase (Push notifs)     │
└────────────────────────────────────────────────┘
```

---

## 2. Component Deep Dives

### 2.1 Frontend — React Native App

**Tech Stack:**
- React Native 0.74+ with Expo (managed workflow)
- TypeScript (strict mode)
- Zustand (global state) + React Query (server state)
- ethers.js v6 (blockchain interaction)
- SQLite via expo-sqlite (offline persistence)
- MMKV (fast key-value: session tokens, settings)
- i18next (Hindi/English localization)
- React Navigation v6 (tab + stack navigator)
- NativeWind (TailwindCSS for RN)

**Key Architecture Decisions:**
- **Offline-First:** Every mutation is queued locally in SQLite. A background sync worker processes the queue when connectivity returns.
- **Embedded Wallet:** User private key generated on-device, encrypted with biometric-derived key, stored in Android Keystore / iOS Secure Enclave. No seed phrase exposed to users.
- **ML On-Device:** TensorFlow Lite model for credit score pre-screening runs locally — no PII leaves the device for scoring.

**Screen Map:**
```
Onboarding
  ├── Welcome / Language Select
  ├── Login (Phone & Password)
  ├── Signup (Details & Password)
  ├── Phone OTP Verification
  ├── Google Sign-In
  ├── KYC (PAN & Aadhaar Sandbox)
  └── SHG Registration / Join

Home (Tab Bar)
  ├── Dashboard (balance, active loans, repayment calendar)
  ├── Borrow (apply → ML score → smart contract)
  ├── Group (SHG members, savings, meetings)
  ├── Profile (settings, transaction history, documents)
  └── Govt Schemes (eligibility, benefits, links)
```

---

### 2.2 Backend — Node.js Core API

**Tech Stack:**
- Node.js 20 LTS + Express.js
- TypeScript
- Prisma ORM + PostgreSQL 16
- Redis 7 (caching, rate limiting, job queue via BullMQ)
- ethers.js (server-side contract interaction / event listening)
- Zod (runtime validation)
- JWT + refresh token rotation
- Helmet + express-rate-limit (security)

**Key Services:**

#### Auth Service
```
POST /auth/send-otp       → send OTP via MSG91/Fast2SMS (Magic OTP for Dev)
POST /auth/verify-otp     → verify OTP
POST /auth/google         → verify Google ID Token and login/register
POST /auth/login          → login via phone and password
POST /auth/register       → user registration after OTP
POST /auth/refresh        → rotate refresh token
POST /kyc/pan/verify      → verify PAN via Sandbox API
POST /kyc/aadhaar/send-otp→ send Aadhaar OTP
POST /kyc/aadhaar/verify  → verify Aadhaar OTP, mark KYC complete
```

#### SHG Service
```
POST /shg/create          → create SHG group, deploy multi-sig wallet
GET  /shg/:id             → group details, members, pool balance
POST /shg/:id/member      → add member to group
GET  /shg/:id/meetings    → meeting records
POST /shg/:id/meetings    → log meeting attendance
```

#### Loan Service
```
POST /loan/apply          → submit application → ML score → queue
GET  /loan/:id            → loan details
POST /loan/:id/approve    → group leader approves → trigger contract
GET  /loan/my             → user's loan history
POST /loan/:id/repay      → trigger repayment on-chain
```

#### Blockchain Event Listener (BullMQ Worker)
- Listens to `LoanDisbursed`, `RepaymentReceived`, `LoanDefaulted` contract events
- Updates PostgreSQL state to match on-chain truth
- Sends push notifications via Firebase

---

### 2.3 ML Service — FastAPI + Python

**Tech Stack:**
- Python 3.11
- FastAPI (REST API)
- scikit-learn + XGBoost (training pipeline)
- TensorFlow + TFLite (on-device model export)
- Pandas + NumPy (feature engineering)
- MLflow (experiment tracking)
- Docker

**Credit Scoring Model:**

*Features (no traditional CIBIL data):*
| Feature | Description |
|---------|-------------|
| `meeting_attendance_rate` | % of SHG meetings attended (last 12 months) |
| `savings_regularity` | Coefficient of variation of monthly savings |
| `group_repayment_history` | Group-level default rate |
| `loan_count` | Number of prior loans in group |
| `individual_prior_repayment` | On-time repayment % of past loans |
| `savings_to_loan_ratio` | Group savings / requested loan amount |
| `tenure_months` | Months as SHG member |
| `seasonal_factor` | Agricultural calendar (planting/harvest season) |

*Model Pipeline:*
```
Raw Features → Feature Engineering → XGBoost Classifier
    → Probability of Default → Credit Score (300–900 scale)
    → TFLite Export → Bundled in React Native App
```

*Training Data:* Synthetic dataset generated from NABARD SHG reports + augmented with realistic patterns. In production, retrained on anonymized on-chain repayment data.

**Default Prediction API:**
```
POST /ml/score
Body: { shg_id, member_id, loan_amount, features: {...} }
Response: { score: 720, risk_band: "LOW", approval_recommended: true }
```

---

### 2.4 Blockchain Layer — Smart Contracts

**Network:** Polygon (Amoy Testnet for dev, Polygon Mainnet for prod)  
**Language:** Solidity ^0.8.24  
**Framework:** Hardhat + OpenZeppelin

#### Contract 1: `SHGPool.sol`
- Multi-signature wallet scoped to each SHG group
- M-of-N approval required for fund disbursement (e.g., 3-of-5 group leaders)
- Holds USDC deposits from lenders/members
- Emits events: `FundDeposited`, `FundWithdrawn`, `QuorumReached`

```solidity
// Core interface sketch
contract SHGPool {
    address[] public members;
    uint256 public quorumThreshold;   // e.g., 3
    IERC20 public usdc;
    
    mapping(bytes32 => Proposal) public proposals;
    
    function proposeLoan(address borrower, uint256 amount) external returns (bytes32);
    function approveLoan(bytes32 proposalId) external;
    function executeLoan(bytes32 proposalId) external;
    function depositFunds(uint256 amount) external;
}
```

#### Contract 2: `LoanManager.sol`
- Tracks full loan lifecycle: PENDING → APPROVED → ACTIVE → REPAID / DEFAULTED
- Stores repayment schedule (EMI dates + amounts)
- Auto-marks loan as defaulted if EMI missed by > 30 days
- Chainlink Automation compatible for scheduled checks

```solidity
contract LoanManager {
    enum LoanStatus { PENDING, APPROVED, ACTIVE, REPAID, DEFAULTED }
    
    struct Loan {
        address borrower;
        uint256 principal;
        uint256 interestRate;   // basis points, e.g., 1800 = 18% APR
        uint256 emiAmount;
        uint256 disbursedAt;
        uint256 nextEmiDue;
        uint256 remainingPrincipal;
        LoanStatus status;
        bytes32 shgPoolId;
    }
    
    function createLoan(address borrower, uint256 principal, uint256 rate, uint256 tenure) external;
    function repayEMI(uint256 loanId) external;
    function checkDefault(uint256 loanId) external;
}
```

#### Contract 3: `CreditScoreRegistry.sol`
- On-chain credit score history (immutable, timestamped)
- Only the ML Oracle (trusted backend address) can write scores
- Public read — transparent credit history per member address

---

### 2.5 Data Architecture

**PostgreSQL Schema (Key Tables):**
```sql
users           (id, phone, googleId, email, password, aadhaar_hash, pan_hash, wallet_address, kyc_status, name)
shg_groups      (id, name, district, state, pool_contract_address, created_at)
shg_members     (user_id, shg_id, role, joined_at)
loan_applications (id, member_id, shg_id, amount, status, ml_score, contract_loan_id)
repayments      (id, loan_id, amount, paid_at, tx_hash, status)
meetings        (id, shg_id, held_at, attendees_json)
```

**On-Chain State (Source of Truth for funds):**
- USDC balances in SHGPool contracts
- Loan status in LoanManager
- Credit score history in CreditScoreRegistry

**IPFS:**
- KYC document hashes (Aadhaar, PAN) — only hash stored, not raw docs
- Loan agreement PDFs

---

## 3. Security Architecture

### 3.1 Key Management
- User wallets: private key encrypted with AES-256, key derived from biometric hash, stored in platform keystore
- Backend signer: AWS KMS-managed key for contract transactions
- Multi-sig threshold prevents single-point-of-failure fund theft

### 3.2 Smart Contract Security
- OpenZeppelin ReentrancyGuard on all fund-moving functions
- Pausable pattern for emergency stop
- Access control via OpenZeppelin AccessControl (ROLES: ADMIN, ML_ORACLE, GROUP_LEADER)
- Pre-deployment audit checklist (Slither static analysis + manual review)

### 3.3 API Security
- JWT (15 min access token + 7 day refresh)
- Rate limiting: 100 req/min per IP, 20 req/min per user
- All endpoints require phone-verified session
- Aadhaar data: never stored raw, only SHA-256 hash of masked number

### 3.4 Data Privacy
- DPDP Act 2023 compliant: data minimization, purpose limitation
- ML features computed locally; only score (not raw data) sent to server
- Soft-delete pattern: user can request data erasure

---

## 4. Infrastructure & DevOps

### 4.1 Cloud Architecture (AWS)
```
Route53 (DNS)
  └── CloudFront (CDN for static assets)
       └── API Gateway
            ├── ECS Fargate (Node.js API) — auto-scaled
            ├── ECS Fargate (FastAPI ML) — auto-scaled
            └── ElastiCache Redis

RDS PostgreSQL (Multi-AZ)
S3 (IPFS pinning cache, ML model artifacts)
AWS KMS (backend signing key)
CloudWatch (logs + alerts)
```

### 4.2 CI/CD Pipeline
```
GitHub Push → GitHub Actions
  ├── Lint + TypeCheck
  ├── Unit Tests (Jest / Pytest)
  ├── Smart Contract Tests (Hardhat)
  ├── Build Docker Images
  ├── Push to ECR
  └── Deploy to ECS (Blue-Green)

Mobile:
  GitHub Push → EAS Build (Expo)
    ├── Android APK (Play Store internal track)
    └── iOS IPA (TestFlight)
```

### 4.3 Monitoring
- Grafana + Prometheus (API metrics)
- Sentry (error tracking: mobile + backend)
- The Graph (blockchain event indexing)
- PagerDuty (on-call alerts for smart contract anomalies)

---

## 5. API Contract Summary

**Base URL:** `https://api.gramchain.in/v1`  
**Auth:** `Authorization: Bearer <jwt_token>`

All responses follow:
```json
{
  "success": true,
  "data": {},
  "error": null,
  "timestamp": "2026-04-08T10:00:00Z"
}
```

---

## 6. Scalability Considerations

| Bottleneck | Solution |
|------------|---------|
| Polygon gas spikes | Batch transactions using multicall pattern |
| High loan application volume | Redis BullMQ queue with worker scaling |
| ML inference latency | On-device TFLite; server model only for retraining |
| Offline data conflicts | Last-write-wins with server authority on financial data |
| Database read load | Read replicas + Redis caching for SHG dashboards |
