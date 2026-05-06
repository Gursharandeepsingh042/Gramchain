# GramChain Environment Variables

All environment variables used by the GramChain platform, organized by module.

---

## Backend (`backend/.env`)

### Required in ALL environments

| Variable | Example | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/gramchain` | Prisma PostgreSQL connection string (Supabase) |
| `JWT_SECRET` | `min-32-char-random-string` | Access token signing key (min 32 chars) |
| `JWT_REFRESH_SECRET` | `min-32-char-random-string` | Refresh token signing key (min 32 chars) |

### Redis & Queue

| Variable | Example | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection for caching, rate limiting, BullMQ |

### Authentication

| Variable | Example | Description |
|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | `123456.apps.googleusercontent.com` | Google OAuth Client ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `{"type":"service_account",...}` | Firebase Admin SDK credentials (JSON string) |

### KYC (Sandbox API)

| Variable | Example | Description |
|----------|---------|-------------|
| `SANDBOX_API_KEY` | `key_live_xxx` | Sandbox.co.in API key for Aadhaar/PAN |
| `SANDBOX_API_SECRET` | `secret_live_xxx` | Sandbox.co.in API secret |

### Blockchain

| Variable | Example | Description |
|----------|---------|-------------|
| `BACKEND_PRIVATE_KEY` | `0xabc123...` | Ethereum private key for backend signer wallet |
| `POLYGON_RPC_URL` | `https://rpc-amoy.polygon.technology` | Polygon RPC endpoint |
| `LOAN_MANAGER_ADDRESS` | `0x...` | LoanManager contract address (auto-populated by deploy) |
| `SHG_POOL_FACTORY_ADDRESS` | `0x...` | SHGPoolFactory contract address |
| `CREDIT_SCORE_REGISTRY_ADDRESS` | `0x...` | CreditScoreRegistry contract address |

### ML Service

| Variable | Example | Description |
|----------|---------|-------------|
| `ML_SERVICE_URL` | `http://localhost:8000` | FastAPI ML scoring service URL |
| `ML_INTERNAL_SECRET` | `dev-secret-key-change-in-prod` | Shared secret for internal ML API auth |

### Feature Flags

| Variable | Example | Description |
|----------|---------|-------------|
| `DEMO_MODE` | `true` | Enables demo OTP, bypasses KYC, mock blockchain |
| `DEMO_OTP` | `123456` | Fixed OTP for demo mode testing |
| `NODE_ENV` | `production` | Node environment (`development`, `test`, `production`) |
| `PORT` | `3000` | HTTP server port |

---

## Blockchain (`blockchain/.env`)

| Variable | Example | Description |
|----------|---------|-------------|
| `DEPLOYER_PRIVATE_KEY` | `0xabc123...` | Private key for contract deployment |
| `BACKEND_WALLET_ADDRESS` | `0xdef456...` | Backend signer address (granted BACKEND_ROLE) |
| `POLYGON_AMOY_RPC_URL` | `https://rpc-amoy.polygon.technology` | Amoy testnet RPC |
| `POLYGON_MAINNET_RPC_URL` | `https://polygon-rpc.com` | Mainnet RPC |
| `POLYGONSCAN_API_KEY` | `ABC123...` | Polygonscan API key for contract verification |
| `APPROVAL_QUORUM` | `3` | Number of leader approvals needed for loans |
| `FORCE_REDEPLOY` | `true` | Override existing deployment (default: false) |

---

## Mobile (`mobile/.env`)

| Variable | Example | Description |
|----------|---------|-------------|
| `EXPO_PUBLIC_API_URL` | `http://192.168.1.100:3000` | Backend API base URL |
| `EXPO_PUBLIC_FIREBASE_CONFIG` | `{"apiKey":"..."}` | Firebase config (JSON) |

---

## CI/CD (GitHub Actions Secrets)

| Secret | Description |
|--------|-------------|
| `PROD_SERVER_SSH_KEY` | SSH private key for deployment |
| `PROD_SERVER_IP` | Production server IP |
| `PROD_SERVER_USER` | SSH username for deployment |

---

## Security Notes

1. **Never commit `.env` files** — they are in `.gitignore`
2. `JWT_SECRET` and `JWT_REFRESH_SECRET` must be **at least 32 characters**
3. `BACKEND_PRIVATE_KEY` controls all on-chain operations — protect with KMS in production (SEC1)
4. `FIREBASE_SERVICE_ACCOUNT_JSON` contains the full service account — use Secret Manager
5. `DEMO_MODE=true` **must never be set in production** — it bypasses all auth

---

*Last updated: May 2026*
