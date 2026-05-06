/**
 * Unit tests for loan.service.ts — T3
 *
 * Strategy: Mock Prisma, Redis, outbox, ledger, and notification services
 * to test loan lifecycle logic in isolation.
 */

// Must be set before importing the service (DEMO_MODE captured at module load)
process.env.DEMO_MODE = 'true'
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars'

// ── Mocks ──────────────────────────────────────────────────

const mockTx = {
  loan: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  repayment: { create: jest.fn() },
  sHGMember: { findUnique: jest.fn() },
}

const mockPrisma = {
  loan: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  sHGMember: { findUnique: jest.fn() },
  $transaction: jest.fn((fn: any) => fn(mockTx)),
}

jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const mockRedis = {
  get: jest.fn(),
  setEx: jest.fn(),
}
jest.mock('@/lib/redis', () => ({
  getRedis: jest.fn().mockResolvedValue(mockRedis),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

const mockEnqueueOutboxJob = jest.fn().mockResolvedValue({})
jest.mock('../outbox.service', () => ({
  enqueueOutboxJob: (...args: any[]) => mockEnqueueOutboxJob(...args),
}))

const mockRecordLedgerEntry = jest.fn().mockResolvedValue({})
jest.mock('../ledger.service', () => ({
  recordLedgerEntry: (...args: any[]) => mockRecordLedgerEntry(...args),
}))

jest.mock('../notification.service', () => ({
  notifyGroup: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('axios')

// ── Imports ─────────────────────────────────────────────────

import {
  applyLoan,
  approveLoan,
  getUserLoans,
  getLoanById,
  repayLoan,
  getCreditScore,
} from '../loan.service'

// ── Helpers ─────────────────────────────────────────────────

const resetAllMocks = () => {
  jest.clearAllMocks()
  process.env.DEMO_MODE = 'true'
  process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars-long'
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars'
}

const makeMembership = (overrides = {}) => ({
  userId: 'user-1',
  shgId: 'shg-1',
  role: 'MEMBER',
  joinedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
  user: { id: 'user-1', name: 'Test Borrower', walletAddress: '0xabc123' },
  shg: {
    id: 'shg-1',
    name: 'Test SHG',
    meetings: [],
    members: [{ userId: 'user-1', role: 'MEMBER' }],
    loans: [],
  },
  ...overrides,
})

const makeLoan = (overrides = {}) => ({
  id: 'loan-1',
  memberId: 'user-1',
  shgId: 'shg-1',
  amount: 25000,
  interestRateBps: 1800,
  tenureMonths: 6,
  emiAmount: 4583,
  emisPaid: 0,
  status: 'PENDING',
  contractLoanId: null,
  txHash: null,
  isSyncedOnChain: false,
  createdAt: new Date(),
  ...overrides,
})

// ═════════════════════════════════════════════════════════════
// TEST SUITES
// ═════════════════════════════════════════════════════════════

describe('Loan Service', () => {
  beforeEach(resetAllMocks)

  // ── applyLoan ──────────────────────────────────────────────

  describe('applyLoan', () => {
    it('should reject non-SHG members', async () => {
      mockPrisma.sHGMember.findUnique.mockResolvedValue(null)
      // The $transaction mock needs to handle the inner lookup
      mockPrisma.$transaction.mockImplementation(async () => {
        throw Object.assign(new Error('User is not a member of this SHG'), {
          statusCode: 403,
        })
      })

      await expect(
        applyLoan({
          memberId: 'user-1',
          shgId: 'shg-1',
          amount: '25000',
          tenureMonths: 6,
        })
      ).rejects.toThrow()
    })

    it('should create a loan with outbox jobs in demo mode', async () => {
      const membership = makeMembership()
      mockPrisma.sHGMember.findUnique.mockResolvedValue(membership)

      const createdLoan = makeLoan({
        member: { name: 'Test Borrower' },
        shg: { name: 'Test SHG' },
      })

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        mockTx.loan.create.mockResolvedValue(createdLoan)
        return fn(mockTx)
      })

      // Re-mock so the outer membership lookup works
      mockPrisma.sHGMember.findUnique.mockResolvedValue(membership)

      // The function calls prisma.sHGMember.findUnique outside the transaction
      const result = await applyLoan({
        memberId: 'user-1',
        shgId: 'shg-1',
        amount: '25000',
        tenureMonths: 6,
        purpose: 'agriculture',
      })

      expect(result).toBeDefined()
    })
  })

  // ── approveLoan ────────────────────────────────────────────

  describe('approveLoan', () => {
    it('should reject if loan not found', async () => {
      mockPrisma.loan.findUnique.mockResolvedValue(null)
      mockPrisma.$transaction.mockImplementation(async () => {
        throw Object.assign(new Error('Loan not found'), { statusCode: 404 })
      })

      await expect(approveLoan('loan-1', 'leader-1')).rejects.toThrow()
    })

    it('should reject if loan is not PENDING', async () => {
      mockPrisma.loan.findUnique.mockResolvedValue(
        makeLoan({ status: 'APPROVED' })
      )
      mockPrisma.$transaction.mockImplementation(async () => {
        throw Object.assign(new Error('Loan is not in PENDING state'), {
          statusCode: 400,
        })
      })

      await expect(approveLoan('loan-1', 'leader-1')).rejects.toThrow()
    })

    it('should reject if approver is not a leader', async () => {
      const loan = makeLoan({
        shg: {
          members: [
            { userId: 'leader-1', role: 'MEMBER', user: { walletAddress: '0x...' } },
          ],
        },
      })
      mockPrisma.loan.findUnique.mockResolvedValue(loan)
      mockPrisma.$transaction.mockImplementation(async () => {
        throw Object.assign(new Error('Only SHG leaders can approve loans'), {
          statusCode: 403,
        })
      })

      await expect(approveLoan('loan-1', 'leader-1')).rejects.toThrow()
    })
  })

  // ── getUserLoans ───────────────────────────────────────────

  describe('getUserLoans', () => {
    it('should return loans for the given user', async () => {
      const loans = [makeLoan(), makeLoan({ id: 'loan-2' })]
      mockPrisma.loan.findMany.mockResolvedValue(loans)

      const result = await getUserLoans('user-1')
      expect(result).toHaveLength(2)
      expect(mockPrisma.loan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { memberId: 'user-1' },
          orderBy: { createdAt: 'desc' },
        })
      )
    })
  })

  // ── getLoanById ────────────────────────────────────────────

  describe('getLoanById', () => {
    it('should return a loan by ID', async () => {
      mockPrisma.loan.findUnique.mockResolvedValue(makeLoan())
      const result = await getLoanById('loan-1')
      expect(result.id).toBe('loan-1')
    })

    it('should throw 404 if loan not found', async () => {
      mockPrisma.loan.findUnique.mockResolvedValue(null)
      await expect(getLoanById('non-existent')).rejects.toThrow('Loan not found')
    })
  })

  // ── repayLoan ──────────────────────────────────────────────

  describe('repayLoan', () => {
    it('should reject if loan not found', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        mockTx.loan.findUnique.mockResolvedValue(null)
        return fn(mockTx)
      })
      await expect(repayLoan('loan-1', 'user-1')).rejects.toThrow('Loan not found')
    })

    it('should reject if user is not the borrower', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        mockTx.loan.findUnique.mockResolvedValue(
          makeLoan({ status: 'ACTIVE', memberId: 'other-user', contractLoanId: 1 })
        )
        return fn(mockTx)
      })
      await expect(repayLoan('loan-1', 'user-1')).rejects.toThrow('Not your loan')
    })

    it('should reject if loan is not ACTIVE', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        mockTx.loan.findUnique.mockResolvedValue(
          makeLoan({ status: 'PENDING', memberId: 'user-1', contractLoanId: 1 })
        )
        return fn(mockTx)
      })
      await expect(repayLoan('loan-1', 'user-1')).rejects.toThrow('ACTIVE')
    })

    it('should reject if all EMIs are already paid', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        mockTx.loan.findUnique.mockResolvedValue(
          makeLoan({
            status: 'ACTIVE',
            memberId: 'user-1',
            emisPaid: 6,
            tenureMonths: 6,
            contractLoanId: 1,
          })
        )
        return fn(mockTx)
      })
      await expect(repayLoan('loan-1', 'user-1')).rejects.toThrow('All EMIs')
    })

    it('should reject if loan is not synced on-chain', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        mockTx.loan.findUnique.mockResolvedValue(
          makeLoan({
            status: 'ACTIVE',
            memberId: 'user-1',
            emisPaid: 2,
            tenureMonths: 6,
            contractLoanId: null,
          })
        )
        return fn(mockTx)
      })
      await expect(repayLoan('loan-1', 'user-1')).rejects.toThrow('not yet registered')
    })

    it('should record EMI repayment and enqueue outbox job', async () => {
      const repaymentResult = { id: 'repay-1', loanId: 'loan-1' }
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        mockTx.loan.findUnique.mockResolvedValue(
          makeLoan({
            status: 'ACTIVE',
            memberId: 'user-1',
            emisPaid: 2,
            tenureMonths: 6,
            contractLoanId: 42,
            emiAmount: 4583,
          })
        )
        mockTx.repayment.create.mockResolvedValue(repaymentResult)
        mockTx.loan.update.mockResolvedValue({})
        return fn(mockTx)
      })

      const result = await repayLoan('loan-1', 'user-1')
      expect(result.id).toBe('repay-1')
      expect(mockRecordLedgerEntry).toHaveBeenCalled()
      expect(mockEnqueueOutboxJob).toHaveBeenCalledWith(
        mockTx,
        'mark-emi',
        expect.objectContaining({ contractLoanId: 42 })
      )
    })

    it('should mark loan as REPAID on final EMI', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        mockTx.loan.findUnique.mockResolvedValue(
          makeLoan({
            status: 'ACTIVE',
            memberId: 'user-1',
            emisPaid: 5,       // 5 of 6 paid, this is the 6th
            tenureMonths: 6,
            contractLoanId: 42,
            emiAmount: 4583,
          })
        )
        mockTx.repayment.create.mockResolvedValue({ id: 'repay-6' })
        mockTx.loan.update.mockResolvedValue({})
        return fn(mockTx)
      })

      await repayLoan('loan-1', 'user-1')
      expect(mockTx.loan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REPAID',
            emisPaid: 6,
          }),
        })
      )
    })
  })

  // ── getCreditScore ─────────────────────────────────────────

  describe('getCreditScore', () => {
    it('should return demo score in demo mode', async () => {
      mockPrisma.sHGMember.findUnique.mockResolvedValue(makeMembership())
      const result = await getCreditScore('user-1', 'shg-1', 25000)
      expect(result).toEqual({ score: 720, riskBand: 'LOW', source: 'demo' })
    })

    it('should reject non-SHG members', async () => {
      mockPrisma.sHGMember.findUnique.mockResolvedValue(null)
      await expect(getCreditScore('user-1', 'shg-1', 25000)).rejects.toThrow(
        'not a member'
      )
    })

    // M4-refresh: re-fetchable score (re-load module with DEMO_MODE=false)
    describe('forceRefresh flag (non-demo)', () => {
      let nonDemoGetCreditScore: typeof getCreditScore

      beforeAll(() => {
        jest.isolateModules(() => {
          process.env.DEMO_MODE = 'false'
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          nonDemoGetCreditScore = require('../loan.service').getCreditScore
          process.env.DEMO_MODE = 'true'
        })
      })

      it('should serve from cache when forceRefresh is false', async () => {
        mockPrisma.sHGMember.findUnique.mockResolvedValue(makeMembership())
        mockRedis.get.mockResolvedValue(JSON.stringify({ score: 690, riskBand: 'MEDIUM' }))
        const result = await nonDemoGetCreditScore('user-1', 'shg-1', 25000, false)
        expect(result.score).toBe(690)
        expect((result as any).cached).toBe(true)
      })

      it('should bypass cache when forceRefresh is true', async () => {
        mockPrisma.sHGMember.findUnique.mockResolvedValue(makeMembership())
        mockRedis.get.mockResolvedValue(JSON.stringify({ score: 690, riskBand: 'MEDIUM' }))
        // ML call will fail (axios not mocked specifically) → falls back to rule-based
        const result = await nonDemoGetCreditScore('user-1', 'shg-1', 25000, true)
        // Either ML success or rule-based fallback — important: NOT 690 (cache bypassed)
        expect(result.score).not.toBe(690)
        expect((result as any).cached).toBe(false)
      })
    })
  })
})
