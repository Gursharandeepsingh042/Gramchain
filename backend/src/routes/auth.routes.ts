import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as AuthController from '@/controllers/auth.controller'
import { authenticate } from '@/middleware/auth.middleware'

const router = Router()

const DEMO_MODE = process.env.DEMO_MODE === 'true'

// Rate limiter for OTP sending to prevent SMS bombing
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: DEMO_MODE ? 100 : 5, // Relaxed for development/demo mode
  message: { success: false, error: { message: 'Too many OTP requests. Please try again after 10 minutes' } },
  standardHeaders: true,
  legacyHeaders: false,
})

// General auth rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})

// Stricter limiter for login/firebase to prevent brute force / token grinding
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per 15 min
  message: { success: false, error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many login attempts. Please try again after 15 minutes.' } },
  standardHeaders: true,
  legacyHeaders: false,
})

router.use(authLimiter)

/** @route POST /auth/send-otp */
router.post('/send-otp', otpLimiter, AuthController.sendOtp)

/** @route POST /auth/verify-otp */
router.post('/verify-otp', AuthController.verifyOtp)

/** @route POST /auth/google */
router.post('/google', AuthController.verifyGoogle)

/** @route POST /auth/login */
router.post('/login', AuthController.loginWithPassword)

/** @route POST /auth/register */
router.post('/register', AuthController.register)

/** @route POST /auth/refresh */
router.post('/refresh', AuthController.refreshToken)

/** @route POST /auth/logout — N1: invalidates refresh tokens + clears FCM */
router.post('/logout', authenticate, AuthController.logout)

/** @route GET /auth/me */
router.get('/me', authenticate, AuthController.getMe)

/** @route POST /auth/set-password */
router.post('/set-password', authenticate, AuthController.setPassword)

/** @route GET /auth/check-phone */
router.get('/check-phone', AuthController.checkPhone)

/** @route POST /auth/firebase */
router.post('/firebase', loginLimiter, AuthController.verifyFirebase)

export default router
