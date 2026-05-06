/**
 * Bank Account Service — Mock SMS Verification Flow
 * 
 * Simulates bank account linking via SMS OTP (like PhonePe/PayTM).
 * Designed to be swapped with real bank APIs when partnerships are established.
 */

import { prisma } from '@/lib/prisma'
import { AppError } from '@/middleware/error.middleware'
import crypto from 'crypto'

// In-memory store for pending SMS verifications (use Redis in production)
const pendingVerifications = new Map<string, {
  userId: string
  bankName: string
  accountNumber: string
  ifsc: string
  otp: string
  expiresAt: Date
}>()

const OTP_TTL_MINUTES = 5
const DEMO_MODE = process.env.DEMO_MODE === 'true'

/**
 * Initiate bank account linking
 * Mock sends SMS to user's registered mobile with verification code
 */
export const initiateBankLinking = async (params: {
  userId: string
  bankName: string
  accountNumber: string
  ifsc: string
}) => {
  const { userId, bankName, accountNumber, ifsc } = params

  // Validate IFSC format (11 characters: 4 bank code + 0 + 6 branch code)
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    throw new AppError(400, 'INVALID_IFSC', 'Invalid IFSC code format. Expected: AAAA0XXXXXX')
  }

  // Validate account number (minimum 9 digits, maximum 18)
  if (!/^\d{9,18}$/.test(accountNumber)) {
    throw new AppError(400, 'INVALID_ACCOUNT_NUMBER', 'Account number must be 9-18 digits')
  }

  // Check if account already linked
  const existing = await prisma.bankAccount.findFirst({
    where: { userId, accountNumber: accountNumber.slice(-4) }
  })
  if (existing) {
    throw new AppError(409, 'ACCOUNT_ALREADY_LINKED', 'This account is already linked')
  }

  // Generate 6-digit OTP
  const otp = DEMO_MODE ? '123456' : Math.floor(100000 + Math.random() * 900000).toString()
  const referenceId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)

  // Store pending verification
  pendingVerifications.set(referenceId, {
    userId,
    bankName,
    accountNumber,
    ifsc,
    otp,
    expiresAt
  })

  // In production, this would trigger an actual SMS via Twilio or similar
  // For now, in demo mode, the OTP is predictable

  return {
    referenceId,
    message: DEMO_MODE 
      ? `Demo mode: Use OTP ${otp}` 
      : 'SMS verification code sent to your registered mobile number',
    expiresIn: OTP_TTL_MINUTES * 60
  }
}

/**
 * Verify SMS OTP and complete bank linking
 */
export const verifyBankLinking = async (params: {
  userId: string
  referenceId: string
  otp: string
}) => {
  const { userId, referenceId, otp } = params

  const pending = pendingVerifications.get(referenceId)
  if (!pending) {
    throw new AppError(400, 'VERIFICATION_NOT_FOUND', 'Verification session not found or expired')
  }

  if (pending.userId !== userId) {
    throw new AppError(403, 'UNAUTHORIZED', 'This verification session does not belong to you')
  }

  if (new Date() > pending.expiresAt) {
    pendingVerifications.delete(referenceId)
    throw new AppError(400, 'OTP_EXPIRED', 'Verification code has expired. Please start again.')
  }

  // Verify OTP (timing-safe comparison)
  const isValid = (() => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(pending.otp, 'utf8'),
        Buffer.from(otp.padStart(pending.otp.length, '\0'), 'utf8')
      )
    } catch {
      return false
    }
  })()

  if (!isValid) {
    throw new AppError(400, 'INVALID_OTP', 'Invalid verification code')
  }

  // Create bank account record (store only last 4 digits for display)
  const maskedAccountNumber = pending.accountNumber.slice(-4)
  
  const bankAccount = await prisma.bankAccount.create({
    data: {
      userId,
      bankName: pending.bankName,
      accountNumber: maskedAccountNumber,
      ifsc: pending.ifsc,
      verified: true,
      verifiedAt: new Date()
    }
  })

  // Clean up pending verification
  pendingVerifications.delete(referenceId)

  return {
    id: bankAccount.id,
    bankName: bankAccount.bankName,
    accountNumber: `XXXX${bankAccount.accountNumber}`,
    ifsc: bankAccount.ifsc,
    verified: true,
    verifiedAt: bankAccount.verifiedAt
  }
}

/**
 * Get all linked bank accounts for a user
 */
export const getUserBankAccounts = async (userId: string) => {
  const accounts = await prisma.bankAccount.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  })

  return accounts.map(acc => ({
    id: acc.id,
    bankName: acc.bankName,
    accountNumber: `XXXX${acc.accountNumber}`,
    ifsc: acc.ifsc,
    verified: acc.verified,
    verifiedAt: acc.verifiedAt,
    createdAt: acc.createdAt
  }))
}

/**
 * Delete/unlink a bank account
 */
export const deleteBankAccount = async (userId: string, accountId: string) => {
  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, userId }
  })

  if (!account) {
    throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Bank account not found')
  }

  await prisma.bankAccount.delete({
    where: { id: accountId }
  })

  return { message: 'Bank account unlinked successfully' }
}
