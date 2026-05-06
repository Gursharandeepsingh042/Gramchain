# GramChain — Deploy Checklist (Do This Today)

## Step 1: Train & Test ML Model Locally (5 min)

```bash
cd ml
pip install -r requirements.txt
python -m model.train
```
You should see: `✅ Model trained!` and a `model/credit_model.joblib` file created.

---

## Step 2: Deploy Smart Contracts to Polygon Amoy (15 min)

### 2a. Get free test MATIC
→ Go to https://faucet.polygon.technology/
→ Connect MetaMask → Select "Polygon Amoy" → Request tokens

### 2b. Set up blockchain env
```bash
cd blockchain
cp .env.deploy .env
# Now edit .env and fill in:
#   DEPLOYER_PRIVATE_KEY = your MetaMask private key (MetaMask → Account → Export Private Key)
#   BACKEND_WALLET_ADDRESS = same address (for demo; use separate wallet in prod)
#   POLYGONSCAN_API_KEY = get free at https://polygonscan.com/register
```

### 2c. Deploy
```bash
npm install
npx hardhat run scripts/deploy.ts --network amoy
```
This will:
- Deploy 3 contracts to Amoy testnet
- Auto-save addresses to `blockchain/deployments/amoy-addresses.json`
- Auto-update `backend/src/constants/contracts.json`
- Auto-update `mobile/constants/contracts.json`

---

## Step 3: Set Up Supabase (Free, 5 min)

1. Go to https://supabase.com → New Project
2. Note your **Database URL** (Project Settings → Database → Connection String → URI mode)
3. Run migrations:
```bash
cd backend
# Put your DATABASE_URL in backend/.env first
npx prisma migrate deploy
```

---

## Step 4: Set Up Upstash Redis (Free, 2 min)

1. Go to https://upstash.com → Create Database → Select "Redis"
2. Copy the `REDIS_URL` (looks like: `redis://:password@...upstash.io:6379`)

---

## Step 5: Deploy Backend to Railway (Free tier, 10 min)

> `backend/railway.toml` is already configured — Railway will auto-run migrations and start correctly.

1. Go to https://railway.app → New Project → Deploy from GitHub repo
2. Set **Root Directory** to `backend`
3. Add environment variables (copy from `.env.prod.example` and fill in):

**Minimum required for demo deployment:**
```
NODE_ENV=production
DATABASE_URL=<from Supabase>
REDIS_URL=<from Upstash>
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_REFRESH_SECRET=<run same command again>
ENCRYPTION_KEY=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
DEMO_MODE=true
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
BACKEND_PRIVATE_KEY=<your deployer private key from Step 2>
BACKEND_WALLET_ADDRESS=<your wallet address>
LOAN_MANAGER_ADDRESS=<from Step 2 output>
SHG_POOL_FACTORY_ADDRESS=<from Step 2 output>
CREDIT_SCORE_REGISTRY_ADDRESS=<from Step 2 output>
ML_SERVICE_URL=http://localhost:8000
ML_INTERNAL_SECRET=dev-secret-key-change-in-prod
FIREBASE_SERVICE_ACCOUNT_JSON={}
SANDBOX_API_KEY=demo
SANDBOX_API_SECRET=demo
LOG_LEVEL=info
```

4. Railway will auto-detect Node.js and deploy. Get your public URL.

---

## Step 6: Update Mobile App API URL (2 min)

In `mobile/.env` (create from `mobile/.env.example`):
```
EXPO_PUBLIC_API_URL=https://<your-railway-url>/api/v1
```

---

## Step 7: Run ML Service on Railway (same project, new service)

> `ml/railway.toml` is already configured — it will train the model at build time automatically.

1. In Railway → Add Service → GitHub → select `ml` folder as root → set **Root Directory** to `ml`
2. Add env vars:
```
ML_INTERNAL_SECRET=dev-secret-key-change-in-prod
ALLOWED_ORIGINS=https://<your-railway-backend-url>
```
3. Update backend's `ML_SERVICE_URL` to point to this new Railway service URL.

---

## Step 8: Test Your Deployment

```bash
# Health check
curl https://<your-railway-url>/health

# Demo login (DEMO_MODE=true, OTP is always 123456)
curl -X POST https://<your-railway-url>/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'
```

---

## After Deployment — What to Do Next

| Feature | How to enable |
|---|---|
| Real OTP (Twilio) | Add `TWILIO_SID`, `TWILIO_TOKEN`, set `DEMO_MODE=false` |
| Real KYC (Aadhaar) | Add `SANDBOX_API_KEY` from Setu.co |
| Push Notifications | Add `FIREBASE_SERVICE_ACCOUNT_JSON` |
| Real Payments (Razorpay) | Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| Production contracts | Re-deploy Step 2 with `--network polygon` (real MATIC needed) |

---

## Mobile APK Build (for demo install)

```bash
cd mobile
npm install -g eas-cli
eas login
eas build --profile preview --platform android
```
This gives you an installable `.apk` to share with anyone.
