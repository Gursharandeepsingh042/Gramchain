import { Router } from 'express'
import * as PaymentController from '@/controllers/payment.controller'
import { authenticate } from '@/middleware/auth.middleware'
import rateLimit from 'express-rate-limit'

const router = Router()

// Tighter rate limit on payment endpoints — 10/min per user.
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  keyGenerator: (req: any) => req.userId || req.ip,
  standardHeaders: true,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many payment requests' } },
})

/** POST /payment/order — create Razorpay order */
router.post('/order', authenticate, paymentLimiter, PaymentController.createOrder)

/** POST /payment/verify — verify client-side signature after checkout */
router.post('/verify', authenticate, paymentLimiter, PaymentController.verifyPayment)

// /payment/webhook is mounted at the top of routes/index.ts with raw-body parser.
// Don't add it here.

export default router
