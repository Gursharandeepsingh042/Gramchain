import { Request, Response, NextFunction } from 'express'
import * as AuthService from '@/services/auth.service'
import { sendSuccess, sendError } from '@/utils/response'
import { AuthenticatedRequest } from '@/middleware/auth.middleware'

/**
 * POST /auth/send-otp
 * Body: { phone: string }
 */
export const sendOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // DEPRECATED: real OTP delivery is handled by Firebase Phone Auth on the mobile client.
    // This endpoint remains ONLY for demo mode (automated tests, offline dev). In production,
    // clients must call POST /auth/firebase with a Firebase ID token instead.
    if (process.env.DEMO_MODE !== 'true') {
      res.status(410).json({
        success: false,
        data: null,
        error: {
          code: 'ENDPOINT_DEPRECATED',
          message: 'Use POST /auth/firebase with a Firebase ID token. Real OTP delivery is handled client-side by Firebase Phone Auth.',
        },
        timestamp: new Date().toISOString(),
      })
      return
    }
    const { phone } = req.body
    if (!phone || !/^\d{10}$/.test(phone)) {
      sendError(res, 'INVALID_PHONE', 'Phone must be a 10-digit Indian mobile number')
      return
    }
    const otp = await AuthService.sendOtp(phone)
    sendSuccess(res, {
      message: process.env.DEMO_MODE === 'true'
        ? `Demo mode: use OTP ${otp}`
        : `OTP sent to +91${phone}`,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * POST /auth/verify-otp
 * Body: { phone: string, otp: string }
 */
export const verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // DEPRECATED: see sendOtp comment. Only usable in demo mode.
    if (process.env.DEMO_MODE !== 'true') {
      res.status(410).json({
        success: false,
        data: null,
        error: {
          code: 'ENDPOINT_DEPRECATED',
          message: 'Use POST /auth/firebase with a Firebase ID token.',
        },
        timestamp: new Date().toISOString(),
      })
      return
    }
    const { phone, otp } = req.body
    if (!phone || !otp) {
      sendError(res, 'MISSING_FIELDS', 'phone and otp are required')
      return
    }
    const result = await AuthService.verifyOtp(phone, otp)
    sendSuccess(res, result, 200)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /auth/login
 * Body: { identifier: string, password: string }   // identifier = email OR 10-digit phone
 *       (also accepts { email, password } for backward compatibility)
 */
export const loginWithPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { identifier, email, password } = req.body
    const cred = identifier || email
    if (!cred || !password) {
      sendError(res, 'MISSING_FIELDS', 'identifier (email or phone) and password are required')
      return
    }
    const result = await AuthService.loginWithPassword(cred, password)
    sendSuccess(res, result, 200)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /auth/register
 * Body: { phone: string, name: string, email: string, password?: string }
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { phone, name, email, password } = req.body
    if (!phone || !name || !email) {
      sendError(res, 'MISSING_FIELDS', 'phone, name, and email are required')
      return
    }
    const result = await AuthService.registerUser({ phone, name, email, password })
    sendSuccess(res, result, 201)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /auth/refresh
 * Body: { refreshToken: string }
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      sendError(res, 'MISSING_TOKEN', 'refreshToken is required')
      return
    }
    const result = await AuthService.refreshTokens(refreshToken)
    sendSuccess(res, result)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /auth/logout
 * N1: Invalidates refresh tokens and clears the user's FCM push token.
 * Auth required — derives userId from the JWT.
 */
export const logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      sendError(res, 'UNAUTHENTICATED', 'Not authenticated', 401)
      return
    }
    await AuthService.logout(req.userId)
    sendSuccess(res, { message: 'Logged out' })
  } catch (error) {
    next(error)
  }
}

/**
 * POST /auth/google
 * Body: { idToken: string }
 */
export const verifyGoogle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { idToken } = req.body
    if (!idToken) {
      sendError(res, 'MISSING_TOKEN', 'idToken is required')
      return
    }
    const result = await AuthService.verifyGoogleSignIn(idToken)
    sendSuccess(res, result, 200)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /auth/me
 * Returns authenticated user profile
 */
export const getMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { prisma } = await import('@/lib/prisma')
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: {
        shgMemberships: {
          include: { shg: { select: { id: true, name: true, district: true } } },
        },
      },
    })
    sendSuccess(res, user)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /auth/set-password
 * Body: { password: string }
 * Allows OTP/Google users to set or update their app password.
 */
export const setPassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { password } = req.body
    await AuthService.setPassword(req.userId!, password)
    sendSuccess(res, { message: 'Password updated successfully' })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /auth/check-phone?phone=XXXXXXXXXX
 * Returns { exists: boolean } — used by signup screen to detect returning users
 */
export const checkPhone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { phone } = req.query as { phone?: string }
    if (!phone || !/^\d{10}$/.test(phone)) {
      sendError(res, 'INVALID_PHONE', 'Phone must be a 10-digit Indian mobile number')
      return
    }
    const { prisma } = await import('@/lib/prisma')
    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true, name: true } })
    sendSuccess(res, { exists: !!user, hasName: !!user?.name })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /auth/check-email?email=xxx@xxx.com
 * Returns { exists: boolean } — used by forgot-password screen
 */
export const checkEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.query as { email?: string }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendError(res, 'INVALID_EMAIL', 'Please provide a valid email address')
      return
    }
    const { prisma } = await import('@/lib/prisma')
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } })
    sendSuccess(res, { exists: !!user })
  } catch (error) {
    next(error)
  }
}

/**
 * POST /auth/firebase
 * Body: { idToken: string, name?: string, groupCode?: string }
 */
export const verifyFirebase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { idToken, name, groupCode, password, role } = req.body
    if (!idToken) {
      sendError(res, 'MISSING_TOKEN', 'idToken is required')
      return
    }
    const result = await AuthService.verifyFirebaseToken(idToken, name, groupCode, password, role)
    sendSuccess(res, result, 200)
  } catch (error) {
    next(error)
  }
}
