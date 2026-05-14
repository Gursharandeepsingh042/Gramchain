import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { AppError } from '@/middleware/error.middleware'
import axios from 'axios'
import { OAuth2Client } from 'google-auth-library'
import bcrypt from 'bcryptjs'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

const DEMO_MODE = process.env.DEMO_MODE === 'true'
const DEMO_OTP = process.env.DEMO_OTP ?? '123456'
const OTP_TTL_MINUTES = 5
const OTP_MAX_ATTEMPTS = 5
const OTP_LOCKOUT_MINUTES = 30
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

// ─── JWT Helpers ─────────────────────────────────────────────

function signAccessToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '15m' })
}

function signRefreshToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' })
}

/**
 * Store refresh token in Redis so it can be invalidated on logout/reuse detection.
 * Key: refresh:<userId>  Value: the token  TTL: 7d
 */
async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const redis = await getRedis()
  if (redis) {
    await redis.setEx(`refresh:${userId}`, REFRESH_TOKEN_TTL_SECONDS, token)
  }
}

/**
 * Invalidate all refresh tokens for a user (logout, password change, security event).
 */
export const invalidateRefreshTokens = async (userId: string): Promise<void> => {
  const redis = await getRedis()
  if (redis) {
    await redis.del(`refresh:${userId}`)
  }
}

// ─── Google Sign-In ──────────────────────────────────────────

/**
 * Verify Google ID Token and login/register user.
 */
export const verifyGoogleSignIn = async (idToken: string) => {
  let ticket
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
  } catch (error) {
    throw new AppError(401, 'INVALID_GOOGLE_TOKEN', 'Google token verification failed')
  }

  const payload = ticket.getPayload()
  if (!payload || !payload.sub) {
    throw new AppError(401, 'INVALID_GOOGLE_TOKEN', 'Missing Google profile information')
  }

  const { sub: googleId, email, name } = payload

  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId }, { email: email || '' }] },
  })

  if (user && !user.googleId) {
    user = await prisma.user.update({ where: { id: user.id }, data: { googleId } })
  } else if (!user) {
    user = await prisma.user.create({ data: { googleId, email, name, role: 'BORROWER' } })
  }

  const accessToken = signAccessToken(user.id)
  const refreshToken = signRefreshToken(user.id)
  await storeRefreshToken(user.id, refreshToken)

  return { accessToken, refreshToken, user }
}

// ─── OTP Auth ────────────────────────────────────────────────

/**
 * Generate a 6-digit OTP and persist it for rate limiting and demo mode.
 * OTP delivery is handled by Firebase Phone Auth on the mobile client.
 * Rate-limited: max 5 OTP requests per 10 mins via requestCount on the record.
 */
export const sendOtp = async (phone: string): Promise<string> => {
  const otp = DEMO_MODE ? DEMO_OTP : Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)

  // FIX: Rate limiting via the existing record's window.
  // OtpRecord is unique per phone, so count() always returns <= 1 and was useless.
  // Instead, track the number of send requests with a requestCount field.
  // If updatedAt is within 10 mins and requestCount >= 5, block.
  if (!DEMO_MODE) {
    const existing = await prisma.otpRecord.findUnique({ where: { phone } })
    if (existing) {
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000)
      const requestCount = existing.requestCount ?? 0
      if (existing.updatedAt > tenMinsAgo && requestCount >= 5) {
        throw new AppError(429, 'TOO_MANY_OTPS', 'Too many OTP requests. Try again after 10 minutes.')
      }
    }
  }

  // FIX A1: Increment requestCount so rate limiting actually works
  await prisma.otpRecord.upsert({
    where: { phone },
    create: { phone, otp, expiresAt, attempts: 0, requestCount: 1 },
    update: { otp, expiresAt, attempts: 0, requestCount: { increment: 1 } },
  })

  // FIX A2: In production, OTP is sent via Firebase Auth on the mobile client.
  // The backend only stores the OTP record for verification purposes.
  // Return the OTP in demo mode for testing, otherwise return a masked message.
  if (DEMO_MODE) {
    logger.info({ phone, otp }, '[DEMO] OTP generated (visible in demo only)')
    return otp
  }

  // In production, OTP delivery is handled by Firebase Phone Auth on the client.
  // This endpoint only persists the server-side record for rate limiting and verification.
  logger.info({ phone }, 'OTP record persisted — delivery via Firebase Phone Auth')
  return 'OTP_STORED'
}

/**
 * Verify OTP — enforces attempt limits and lockout.
 * Creates user if first-time login via phone.
 */
