import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'

import routes from './routes'
import { errorHandler } from './middleware/error.middleware'
import { prisma } from './lib/prisma'

const app = express()
const PORT = process.env.PORT ?? 3000

// ─── Security & Performance Middleware ──────────────────────
app.use(helmet())
app.use(cors({ origin: '*', credentials: true }))
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// ─── Rate Limiting ───────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
})
app.use('/api', limiter)

// ─── Routes ─────────────────────────────────────────────────
app.use('/api/v1', routes)

// ─── Global Error Handler ───────────────────────────────────
app.use(errorHandler)

// ─── 404 fallback ───────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } })
})

// ─── Start Server ────────────────────────────────────────────
async function bootstrap() {
  try {
    // Test DB connection
    await prisma.$connect()
    console.log('✅ Supabase PostgreSQL connected')

    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`
🌿 GramChain API Server running!
   → Local:    http://localhost:${PORT}
   → Network:  http://192.168.1.10:${PORT}
   → Mode:     ${process.env.DEMO_MODE === 'true' ? '🔐 DEMO MODE (Random OTP Enabled)' : '🚀 PRODUCTION'}
      `)
    })
  } catch (err) {
    console.error('❌ Failed to connect to database:', err)
    process.exit(1)
  }
}

bootstrap()

export default app
