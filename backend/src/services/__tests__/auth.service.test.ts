/**
 * Unit tests for auth.service.ts — T2
 *
 * Strategy: Mock Prisma, Redis, and external libs (bcrypt, jwt, google-auth)
 * so tests run in isolation without any running services.
 */

// Must be set before importing the service (DEMO_MODE/DEMO_OTP captured at module load)
process.env.DEMO_MODE = 'true'
process.env.DEMO_OTP = '123456'
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars'

// ── Mocks must be declared before imports ────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  otpRecord: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const mockRedis = {
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
}
jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn().mockResolvedValue(mockRedis),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(),
  })),
}))

// ── Imports ─────────────────────────────────────────────────

import {
  sendOtp,
  verifyOtp,
  loginWithPassword,
  registerUser,
  setPassword,
  logout,
  invalidateRefreshTokens,
} from '../auth.service'

// ── Helpers ─────────────────────────────────────────────────

const resetAllMocks = () => {
  jest.clearAllMocks()
  // Default env
  process.env.DEMO_MODE = 'true'
  process.env.DEMO_OTP = '123456'
  process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long'
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars'
}

// ═════════════════════════════════════════════════════════════
// TEST SUITES
// ═════════════════════════════════════════════════════════════

describe('Auth Service', () => {
  beforeEach(resetAllMocks)

  // ── sendOtp ────────────────────────────────────────────────

  describe('sendOtp', () => {
    it('should return the demo OTP in demo mode', async () => {
      mockPrisma.otpRecord.upsert.mockResolvedValue({})
      const result = await sendOtp('9876543210')
      expect(result).toBe('123456')
      expect(mockPrisma.otpRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { phone: '9876543210' },
          create: expect.objectContaining({ phone: '9876543210', otp: '123456' }),
        })
      )
    })

    it('should set requestCount to 1 on first OTP request', async () => {
      mockPrisma.otpRecord.upsert.mockResolvedValue({})
      await sendOtp('9876543210')
      expect(mockPrisma.otpRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ requestCount: 1 }),
          update: expect.objectContaining({ requestCount: { increment: 1 } }),
        })
      )
    })

    it('should throw 429 when rate limited (non-demo mode)', async () => {
      mockPrisma.otpRecord.findUnique.mockResolvedValue({
        phone: '9876543210',
        requestCount: 5,
        updatedAt: new Date(), // within 10 min window
      })

      // Re-import service with DEMO_MODE=false (constant is captured at module load)
      let nonDemoSendOtp!: typeof sendOtp
      jest.isolateModules(() => {
        process.env.DEMO_MODE = 'false'
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        nonDemoSendOtp = require('../auth.service').sendOtp
        process.env.DEMO_MODE = 'true'
      })

      await expect(nonDemoSendOtp('9876543210')).rejects.toThrow('Too many OTP requests')
    })
  })

  // ── verifyOtp ──────────────────────────────────────────────

  describe('verifyOtp', () => {
    it('should throw if no OTP record exists', async () => {
      mockPrisma.otpRecord.findUnique.mockResolvedValue(null)
      await expect(verifyOtp('9876543210', '123456')).rejects.toThrow('OTP not found')
    })

    it('should throw if OTP has expired', async () => {
      mockPrisma.otpRecord.findUnique.mockResolvedValue({
        phone: '9876543210',
        otp: '123456',
        expiresAt: new Date(Date.now() - 60_000), // 1 minute ago
        attempts: 0,
      })
      mockPrisma.otpRecord.delete.mockResolvedValue({})
      await expect(verifyOtp('9876543210', '123456')).rejects.toThrow('expired')
    })

    it('should throw on incorrect OTP and increment attempts', async () => {
      mockPrisma.otpRecord.findUnique.mockResolvedValue({
        phone: '9876543210',
        otp: '123456',
        expiresAt: new Date(Date.now() + 300_000),
        attempts: 0,
      })
      mockPrisma.otpRecord.update.mockResolvedValue({})

      await expect(verifyOtp('9876543210', '000000')).rejects.toThrow('Incorrect OTP')
      expect(mockPrisma.otpRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { phone: '9876543210' },
          data: { attempts: { increment: 1 } },
        })
      )
    })

    it('should succeed with correct OTP and return tokens', async () => {
      const futureDate = new Date(Date.now() + 300_000)
      mockPrisma.otpRecord.findUnique.mockResolvedValue({
        phone: '9876543210',
        otp: '123456',
        expiresAt: futureDate,
        attempts: 0,
      })
      mockPrisma.otpRecord.delete.mockResolvedValue({})
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', phone: '9876543210' })
      mockRedis.setEx.mockResolvedValue('OK')

      const result = await verifyOtp('9876543210', '123456')
      expect(result.accessToken).toBeDefined()
      expect(result.refreshToken).toBeDefined()
      expect(result.user.id).toBe('user-1')
    })

    it('should create a new user if phone is not registered', async () => {
      const futureDate = new Date(Date.now() + 300_000)
      mockPrisma.otpRecord.findUnique.mockResolvedValue({
        phone: '9876543210',
        otp: '123456',
        expiresAt: futureDate,
        attempts: 0,
      })
      mockPrisma.otpRecord.delete.mockResolvedValue({})
      mockPrisma.user.findUnique.mockResolvedValue(null) // no user
      mockPrisma.user.create.mockResolvedValue({ id: 'new-user', phone: '9876543210' })
      mockRedis.setEx.mockResolvedValue('OK')

      const result = await verifyOtp('9876543210', '123456')
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: { phone: '9876543210', role: 'BORROWER' },
      })
      expect(result.user.id).toBe('new-user')
    })

    it('should lock out after 5 failed attempts', async () => {
      mockPrisma.otpRecord.findUnique.mockResolvedValue({
        phone: '9876543210',
        otp: '123456',
        expiresAt: new Date(Date.now() + 300_000),
        attempts: 5,
        createdAt: new Date(), // recent — still within lockout window
      })

      await expect(verifyOtp('9876543210', '123456')).rejects.toThrow('Too many failed attempts')
    })
  })

  // ── loginWithPassword ──────────────────────────────────────

  describe('loginWithPassword', () => {
    it('should throw if user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null)
      await expect(loginWithPassword('test@example.com', 'pass1234'))
        .rejects.toThrow('No account found')
    })

    it('should throw if no password is set', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1', password: null })
      await expect(loginWithPassword('test@example.com', 'pass1234'))
        .rejects.toThrow('No password is set')
    })

    it('should throw on wrong password', async () => {
      const bcrypt = require('bcryptjs')
      const hash = await bcrypt.hash('correct-password', 12)
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1', password: hash })

      await expect(loginWithPassword('test@example.com', 'wrong-password'))
        .rejects.toThrow('Invalid email/phone or password')
    })

    it('should return tokens on correct password', async () => {
      const bcrypt = require('bcryptjs')
      const hash = await bcrypt.hash('my-password', 12)
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1', password: hash })
      mockRedis.setEx.mockResolvedValue('OK')

      const result = await loginWithPassword('test@example.com', 'my-password')
      expect(result.accessToken).toBeDefined()
      expect(result.refreshToken).toBeDefined()
    })

    it('should detect phone-format identifiers', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null)
      await loginWithPassword('9876543210', 'pass').catch(() => {})
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { phone: '9876543210' },
      })
    })

    it('should detect email-format identifiers', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null)
      await loginWithPassword('user@gramchain.in', 'pass').catch(() => {})
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'user@gramchain.in' },
      })
    })

    // ── A4: Brute-force lockout ─────────────────────────────
    describe('A4 brute-force lockout', () => {
      it('should increment fail counter on wrong password', async () => {
        const bcrypt = require('bcryptjs')
        const hash = await bcrypt.hash('correct', 12)
        mockRedis.get.mockResolvedValue('0')
        mockRedis.incr.mockResolvedValue(1)
        mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1', password: hash })

        await expect(loginWithPassword('a@b.com', 'wrong')).rejects.toThrow('Invalid')
        expect(mockRedis.incr).toHaveBeenCalledWith('login:fail:a@b.com')
        expect(mockRedis.expire).toHaveBeenCalledWith('login:fail:a@b.com', 15 * 60)
      })

      it('should block after 5 failed attempts', async () => {
        mockRedis.get.mockResolvedValue('5')
        mockRedis.ttl.mockResolvedValue(600)

        await expect(loginWithPassword('a@b.com', 'pass')).rejects.toThrow('Too many failed login')
        expect(mockPrisma.user.findFirst).not.toHaveBeenCalled()
      })

      it('should clear counter on successful login', async () => {
        const bcrypt = require('bcryptjs')
        const hash = await bcrypt.hash('right', 12)
        mockRedis.get.mockResolvedValue('2')
        mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1', password: hash })
        mockRedis.setEx.mockResolvedValue('OK')

        await loginWithPassword('a@b.com', 'right')
        expect(mockRedis.del).toHaveBeenCalledWith('login:fail:a@b.com')
      })

      it('should record failure when user is not found (prevents user enumeration timing)', async () => {
        mockRedis.get.mockResolvedValue('0')
        mockRedis.incr.mockResolvedValue(1)
        mockPrisma.user.findFirst.mockResolvedValue(null)

        await expect(loginWithPassword('ghost@x.com', 'pass')).rejects.toThrow('No account found')
        expect(mockRedis.incr).toHaveBeenCalled()
      })
    })
  })

  // ── registerUser ───────────────────────────────────────────

  describe('registerUser', () => {
    it('should create a new user if phone not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.user.create.mockResolvedValue({ id: 'new', phone: '9876543210' })
      mockRedis.setEx.mockResolvedValue('OK')

      const result = await registerUser({
        phone: '9876543210',
        name: 'Test User',
        email: 'test@example.com',
      })
      expect(mockPrisma.user.create).toHaveBeenCalled()
      expect(result.user.id).toBe('new')
    })

    it('should update existing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', phone: '9876543210' })
      mockPrisma.user.findUnique.mockResolvedValueOnce(null) // email check
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', phone: '9876543210', name: 'Updated' })
      mockRedis.setEx.mockResolvedValue('OK')

      const result = await registerUser({
        phone: '9876543210',
        name: 'Updated',
        email: 'updated@example.com',
      })
      expect(mockPrisma.user.update).toHaveBeenCalled()
      expect(result.user.name).toBe('Updated')
    })

    it('should reject duplicate emails from other users', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'u1', phone: '9876543210' }) // phone lookup
        .mockResolvedValueOnce({ id: 'u2', email: 'taken@example.com' }) // email owner ≠ u1

      await expect(
        registerUser({ phone: '9876543210', name: 'Test', email: 'taken@example.com' })
      ).rejects.toThrow('already associated')
    })
  })

  // ── setPassword ────────────────────────────────────────────

  describe('setPassword', () => {
    it('should reject passwords shorter than 8 characters', async () => {
      await expect(setPassword('u1', 'short')).rejects.toThrow('at least 8 characters')
    })

    it('should hash and store the password', async () => {
      mockPrisma.user.update.mockResolvedValue({})
      await setPassword('u1', 'validpass123')
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: { password: expect.any(String) },
        })
      )
      // Ensure it's hashed, not plaintext
      const storedHash = mockPrisma.user.update.mock.calls[0][0].data.password
      expect(storedHash).not.toBe('validpass123')
      expect(storedHash.startsWith('$2')).toBe(true) // bcrypt hash prefix
    })
  })

  // ── logout ─────────────────────────────────────────────────

  describe('logout', () => {
    it('should invalidate refresh tokens in Redis', async () => {
      mockRedis.del.mockResolvedValue(1)
      mockPrisma.user.update.mockResolvedValue({})
      await logout('u1')
      expect(mockRedis.del).toHaveBeenCalledWith('refresh:u1')
    })

    it('should clear FCM token (N1)', async () => {
      mockRedis.del.mockResolvedValue(1)
      mockPrisma.user.update.mockResolvedValue({})
      await logout('u1')
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { fcmToken: null },
      })
    })
  })

  // ── invalidateRefreshTokens ────────────────────────────────

  describe('invalidateRefreshTokens', () => {
    it('should delete the refresh key from Redis', async () => {
      mockRedis.del.mockResolvedValue(1)
      await invalidateRefreshTokens('u1')
      expect(mockRedis.del).toHaveBeenCalledWith('refresh:u1')
    })
  })
})