export const verifyOtp = async (phone: string, otp: string) => {
  const record = await prisma.otpRecord.findUnique({ where: { phone } })

  if (!record) {
    throw new AppError(400, 'OTP_NOT_FOUND', 'OTP not found. Please request a new one.')
  }

  // Check lockout: too many failed attempts
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    const lockedUntil = new Date(record.createdAt.getTime() + OTP_LOCKOUT_MINUTES * 60 * 1000)
    if (new Date() < lockedUntil) {
      throw new AppError(429, 'OTP_LOCKED', `Too many failed attempts. Try again after ${OTP_LOCKOUT_MINUTES} minutes.`)
    }
    // Lockout period passed — reset
    await prisma.otpRecord.update({ where: { phone }, data: { attempts: 0 } })
  }

  if (record.expiresAt < new Date()) {
    await prisma.otpRecord.delete({ where: { phone } })
    throw new AppError(400, 'OTP_EXPIRED', 'OTP has expired. Please request a new one.')
  }

  // Use timing-safe comparison to prevent timing attacks on OTP
  const isValidOtp = (() => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(record.otp, 'utf8'),
        Buffer.from(otp.padStart(record.otp.length, '\0'), 'utf8')
      )
    } catch {
      return false // Buffer length mismatch = definitely wrong
    }
  })()

  if (!isValidOtp) {
    await prisma.otpRecord.update({
      where: { phone },
      data: { attempts: { increment: 1 } },
    })
    const remaining = OTP_MAX_ATTEMPTS - (record.attempts + 1)
    throw new AppError(400, 'INVALID_OTP', `Incorrect OTP. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Account locked.'}`)
  }

  // OTP valid — clean up record
  await prisma.otpRecord.delete({ where: { phone } })

  let user = await prisma.user.findUnique({ where: { phone } })
  if (!user) {
    user = await prisma.user.create({ data: { phone, role: 'BORROWER' } })
  }

  const accessToken = signAccessToken(user.id)
  const refreshToken = signRefreshToken(user.id)
  await storeRefreshToken(user.id, refreshToken)

  return { accessToken, refreshToken, user }
}

/**
 * Rotate refresh token — validates old token, checks Redis store, issues new pair.
 * Old refresh token is invalidated to prevent reuse (refresh token rotation).
 */
export const refreshTokens = async (refreshToken: string) => {
  let payload: { userId: string }
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string }
  } catch {
    throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token is invalid or expired')
  }

  // Verify token matches stored token (detects stolen/reused tokens)
  const redis = await getRedis()
  if (redis) {
    const stored = await redis.get(`refresh:${payload.userId}`)
    if (!stored || stored !== refreshToken) {
      // Possible token reuse — invalidate everything for this user
      await redis.del(`refresh:${payload.userId}`)
      throw new AppError(401, 'REFRESH_TOKEN_REUSED', 'Refresh token has already been used or invalidated. Please log in again.')
    }
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user) throw new AppError(401, 'USER_NOT_FOUND', 'User no longer exists')

  const newAccessToken = signAccessToken(user.id)
  const newRefreshToken = signRefreshToken(user.id)
  await storeRefreshToken(user.id, newRefreshToken) // rotates: overwrites old

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, user }
}

/**
 * Logout — invalidates refresh token in Redis and clears FCM push token (N1)
 */
export const logout = async (userId: string): Promise<void> => {
  await invalidateRefreshTokens(userId)
  // N1: Clear FCM token on logout to prevent stale push notifications
  await prisma.user.update({
    where: { id: userId },
    data: { fcmToken: null },
  }).catch(() => { /* user may not exist — non-fatal */ })
}

// A4: Brute-force lockout config
const LOGIN_MAX_ATTEMPTS = 5
const LOGIN_LOCKOUT_SECONDS = 15 * 60 // 15 minutes

/**
 * Login with identifier (Email OR 10-digit Phone) and password.
 *
 * A4: Brute-force protection — Redis-backed counter per identifier.
 * After 5 failed attempts in 15 minutes, the identifier is locked out.
 * Successful login clears the counter.
 */
export const loginWithPassword = async (identifier: string, password: string) => {
  const trimmed = (identifier || '').trim()
  const isPhone = /^\d{10}$/.test(trimmed)
  const normalized = isPhone ? trimmed : trimmed.toLowerCase()
  const lockKey = `login:fail:${normalized}`

  // A4: Check lockout
  const redis = await getRedis()
  if (redis) {
    const fails = parseInt((await redis.get(lockKey)) || '0', 10)
    if (fails >= LOGIN_MAX_ATTEMPTS) {
      const ttl = await redis.ttl(lockKey)
      throw new AppError(
        429,
        'TOO_MANY_ATTEMPTS',
        `Too many failed login attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`
      )
    }
  }

  const user = await prisma.user.findFirst({
    where: isPhone ? { phone: trimmed } : { email: normalized }
  })

  const recordFailure = async () => {
    if (!redis) return
    const count = await redis.incr(lockKey)
    if (count === 1) await redis.expire(lockKey, LOGIN_LOCKOUT_SECONDS)
  }

  if (!user) {
    await recordFailure()
    throw new AppError(401, 'INVALID_CREDENTIALS', 'No account found with this email or phone')
  }
  if (!user.password) {
    throw new AppError(
      401,
      'NO_PASSWORD_SET',
      'No password is set for this account. Please log in with Google or OTP, then set a password from your Profile.'
    )
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    await recordFailure()
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email/phone or password')
  }

  // Clear lockout counter on successful login
  if (redis) await redis.del(lockKey)

  const accessToken = signAccessToken(user.id)
  const refreshToken = signRefreshToken(user.id)
  await storeRefreshToken(user.id, refreshToken)

  return { accessToken, refreshToken, user }
}

