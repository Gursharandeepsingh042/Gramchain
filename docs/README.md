# 🌿 GramChain
### DeFi Micro-Lending Platform for Rural Self-Help Groups (SHGs)

> **Final Year Project** | Cross-Platform Mobile App | Blockchain + ML + React Native

---

## What is GramChain?

GramChain is a decentralized micro-lending platform built exclusively for India's rural Self-Help Groups (SHGs). It uses Polygon smart contracts for automated loan lifecycle management, USDC stablecoins to eliminate volatility, and an on-device ML model for credit scoring without requiring a CIBIL score.

**Problem:** Rural SHG members pay 36–120% APR to informal moneylenders because fair credit infrastructure doesn't reach them.

**Solution:** Smart contracts + stablecoins + offline-first mobile app = transparent, instant, fair micro-loans.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo + TypeScript |
| State | Zustand + React Query |
| Blockchain | Solidity + Hardhat + Polygon |
| Auth & KYC | Google OAuth + Fast2SMS + DigiLocker/Sandbox |
| Stablecoin | USDC (Circle) |
| Backend | Node.js + Express + Prisma + PostgreSQL |
| Queue | Redis + BullMQ |
| ML | Python + XGBoost + TFLite |
| ML API | FastAPI |
| Infra | AWS ECS Fargate + RDS + ElastiCache |
| CI/CD | GitHub Actions + EAS Build |

---

## Repository Structure

```
gramchain/
├── docs/                    # All documentation
│   ├── PRD.md               # Product Requirements Document
│   ├── SYSTEM_DESIGN.md     # Architecture & system design
│   ├── IMPLEMENTATION_PLAN.md # 20-week build plan + folder structure
│   ├── SKILL_FRONTEND.md    # React Native engineering guide
│   ├── SKILL_BACKEND.md     # Node.js engineering guide
│   ├── google_auth_setup.md # Google OAuth config guide
│   ├── SKILL_DESIGN.md      # UI/UX design system
│   └── SKILL_DEPLOYMENT.md  # DevOps & deployment guide
├── mobile/                  # React Native app (Expo)
├── backend/                 # Node.js REST API
├── ml/                      # Python ML service (FastAPI)
├── blockchain/              # Solidity smart contracts
├── deployment/              # Docker + Terraform
├── requirements.txt         # Python dependencies (ML service)
└── README.md
```

---

## Quick Start (Local Dev)

```bash
# 1. Clone
git clone https://github.com/your-username/gramchain.git
cd gramchain

# 2. Start infrastructure
cd deployment && docker-compose up -d

# 3. Backend
cd ../backend
cp .env.example .env      # Fill in your keys
npm install
npx prisma migrate dev
npm run dev               # http://localhost:3000

# 4. ML Service
cd ../ml
pip install -r ../requirements.txt
uvicorn api.main:app --reload  # http://localhost:8000

# 5. Smart Contracts
cd ../blockchain
npm install
npx hardhat test
npx hardhat node          # Local blockchain on port 8545

# 6. Mobile App
cd ../mobile
npm install
npx expo start            # Scan QR with Expo Go
```

---

## Key Differentiators vs. Existing Platforms

| Feature | Rang De | IndiaP2P | GramChain |
|---------|---------|----------|-----------|
| SHG-native group wallets | ❌ | ❌ | ✅ |
| No CIBIL ML scoring | ❌ | Partial | ✅ On-device |
| Smart contract automation | ❌ | ❌ | ✅ Polygon |
| Stablecoin (no volatility) | ❌ | ❌ | ✅ USDC |
| Offline-first mobile | ❌ | ❌ | ✅ SQLite sync |
| Hindi UI | Partial | ❌ | ✅ Native |

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [PRD.md](docs/PRD.md) | Product vision, personas, features, KPIs |
| [SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) | Full architecture, contracts, DB schema, security |
| [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | 20-week phase plan + complete folder structure |
| [SKILL_FRONTEND.md](docs/SKILL_FRONTEND.md) | React Native patterns, wallet, TFLite, i18n |
| [SKILL_BACKEND.md](docs/SKILL_BACKEND.md) | Node.js API, Prisma schema, blockchain workers |
| [SKILL_DESIGN.md](docs/SKILL_DESIGN.md) | Design system, colors, Hindi typography, Figma |
| [SKILL_DEPLOYMENT.md](docs/SKILL_DEPLOYMENT.md) | Docker, CI/CD, Terraform, contract deployment |

---

## Smart Contracts (Polygon Amoy Testnet)

| Contract | Address |
|----------|---------|
| LoanManager | `TBD after deployment` |
| CreditScoreRegistry | `TBD after deployment` |

---

## License

MIT License — Final Year Academic Project
