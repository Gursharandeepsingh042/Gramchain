import { Router } from 'express'
import authRoutes from './auth.routes'
import shgRoutes from './shg.routes'
import loanRoutes from './loan.routes'
import kycRoutes from './kyc.routes'
import lenderRoutes from './lender.routes'
import { authenticate } from '@/middleware/auth.middleware'

const router = Router()

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gramchain-api', timestamp: new Date().toISOString() })
})

// Auth routes (public: send-otp, verify-otp, refresh)
router.use('/auth', authRoutes)

// Protected routes
router.use('/shg', authenticate, shgRoutes)
router.use('/loan', authenticate, loanRoutes)
router.use('/kyc', authenticate, kycRoutes)
router.use('/lender', authenticate, lenderRoutes)

export default router
