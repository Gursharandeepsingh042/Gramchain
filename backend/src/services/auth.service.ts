import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { AppError } from '@/middleware/error.middleware'
import axios from 'axios'
import { OAuth2Client } from 'google-auth-library'
import bcrypt from 'bcryptjs'

const DEMO_MODE = process.env.DEMO_MODE === 'true'
const DEMO_OTP = process.env.DEMO_OTP ?? '123456'
const OTP_TTL_MINUTES = 5



const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

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

  // Get or create user
  let user = await prisma.user.findFirst({
    where: {
      OR: [{ googleId }, { email: email || '' }]
    }
  })

  // If user exists with the exact email but missing googleId, link them.
  if (user && !user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId }
    })
  } else if (!user) {
    user = await prisma.user.create({
      data: { googleId, email, name }
    })
  }

  // Generate JWT pair
  const accessToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  )
  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  )

  return { accessToken, refreshToken, user }
}

/**
 * Generate a 6-digit OTP and persist it.
 * Uses Fast2SMS to send the SMS to Indian numbers.
 */
export const sendOtp = async (phone: string): Promise<string> => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)

  // Rate Limiting on DB level (max 5 requests per 10 mins per phone)
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000)
  const count = await prisma.otpRecord.count({
    where: { phone, createdAt: { gte: tenMinsAgo } }
  })

  if (!DEMO_MODE && count >= 5) {
    throw new AppError(429, 'TOO_MANY_OTPS', 'You have requested too many OTPs. Try again after 10 minutes.')
  }

  // Upsert OTP record in DB
  await prisma.otpRecord.upsert({
    where: { phone },
    create: { phone, otp, expiresAt, attempts: 0 },
    update: { otp, expiresAt, attempts: 0, createdAt: new Date() },
  })

  if (DEMO_MODE) {
    console.log(`📱 DEMO MODE: OTP for ${phone} is ${otp}`)
  } else if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
    // Production: Twilio
    try {
      const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN)
      await client.messages.create({
        body: `Your GramChain verification code is: ${otp}`,
        from: process.env.TWILIO_PHONE,
        to: `+91${phone}`
      })
      console.log(`📱 OTP sent to ${phone} via Twilio`)
    } catch (error: any) {
      console.error(`Failed to send OTP to ${phone} via Twilio:`, error.message)
      throw new AppError(500, 'SMS_SEND_FAILED', 'Failed to send OTP via SMS provider. Please try again.')
    }
  } else {
    throw new AppError(500, 'SMS_CONFIG_ERROR', 'SMS Provider is not configured on the server.')
  }

  return otp
}

/**
 * Verify OTP and return JWT pair + user object.
 * Creates user if first-time login via phone.
 */
export const verifyOtp = async (phone: string, otp: string) => {
  const record = await prisma.otpRecord.findUnique({ where: { phone } })

  if (!record) {
    throw new AppError(400, 'OTP_NOT_FOUND', 'OTP not found. Please request a new one.')
  }

  if (record.expiresAt < new Date()) {
    await prisma.otpRecord.delete({ where: { phone } })
    throw new AppError(400, 'OTP_EXPIRED', 'OTP has expired. Please request a new one.')
  }

  if (record.otp !== otp) {
    if (DEMO_MODE && otp === '222222') {
      // Allow bypass in DEMO_MODE
      console.log(`✅ DEMO MODE: Bypassed OTP check for ${phone}`)
    } else {
      await prisma.otpRecord.update({
        where: { phone },
        data: { attempts: { increment: 1 } },
      })
      throw new AppError(400, 'INVALID_OTP', 'Incorrect OTP. Please try again.')
    }
  }

  // OTP valid — clean up
  await prisma.otpRecord.delete({ where: { phone } })

  // Get or create user
  let user = await prisma.user.findUnique({ where: { phone } })
  if (!user) {
    user = await prisma.user.create({ data: { phone } })
  }

  // Generate JWT pair
  const accessToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  )
  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  )

  return { accessToken, refreshToken, user }
}

/**
 * Rotate refresh token — validates old token and issues new pair
 */
export const refreshTokens = async (refreshToken: string) => {
  let payload: { userId: string }
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string }
  } catch {
    throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token is invalid or expired')
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user) throw new AppError(401, 'USER_NOT_FOUND', 'User no longer exists')

  const newAccessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '15m' })
  const newRefreshToken = jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' })

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, user }
}

/**
 * Login with Email and Password
 */
export const loginWithPassword = async (email: string, password: string) => {
  const user = await prisma.user.findFirst({ where: { email } })
  // @ts-ignore - password added to schema, but IDE types might be stale
  if (!user || !user.password) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email address or password')
  }

  // @ts-ignore
  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email address or password')
  }

  // Generate JWT pair
  const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '15m' })
  const refreshToken = jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' })

  return { accessToken, refreshToken, user }
}

/**
 * Register user details after OTP verification
 */
export const registerUser = async (data: { phone: string; name: string; email: string; password?: string }) => {
  const { phone, name, email, password } = data

  let user = await prisma.user.findUnique({ where: { phone } })
  
  const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined

  if (user) {
    // Update existing user (created during OTP step)
    user = await prisma.user.update({
      where: { phone },
      // @ts-ignore
      data: { name, email, password: hashedPassword }
    })
  } else {
    // Create new user
    user = await prisma.user.create({
      // @ts-ignore
      data: { phone, name, email, password: hashedPassword }
    })
  }

  // Generate JWT pair
  const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '15m' })
  const refreshToken = jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' })

  return { accessToken, refreshToken, user }
}
