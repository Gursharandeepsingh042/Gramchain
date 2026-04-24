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
 * Body: { email: string, password: string }
 */
export const loginWithPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      sendError(res, 'MISSING_FIELDS', 'email and password are required')
      return
    }
    const result = await AuthService.loginWithPassword(email, password)
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
