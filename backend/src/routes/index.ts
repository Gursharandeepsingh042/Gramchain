import { Router } from 'express'
import authRoutes from './auth.routes'
import shgRoutes from './shg.routes'
import loanRoutes from './loan.routes'
import kycRoutes from './kyc.routes'
import lenderRoutes from './lender.routes'
import blockchainRoutes from './blockchain.routes'
import geoRoutes from './geo.routes'
import bankRoutes from './bank.routes'
import notificationRoutes from './notification.routes'
import paymentRoutes from './payment.routes'
import { authenticate } from '@/middleware/auth.middleware'
import { isConnected, getSignerAddress } from '@/services/blockchain.service'

const router = Router()

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gramchain-api', timestamp: new Date().toISOString() })
})

// Public routes
router.use('/auth', authRoutes)
router.use('/geo', geoRoutes)

// Protected routes
router.use('/shg', authenticate, shgRoutes)
router.use('/loan', authenticate, loanRoutes)
router.use('/kyc', authenticate, kycRoutes)
router.use('/lender', authenticate, lenderRoutes)

// Public blockchain status (before protected routes)
router.get('/blockchain/status', async (_req, res) => {
  res.json({
    success: true,
    data: {
      connected: isConnected(),
      signerAddress: getSignerAddress(),
      network: process.env.POLYGON_RPC_URL ?? 'http://127.0.0.1:8545',
      demoMode: process.env.DEMO_MODE === 'true',
    },
  })
})

// Protected blockchain routes (excluding status)
router.use('/blockchain', authenticate, blockchainRoutes)
router.use('/bank', authenticate, bankRoutes)
router.use('/notifications', authenticate, notificationRoutes)
router.use('/payment', paymentRoutes) // auth applied per-route (webhook is unauthenticated)

export default router
