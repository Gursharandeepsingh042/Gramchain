# GramChain — Deployment Skill Guide
**Stack:** Docker + AWS ECS Fargate + GitHub Actions + EAS Build

---

## 1. Local Development (Docker Compose)

```yaml
# deployment/docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: gramchain
      POSTGRES_PASSWORD: gramchain_dev
      POSTGRES_DB: gramchain
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  backend:
    build:
      context: ../backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://gramchain:gramchain_dev@postgres:5432/gramchain
      REDIS_URL: redis://redis:6379
      NODE_ENV: development
    env_file:
      - ../backend/.env
    depends_on:
      - postgres
      - redis
    volumes:
      - ../backend/src:/app/src  # hot reload
    command: npx ts-node-dev src/index.ts

  ml-service:
    build:
      context: ../ml
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      ENVIRONMENT: development
    volumes:
      - ../ml:/app

  hardhat-node:
    build:
      context: ../blockchain
      dockerfile: Dockerfile.dev
    ports:
      - "8545:8545"
    command: npx hardhat node

volumes:
  pg_data:
  redis_data:
```

```bash
# Start full local environment
cd deployment
docker-compose up -d

# View logs
docker-compose logs -f backend

# Run migrations
docker-compose exec backend npx prisma migrate dev

# Seed test data
docker-compose exec backend npx ts-node src/scripts/seed.ts
```

---

## 2. Dockerfiles

### Backend Dockerfile
```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
```

### ML Service Dockerfile
```dockerfile
# ml/Dockerfile
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

---

## 3. GitHub Actions CI/CD

### Backend CI + Deploy
```yaml
# .github/workflows/deploy-backend.yml
name: Backend CI/Deploy

on:
  push:
    branches: [main]
    paths: ['backend/**']

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: gramchain_test
        ports: ['5432:5432']
      redis:
        image: redis:7
        ports: ['6379:6379']
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd backend && npm ci
      - run: cd backend && npm run lint
      - run: cd backend && npm run typecheck
      - run: cd backend && npm test
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/gramchain_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2
      
      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: gramchain-backend
          IMAGE_TAG: ${{ github.sha }}
        run: |
          cd backend
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster gramchain-prod \
            --service gramchain-backend \
            --force-new-deployment \
            --region ap-south-1
      
      - name: Run DB migrations
        run: |
          aws ecs run-task \
            --cluster gramchain-prod \
            --task-definition gramchain-migration \
            --launch-type FARGATE
```

### Smart Contract CI
```yaml
# .github/workflows/contracts.yml
name: Smart Contract Tests

on:
  push:
    paths: ['blockchain/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd blockchain && npm ci
      - run: cd blockchain && npx hardhat compile
      - run: cd blockchain && npx hardhat test
      - run: cd blockchain && npx hardhat coverage
      - name: Slither static analysis
        uses: crytic/slither-action@v0.4.0
        with:
          target: blockchain/contracts/
```

### Mobile Build
```yaml
# .github/workflows/deploy-mobile.yml
name: Mobile Build

on:
  push:
    branches: [main]
    paths: ['mobile/**']

jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: cd mobile && npm ci
      - run: cd mobile && eas build --platform android --profile preview --non-interactive
```

---

## 4. AWS Infrastructure (Terraform)

```hcl
# deployment/terraform/main.tf

# ECS Cluster
resource "aws_ecs_cluster" "gramchain" {
  name = "gramchain-prod"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# Backend Task Definition
resource "aws_ecs_task_definition" "backend" {
  family                   = "gramchain-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "backend"
    image = "${aws_ecr_repository.backend.repository_url}:latest"
    portMappings = [{ containerPort = 3000, protocol = "tcp" }]
    
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3000" }
    ]
    
    secrets = [
      { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.db_url.arn },
      { name = "JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt.arn },
    ]
    
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/gramchain-backend"
        "awslogs-region"        = "ap-south-1"
        "awslogs-stream-prefix" = "ecs"
      }
    }
    
    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://localhost:3000/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])
}

