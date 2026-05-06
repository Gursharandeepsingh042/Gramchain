# GramChain — System Architecture

> Hybrid On-Chain DeFi Microfinance Platform

## High-Level Architecture

```mermaid
flowchart TB
    subgraph Mobile["📱 Mobile App (React Native / Expo)"]
        UI["UI Screens<br/>(Auth, Borrow, Group, Profile)"]
        Store["Zustand State<br/>+ React Query Cache"]
        Wallet["Ethers.js<br/>Wallet Viewer"]
        SQLite["SQLite<br/>Offline Queue"]
    end

    subgraph Backend["⚙️ Backend API (Node.js / Express)"]
        direction TB
        API["REST API<br/>/api/v1/*"]
        Auth["Auth Service<br/>(JWT + OTP + Google)"]
        Loan["Loan Service<br/>(Apply → Approve → Disburse)"]
        KYC["KYC Service<br/>(Aadhaar + PAN via Sandbox)"]
        Ledger["Ledger Service<br/>(Double-Entry INR Accounting)"]
        Outbox["Outbox Service<br/>(Transactional Outbox Pattern)"]
        Notif["Notification Service<br/>(FCM Push)"]
    end

    subgraph Workers["🔄 Background Workers (BullMQ)"]
        BW["Blockchain Writer<br/>(create-loan, record-emi)"]
        BL["Blockchain Listener<br/>(Event Sync)"]
        DC["Default Checker<br/>(Daily Cron)"]
        OS["Outbox Sweep<br/>(10s interval)"]
    end

    subgraph Data["🗄️ Data Layer"]
        PG["PostgreSQL 16<br/>(Supabase)"]
        Redis["Redis<br/>(Upstash)"]
    end

    subgraph Chain["⛓️ Polygon Blockchain"]
        LM["LoanManager.sol<br/>(Loan Lifecycle)"]
        SP["SHGPool.sol<br/>(Multi-sig Wallet)"]
        SPF["SHGPoolFactory.sol<br/>(Pool Deployer)"]
        CSR["CreditScoreRegistry.sol<br/>(On-Chain Credit History)"]
    end

    subgraph ML["🤖 ML Service (Planned)"]
        FastAPI["FastAPI<br/>(Credit Scoring)"]
        Model["XGBoost / TFLite<br/>Model"]
    end

    subgraph External["🌐 External APIs"]
        Sandbox["Sandbox API<br/>(KYC Verification)"]
        Twilio["Twilio / Firebase<br/>(OTP Delivery)"]
        RZP["Razorpay<br/>(Payments - Planned)"]
    end

    %% Mobile → Backend
    UI --> Store
    Store --> API
    Wallet --> Chain

    %% Backend internal
    API --> Auth
    API --> Loan
    API --> KYC
    Loan --> Ledger
    Loan --> Outbox
    Loan --> Notif
    Auth --> Notif

    %% Backend → Data
    Auth --> PG
    Loan --> PG
    KYC --> PG
    Ledger --> PG
    Auth --> Redis
    Outbox --> PG

    %% Workers
    OS --> BW
    BW --> Chain
    BL --> Chain
    BL --> PG
    DC --> PG
    DC --> Chain
    OS --> Redis

    %% External
    KYC --> Sandbox
    Auth --> Twilio
    Notif --> Twilio
    Loan --> FastAPI
    FastAPI --> Model
```

## Data Flow: Loan Application

```mermaid
sequenceDiagram
    participant M as 📱 Mobile
    participant B as ⚙️ Backend
    participant DB as 🗄️ PostgreSQL
    participant Q as 🔄 BullMQ
    participant BC as ⛓️ Polygon

    M->>B: POST /loan/apply
    B->>B: Validate + ML Score
    B->>DB: $transaction: Create Loan + OutboxJob
    DB-->>B: Loan created (status: PENDING)
    B-->>M: 201 Created

    Note over Q: Every 10s: Outbox Sweep
    Q->>DB: Find PENDING OutboxJobs
    Q->>Q: Enqueue "create-loan" job
    Q->>DB: Mark OutboxJob → QUEUED

    Note over Q: Blockchain Writer
    Q->>BC: LoanManager.createLoan(...)
    BC-->>Q: tx confirmed
    Q->>DB: Update Loan (contractLoanId, txHash, isSyncedOnChain=true)
```

## Data Flow: EMI Repayment

```mermaid
sequenceDiagram
    participant M as 📱 Mobile
    participant B as ⚙️ Backend
    participant DB as 🗄️ PostgreSQL
    participant Q as 🔄 BullMQ
    participant BC as ⛓️ Polygon

    M->>B: POST /loan/:id/repay
    B->>DB: $transaction: Create Repayment + Ledger + OutboxJob
    B->>DB: Update Loan (emisPaid++, nextEmiDue)
    DB-->>B: Repayment recorded
    B-->>M: 201 Created

    Note over Q: Outbox Sweep → BullMQ
    Q->>BC: LoanManager.recordEmi(loanId, emiNumber, amountPaise)
    BC-->>Q: EmiPaid event emitted
    Q->>DB: Mark OutboxJob → QUEUED
```

## Security Architecture

```mermaid
flowchart LR
    subgraph Client["Client Layer"]
        App["Mobile App"]
    end

    subgraph Edge["Edge Security"]
        RL["Rate Limiter<br/>(100 req/min global)"]
        KRL["KYC Rate Limiter<br/>(3-5 req/min)"]
        LRL["Loan Rate Limiter<br/>(3 req/min)"]
        Helmet["Helmet<br/>(Security Headers)"]
        CORS["CORS<br/>(Allowlist)"]
        Sanitize["Body Sanitizer<br/>(XSS Prevention)"]
    end

    subgraph Auth["Authentication"]
        JWT["JWT Verify<br/>(15min access)"]
        Refresh["Refresh Token<br/>(7d, rotated)"]
        OTP["OTP Guard<br/>(5 req/10min)"]
    end

    subgraph DataSec["Data Security"]
        Hash["SHA-256 Hash<br/>(Aadhaar, PAN)"]
        AES["AES-256-GCM<br/>(KYC Details)"]
        Bcrypt["bcrypt<br/>(Passwords)"]
    end

    App --> RL --> Helmet --> CORS --> Sanitize --> JWT --> Hash
    RL --> KRL
    RL --> LRL
    JWT --> Refresh
    JWT --> OTP
    Hash --> AES
    Hash --> Bcrypt
```

## Infrastructure (Target Production)

```mermaid
flowchart TB
    subgraph CI["GitHub Actions CI/CD"]
        Lint["Lint + Build"]
        Test["Jest Tests"]
        Contract["Hardhat Tests"]
        Deploy["Deploy via SSH"]
    end

    subgraph Prod["Production Server"]
        Docker["Docker Compose"]
        Backend["Backend Container"]
        MLContainer["ML Service Container"]
    end

    subgraph Managed["Managed Services"]
        Supabase["Supabase<br/>(PostgreSQL)"]
        Upstash["Upstash<br/>(Redis)"]
        Firebase["Firebase<br/>(Push + Auth)"]
    end

    Lint --> Test --> Contract --> Deploy
    Deploy --> Docker
    Docker --> Backend
    Docker --> MLContainer
    Backend --> Supabase
    Backend --> Upstash
    Backend --> Firebase
```