/**
 * Register user details after OTP verification
 */
export const registerUser = async (data: {
  phone: string
  name: string
  email: string
  password?: string
}) => {
  const { phone, name, email, password } = data

  let user = await prisma.user.findUnique({ where: { phone } })
  const hashedPassword = password ? await bcrypt.hash(password, 12) : undefined

  // Guard: ensure the email isn't already taken by a different user
  if (email) {
    const emailOwner = await prisma.user.findUnique({ where: { email } })
    if (emailOwner && emailOwner.id !== user?.id) {
      throw new AppError(409, 'EMAIL_TAKEN', 'This email is already associated with another account.')
    }
  }

  if (user) {
    user = await prisma.user.update({
      where: { phone },
      data: { name, email, password: hashedPassword },
    })
  } else {
    user = await prisma.user.create({
      data: { phone, name, email, password: hashedPassword, role: 'BORROWER' },
    })
  }

  const accessToken = signAccessToken(user.id)
  const refreshToken = signRefreshToken(user.id)
  await storeRefreshToken(user.id, refreshToken)

  return { accessToken, refreshToken, user }
}

/**
 * Verify Firebase ID Token and login/register user (Phone, Email, or Google Auth).
 */
export const verifyFirebaseToken = async (
  idToken: string,
  providedName?: string,
  providedGroupCode?: string,
  providedPassword?: string,
  providedRole?: 'BORROWER' | 'LENDER'
) => {
  let decodedToken;
  try {
    const admin = (await import('@/lib/firebase')).default;
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (error: any) {
    logger.error({ 
        message: error.message, 
        code: error.code,
        stack: error.stack 
    }, 'Firebase token verification failed');
    throw new AppError(401, 'INVALID_FIREBASE_TOKEN', `Firebase token verification failed: ${error.message}`);
  }

  const { phone_number, email, name, uid, aud, iss } = decodedToken;
  logger.info({ 
    uid, 
    phone: phone_number, 
    email, 
    aud, 
    iss 
  }, 'Firebase Token Decoded Successfully');

  if (!phone_number && !email) {
    throw new AppError(401, 'INVALID_FIREBASE_TOKEN', 'No phone or email associated with this token');
  }

  // 1. Try to find user by email first
  let user: any = null;
  if (email) {
      user = await prisma.user.findFirst({ where: { email } });
  }

  // 2. If not found by email, try to find by phone
  let normalizedPhone: string | undefined = undefined;
  if (phone_number) {
      normalizedPhone = phone_number.replace(/^\+91/, '');
      if (normalizedPhone.startsWith('+')) {
          normalizedPhone = normalizedPhone.replace(/^\+/, '');
      }
  }

  if (!user && normalizedPhone) {
      user = await prisma.user.findFirst({ where: { phone: normalizedPhone } });
  }

  const finalName = providedName || name || undefined;

  // Hash password ONCE if provided
  const hashedPassword = providedPassword && providedPassword.length >= 8
    ? await bcrypt.hash(providedPassword, 12)
    : undefined;

  let isNewUser = false;

  if (!user) {
    // 3. Create new user if zero matches — role defaults to BORROWER unless explicitly LENDER
    isNewUser = true;
    user = await prisma.user.create({
        data: {
            phone: normalizedPhone || uid,
            email: email || undefined,
            name: finalName,
            googleId: uid,
            role: providedRole === 'LENDER' ? 'LENDER' : 'BORROWER',
            ...(hashedPassword ? { password: hashedPassword } : {}),
        }
    });
  } else {
    // 4. Update existing user to prevent redundancy (Merging info).
    //    Backfill password ONLY if the user doesn't already have one (never overwrite).
    user = await prisma.user.update({
        where: { id: user.id },
        data: {
            googleId: user.googleId || uid,
            phone: user.phone || normalizedPhone || undefined,
            email: user.email || email || undefined,
            name: user.name || finalName || undefined,
            ...(hashedPassword && !user.password ? { password: hashedPassword } : {}),
        }
    });
  }

  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  await storeRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken, user, isNewUser };
}

/**
 * Set or update the hashed password for a user (for OTP/Google users).
 */
export const setPassword = async (userId: string, password: string): Promise<void> => {
  if (!password || password.length < 8) {
    throw new AppError(400, 'INVALID_PASSWORD', 'Password must be at least 8 characters')
  }
  const hash = await bcrypt.hash(password, 12)
  await prisma.user.update({ where: { id: userId }, data: { password: hash } })
}