# Auto Scaling
resource "aws_appautoscaling_target" "backend" {
  max_capacity       = 10
  min_capacity       = 1
  resource_id        = "service/gramchain-prod/gramchain-backend"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "backend_cpu" {
  name               = "gramchain-backend-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 70.0
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

# RDS PostgreSQL
resource "aws_db_instance" "gramchain" {
  identifier             = "gramchain-postgres"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t4g.micro"  # Free tier eligible
  allocated_storage      = 20
  storage_encrypted      = true
  username               = "gramchain"
  password               = random_password.db.result
  multi_az               = false  # Set true for production
  backup_retention_period = 7
  deletion_protection    = true
  skip_final_snapshot    = false
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "gramchain" {
  cluster_id           = "gramchain-redis"
  engine               = "redis"
  node_type            = "cache.t4g.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.0"
  port                 = 6379
}
```

---

## 5. Environment Configuration

```bash
# Production environment variables (stored in AWS Secrets Manager)
# Never commit these to git

# Database
DATABASE_URL="postgresql://gramchain:PROD_PASS@gramchain-postgres.region.rds.amazonaws.com:5432/gramchain"

# Blockchain (Polygon Mainnet)
POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/PROD_KEY"
BACKEND_PRIVATE_KEY="0x..."  # Managed via AWS KMS in production

# Contract Addresses (Polygon Mainnet)
LOAN_MANAGER_ADDRESS="0x..."
SHG_POOL_FACTORY_ADDRESS="0x..."
USDC_ADDRESS="0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"  # USDC on Polygon
```

---

## 6. Smart Contract Deployment

```ts
// blockchain/scripts/deploy.ts
import { ethers } from 'hardhat'

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('Deploying with:', deployer.address)
  
  // 1. Deploy CreditScoreRegistry
  const Registry = await ethers.getContractFactory('CreditScoreRegistry')
  const registry = await Registry.deploy(deployer.address)
  await registry.waitForDeployment()
  console.log('CreditScoreRegistry:', await registry.getAddress())
  
  // 2. Deploy LoanManager
  const USDC = process.env.USDC_ADDRESS!
  const LoanManager = await ethers.getContractFactory('LoanManager')
  const loanManager = await LoanManager.deploy(USDC, await registry.getAddress())
  await loanManager.waitForDeployment()
  console.log('LoanManager:', await loanManager.getAddress())
  
  // 3. Export addresses to JSON for backend/mobile consumption
  const addresses = {
    loanManager: await loanManager.getAddress(),
    registry: await registry.getAddress(),
    network: (await ethers.provider.getNetwork()).name,
    deployedAt: new Date().toISOString(),
  }
  
  require('fs').writeFileSync(
    '../backend/src/constants/contracts.json',
    JSON.stringify(addresses, null, 2)
  )
}

main().catch(console.error)
```

```bash
# Deploy to testnet
cd blockchain
npx hardhat run scripts/deploy.ts --network polygon_amoy

# Verify on PolygonScan
npx hardhat verify --network polygon_amoy DEPLOYED_ADDRESS "constructor_arg1" "constructor_arg2"

# Deploy to mainnet (when ready)
npx hardhat run scripts/deploy.ts --network polygon_mainnet
```

---

## 7. Monitoring Setup

```bash
# CloudWatch alarm for API error rate > 5%
aws cloudwatch put-metric-alarm \
  --alarm-name "gramchain-api-errors" \
  --metric-name "5XXError" \
  --namespace "AWS/ApplicationELB" \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --period 300 \
  --statistic Average \
  --alarm-actions arn:aws:sns:ap-south-1:ACCOUNT:gramchain-alerts
```

---

## 8. Deployment Checklist (Pre-Launch)

### Smart Contracts
- [ ] All tests passing (100% coverage on critical paths)
- [ ] Slither static analysis: no HIGH/MEDIUM issues
- [ ] Contracts deployed to testnet and tested for 1 week
- [ ] Contract addresses exported to backend + mobile constants
- [ ] PolygonScan verification complete

### Backend
- [ ] All environment variables set in AWS Secrets Manager
- [ ] DB migrations run successfully on RDS
- [ ] Health check endpoint returning 200
- [ ] Rate limiting tested
- [ ] Blockchain event listener running
- [ ] Push notification test sent successfully

### Mobile
- [ ] APK built with `eas build --profile preview`
- [ ] Tested on Android 8, 10, 13, 14
- [ ] Hindi font rendering verified
- [ ] Offline mode tested (airplane mode scenarios)
- [ ] Blockchain transactions tested end-to-end on testnet

### Security
- [ ] No secrets in Git history (`git log` + `truffleHog` scan)
- [ ] SSL certificate active (ACM)
- [ ] CORS whitelist configured
- [ ] `helmet` headers enabled
