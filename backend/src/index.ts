import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'

import routes from './routes'
import { errorHandler } from './middleware/error.middleware'
import { sanitizeBody } from './middleware/sanitize.middleware'
import { prisma } from './lib/prisma'
import { startBlockchainWriterWorker } from './jobs/blockchain-writer.job'
import { startEventListener } from './jobs/blockchain-listener.job'
import { startRepaymentReminderJob } from './jobs/repayment-reminder.job'
import { startDefaultCheckerJob } from './jobs/default-checker.job'
import { startCleanupJob } from './jobs/cleanup.job'
import { startKycReminderJob } from './jobs/kyc-reminder.job'
import { startReconcileJob } from './jobs/reconcile.job'
import { isConnected } from './services/blockchain.service'
import { getRedis } from './lib/redis'
import { startOutboxSweep } from './services/outbox.service'
import { logger } from '@/lib/logger'
import { initSentry, sentryErrorHandler } from '@/lib/sentry'
import { warmSecrets } from '@/lib/secrets'

// ─── SEC9: Startup Env Var Validation ────────────────────────
// Fail-fast on missing required env vars rather than crashing at runtime.
{
  const required: Array<{ key: string; minLength?: number; prodOnly?: boolean }> = [
    { key: 'DATABASE_URL' },
    { key: 'JWT_SECRET', minLength: 32 },
    { key: 'JWT_REFRESH_SECRET', minLength: 32 },
  ]

  // Additional vars required only in production
  const prodRequired: Array<{ key: string; minLength?: number }> = [
    { key: 'BACKEND_PRIVATE_KEY', minLength: 10 },
    { key: 'ENCRYPTION_KEY', minLength: 16 },
  ]

  const isProd = process.env.NODE_ENV === 'production'

  if (isProd && process.env.DEMO_MODE === 'true') {
    logger.warn('⚠️  DEMO_MODE=true in production — magic OTP (123456) is active. Set DEMO_MODE=false before real launch.')
  }

  const varsToCheck = isProd ? [...required, ...prodRequired] : required
  const missing: string[] = []

  for (const { key, minLength } of varsToCheck) {
    const val = process.env[key]
    if (!val) {
      missing.push(`${key} is not set`)
    } else if (minLength && val.length < minLength) {
      missing.push(`${key} must be at least ${minLength} chars (got ${val.length})`)
    }
  }

  // Warn about insecure defaults in non-prod
  if (!isProd) {
    const mlSecret = process.env.ML_INTERNAL_SECRET
    if (!mlSecret || mlSecret === 'dev-secret-key-change-in-prod') {
      logger.warn('ML_INTERNAL_SECRET is using default dev value — change before deploying')
    }
  }

  if (missing.length > 0) {
    const msg = `FATAL: Missing or invalid environment variables: ${missing.join(', ')}`
    console.error(msg)
    logger.fatal({ missing }, msg)
    process.exit(1)
  }
}

const app = express()
const PORT = process.env.PORT ?? 3000

// Trust Railway/proxy X-Forwarded-For headers (required for express-rate-limit behind a proxy)
app.set('trust proxy', 1)

// ─── Allowed Origins ─────────────────────────────────────────
// In production, set ALLOWED_ORIGINS=https://yourdomain.com,gramchain://
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:8081']

// ─── Sentry — must be initialized BEFORE other middleware to capture errors ─
// No-op if SENTRY_DSN is not set.
void initSentry(app)

// ─── SEC11: Security & Performance Middleware ───────────────
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
}))
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? allowedOrigins : '*',
  credentials: true,
}))
app.use(compression())

// ─── Razorpay Webhook (RAW body required for signature verification) ─
// Must be registered BEFORE express.json() — otherwise the body is parsed
// and the HMAC won't match Razorpay's hash of the original bytes.
app.post(
  '/api/v1/payment/webhook',
  express.raw({ type: '*/*', limit: '1mb' }),
  // Lazy import to avoid coupling top-level imports
  (req, res, next) => {
    import('./controllers/payment.controller')
      .then((mod) => mod.webhook(req, res, next))
      .catch(next)
  },
)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(sanitizeBody) // SEC8: sanitize all string fields in req.body
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// ─── Rate Limiting ───────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
})
app.use('/api', limiter)

// ─── Health Check (before auth middleware) ───────────────────
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    const redis = await getRedis()
    res.json({
      status: 'ok',
      version: process.env.npm_package_version ?? '1.0.0',
      services: {
        database: 'connected',
        redis: redis ? 'connected' : 'unavailable',
        blockchain: isConnected() ? 'connected' : (process.env.DEMO_MODE === 'true' ? 'demo' : 'disconnected'),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    res.status(503).json({ status: 'error', error: (err as Error).message })
  }
})

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/v1', routes)

// ─── Sentry error handler (must be BEFORE the project's errorHandler) ─
app.use(sentryErrorHandler)

// ─── Global Error Handler ────────────────────────────────────
app.use(errorHandler)

// ─── 404 Fallback ────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } })
})

// ─── Start Server ────────────────────────────────────────────
let server: ReturnType<typeof app.listen>

async function bootstrap() {
  try {
    // Warm-load secrets first so every subsequent call hits cache, not KMS.
    await warmSecrets([
      'BACKEND_PRIVATE_KEY',
      'ENCRYPTION_KEY',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'RAZORPAY_WEBHOOK_SECRET',
    ])

    await prisma.$connect()
    logger.info('Supabase PostgreSQL connected')

    // Start server first so health checks pass, then kick off background jobs
    const outboxTimer = startOutboxSweep()

    server = app.listen(Number(PORT), '0.0.0.0', () => {
      logger.info({
        msg: 'GramChain API Server running',
        port: PORT,
        env: process.env.NODE_ENV ?? 'development',
        mode: process.env.DEMO_MODE === 'true' ? 'DEMO' : 'PRODUCTION',
      })
    })

    // SEC7: Removed dangerous taskkill logic — use a process manager (PM2) in prod.
    // In development, just exit cleanly so the dev can fix the port conflict.
    // Start background jobs & workers after server is listening (non-blocking)
    const workers: any[] = []
    workers.push(startBlockchainWriterWorker())
    startEventListener().catch(err => logger.warn({ err }, 'Event listener failed to start — will retry'))
    startRepaymentReminderJob().catch(err => logger.warn({ err }, 'Repayment reminder job failed to start'))
    startDefaultCheckerJob().catch(err => logger.warn({ err }, 'Default checker job failed to start'))
    startCleanupJob()
    startKycReminderJob()
    startReconcileJob()

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.fatal({ port: PORT }, `Port ${PORT} is already in use. Stop the other process or use a different PORT.`)
        process.exit(1)
      } else {
        logger.fatal({ err }, 'Server listen error')
        process.exit(1)
      }
    })

    // ─── Graceful Shutdown ──────────────────────────────────
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — gracefully shutting down`)
      server.close(async () => {
        logger.info('HTTP server closed')
        // Stop outbox sweep
        clearInterval(outboxTimer)
        for (const w of workers) {
          if (w?.close) await w.close()
        }
        await prisma.$disconnect()
        logger.info('Database disconnected — process exiting')
        process.exit(0)
      })
      // Force exit after 15s if graceful shutdown stalls
      setTimeout(() => {
        logger.error('Forced shutdown after timeout')
        process.exit(1)
      }, 15_000)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))

  } catch (err) {
    logger.fatal({ err }, 'Failed to start server')
    process.exit(1)
  }
}

bootstrap()

export default app
