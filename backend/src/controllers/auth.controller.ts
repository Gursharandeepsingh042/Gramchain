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
 * GET /auth/google/mobile-start
 * Initiates Google OAuth for mobile apps.
 * Query: returnUrl (exp:// or gramchain:// deep link for the app to return to)
 * Redirects the browser to Google's consent screen.
 */
export const googleMobileStart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const returnUrl = (req.query.returnUrl as string) || 'gramchain://'
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
    const backendUrl = `${req.protocol}://${req.get('host')}`
    const callbackUrl = `${backendUrl}/api/v1/auth/google/mobile-callback`

    // Encode returnUrl into state so we know where to redirect after
    const state = Buffer.from(JSON.stringify({ returnUrl })).toString('base64url')

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'select_account',
    })

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /auth/google/mobile-callback
 * Google redirects here after consent. Exchanges code for tokens,
 * creates/finds the user, then redirects back to the mobile app with JWT tokens.
 */
export const googleMobileCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, state, error: oauthError } = req.query as Record<string, string>

    // Decode returnUrl from state
    let returnUrl = 'gramchain://'
    try {
      const parsed = JSON.parse(Buffer.from(state || '', 'base64url').toString())
      returnUrl = parsed.returnUrl || returnUrl
    } catch { /* use default */ }

    if (oauthError || !code) {
      const errorUrl = new URL(returnUrl)
      errorUrl.searchParams.set('error', oauthError || 'no_code')
      res.redirect(errorUrl.toString())
      return
    }

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
    const backendUrl = `${req.protocol}://${req.get('host')}`
    const callbackUrl = `${backendUrl}/api/v1/auth/google/mobile-callback`

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json() as any

    if (!tokenData.id_token) {
      const errorUrl = new URL(returnUrl)
      errorUrl.searchParams.set('error', 'token_exchange_failed')
      res.redirect(errorUrl.toString())
      return
    }

    // Verify the ID token and login/register user
    const result = await AuthService.verifyGoogleSignIn(tokenData.id_token)

    // Redirect back to the mobile app with tokens
    const successUrl = new URL(returnUrl)
    successUrl.searchParams.set('accessToken', result.accessToken)
    successUrl.searchParams.set('refreshToken', result.refreshToken)
    successUrl.searchParams.set('userId', result.user.id)
    successUrl.searchParams.set('userName', result.user.name || '')
    successUrl.searchParams.set('userEmail', result.user.email || '')
    successUrl.searchParams.set('kycStatus', result.user.kycStatus || '')
    successUrl.searchParams.set('userRole', result.user.role || 'BORROWER')
    res.redirect(successUrl.toString())
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
