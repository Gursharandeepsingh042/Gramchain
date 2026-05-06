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
router.use('/blockchain', authenticate, blockchainRoutes)
router.use('/bank', authenticate, bankRoutes)
router.use('/notifications', authenticate, notificationRoutes)
router.use('/payment', paymentRoutes) // auth applied per-route (webhook is unauthenticated)

export default router
