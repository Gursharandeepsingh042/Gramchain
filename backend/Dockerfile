# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

# Prisma needs OpenSSL to detect libssl version and pick the correct query engine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --ignore-scripts

COPY . .
RUN npx prisma generate
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────
FROM node:20-alpine

# Prisma runtime needs OpenSSL 3 + glibc shim on Alpine
RUN apk add --no-cache openssl libc6-compat

# SEC: run as non-root user
RUN addgroup -S gramchain && adduser -S gramchain -G gramchain
WORKDIR /app

# Copy only what is needed at runtime
COPY --from=builder --chown=gramchain:gramchain /app/dist       ./dist
COPY --from=builder --chown=gramchain:gramchain /app/node_modules ./node_modules
COPY --from=builder --chown=gramchain:gramchain /app/package.json ./package.json
COPY --from=builder --chown=gramchain:gramchain /app/prisma      ./prisma

USER gramchain

EXPOSE 3000

# Docker health check — lets docker-compose know when the service is ready.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/health | grep -q '"status":"ok"' || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
