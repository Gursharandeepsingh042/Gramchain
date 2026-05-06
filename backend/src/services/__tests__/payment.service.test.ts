/**
 * Unit tests for payment.service.ts — P1
 *
 * Strategy: Mock Prisma, secrets lib, and axios so tests
 * run fully offline without Razorpay credentials.
 */

process.env.DEMO_MODE = 'true'
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars'

// ── Mocks ──────────────────────────────────────────────────

const mockPrisma = {
  paymentOrder: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
}
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const mockGetSecret = jest.fn()
jest.mock('@/lib/secrets', () => ({
  getSecret: (...args: unknown[]) => mockGetSecret(...args),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('axios')

// ── Imports ─────────────────────────────────────────────────

import {
  createOrder,
  verifyPayment,
  verifyWebhookSignature,
  handleWebhookEvent,
} from '../payment.service'
import crypto from 'crypto'

// ── Helpers ─────────────────────────────────────────────────

const resetMocks = () => {
  jest.clearAllMocks()
  mockPrisma.paymentOrder.create.mockResolvedValue({})
  mockPrisma.paymentOrder.update.mockResolvedValue({})
}

// ═══════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════

describe('Payment Service', () => {
  beforeEach(resetMocks)

  // ── createOrder ─────────────────────────────────────────

  describe('createOrder', () => {
    it('should return demo order in DEMO_MODE', async () => {
      const result = await createOrder({
        amountPaise: 50000,
        purpose: 'loan-emi',
        refType: 'loan',
        refId: 'loan-1',
        userId: 'user-1',
      })
      expect(result.orderId).toMatch(/order_demo_/)
      expect(result.amountPaise).toBe(50000)
      expect(result.currency).toBe('INR')
      expect(result.keyId).toBe('rzp_test_DEMO')
      expect(mockPrisma.paymentOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amountPaise: 50000,
            purpose: 'loan-emi',
            userId: 'user-1',
          }),
        }),
      )
    })

    it('should reject zero amount', async () => {
      await expect(
        createOrder({ amountPaise: 0, purpose: 'loan-emi', refType: 'loan', refId: 'l1', userId: 'u1' }),
      ).rejects.toThrow('amount must be > 0')
    })

    it('should reject negative amount', async () => {
      await expect(
        createOrder({ amountPaise: -100, purpose: 'loan-emi', refType: 'loan', refId: 'l1', userId: 'u1' }),
      ).rejects.toThrow('amount must be > 0')
    })
  })

  // ── verifyPayment (DEMO_MODE) ────────────────────────────

  describe('verifyPayment', () => {
    it('should return true in DEMO_MODE without checking signature', async () => {
      const result = await verifyPayment({
        orderId: 'order_demo_123',
        paymentId: 'pay_demo_456',
        signature: 'anything',
      })
      expect(result).toBe(true)
      expect(mockPrisma.paymentOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { razorpayOrderId: 'order_demo_123' },
          data: expect.objectContaining({ status: 'CAPTURED' }),
        }),
      )
    })
  })

  // ── verifyWebhookSignature ───────────────────────────────

  describe('verifyWebhookSignature', () => {
    const secret = 'test-webhook-secret-32chars-longg'

    beforeEach(() => {
      mockGetSecret.mockResolvedValue(secret)
    })

    it('should return true for a valid signature', async () => {
      const body = JSON.stringify({ event: 'payment.captured' })
      const sig = crypto.createHmac('sha256', secret).update(body).digest('hex')

      const result = await verifyWebhookSignature(body, sig)
      expect(result).toBe(true)
    })

    it('should return false for a tampered body', async () => {
      const body    = JSON.stringify({ event: 'payment.captured' })
      const badBody = JSON.stringify({ event: 'payment.captured', injected: true })
      const sig = crypto.createHmac('sha256', secret).update(body).digest('hex')

      const result = await verifyWebhookSignature(badBody, sig)
      expect(result).toBe(false)
    })

    it('should return false when webhook secret is not configured', async () => {
      mockGetSecret.mockResolvedValue(undefined)
      const result = await verifyWebhookSignature('{}', 'sig')
      expect(result).toBe(false)
    })
  })

  // ── handleWebhookEvent ───────────────────────────────────

  describe('handleWebhookEvent', () => {
    it('should mark order as CAPTURED on payment.captured', async () => {
      await handleWebhookEvent({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: { id: 'pay_abc', order_id: 'order_xyz', status: 'captured' },
          },
        },
      })
      expect(mockPrisma.paymentOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { razorpayOrderId: 'order_xyz' },
          data:  expect.objectContaining({ status: 'CAPTURED' }),
        }),
      )
    })

    it('should mark order as FAILED on payment.failed', async () => {
      await handleWebhookEvent({
        event: 'payment.failed',
        payload: {
          payment: {
            entity: { id: 'pay_abc', order_id: 'order_xyz', status: 'failed' },
          },
        },
      })
      expect(mockPrisma.paymentOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { razorpayOrderId: 'order_xyz' },
          data:  expect.objectContaining({ status: 'FAILED' }),
        }),
      )
    })

    it('should be a no-op for unknown events', async () => {
      await handleWebhookEvent({
        event: 'refund.created',
        payload: {},
      })
      expect(mockPrisma.paymentOrder.update).not.toHaveBeenCalled()
    })
  })
})
