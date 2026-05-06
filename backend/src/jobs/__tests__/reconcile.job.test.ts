/**
 * Unit tests for reconcile.job.ts — B6
 *
 * Strategy: mock Prisma + the on-chain getter so we deterministically
 * exercise every drift-detection branch.
 */

process.env.DEMO_MODE = 'false'

// ── Mocks ──────────────────────────────────────────────────

const mockPrisma = {
  loan:       { findMany: jest.fn() },
  driftAlert: {
    findFirst: jest.fn(),
    create:    jest.fn(),
  },
}
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const mockGetLoanFromChain = jest.fn()
jest.mock('@/services/blockchain.service', () => ({
  getLoanFromChain: (...a: unknown[]) => mockGetLoanFromChain(...a),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

// node-cron must be mocked because the module top-levels a schedule call.
jest.mock('node-cron', () => ({ schedule: jest.fn() }))

// ── Imports (after mocks) ──────────────────────────────────

import { runReconcile } from '../reconcile.job'

// ── Helpers ─────────────────────────────────────────────────

const makeLoan = (overrides: Partial<any> = {}) => ({
  id:              'loan-1',
  contractLoanId:  101,
  status:          'ACTIVE',
  emisPaid:        2,
  isSyncedOnChain: true,
  ...overrides,
})

const makeChainLoan = (overrides: Partial<any> = {}) => ({
  borrower:        '0xabc',
  shgPoolId:       'pool',
  principalPaise:  100000,
  interestRateBps: 1500,
  emiAmountPaise:  20000,
  tenureMonths:    6,
  disbursedAt:     0,
  nextEmiDueAt:    0,
  emisPaid:        2,
  status:          2,           // ACTIVE
  disbursalTxRef:  '0x',
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockPrisma.driftAlert.findFirst.mockResolvedValue(null)
  mockPrisma.driftAlert.create.mockResolvedValue({})
})

// ═══════════════════════════════════════════════════════════
describe('runReconcile()', () => {
  // ── Happy path ──────────────────────────────────────────
  it('records no drift when DB and chain match', async () => {
    mockPrisma.loan.findMany.mockResolvedValue([makeLoan()])
    mockGetLoanFromChain.mockResolvedValue(makeChainLoan())

    const result = await runReconcile()

    expect(result).toEqual({ scanned: 1, drift: 0 })
    expect(mockPrisma.driftAlert.create).not.toHaveBeenCalled()
  })

  // ── Status drift ────────────────────────────────────────
  it('flags HIGH severity when loan status diverges', async () => {
    mockPrisma.loan.findMany.mockResolvedValue([makeLoan({ status: 'APPROVED' })])
    // chain says ACTIVE (2), DB says APPROVED (1) → drift
    mockGetLoanFromChain.mockResolvedValue(makeChainLoan({ status: 2 }))

    const result = await runReconcile()

    expect(result.drift).toBe(1)
    expect(mockPrisma.driftAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          loanId:     'loan-1',
          field:      'status',
          dbValue:    'APPROVED',
          chainValue: '2',
          severity:   'HIGH',
        }),
      }),
    )
  })

  // ── EMI count drift ─────────────────────────────────────
  it('flags MEDIUM severity for 1-EMI drift, HIGH for >1', async () => {
    mockPrisma.loan.findMany.mockResolvedValue([
      makeLoan({ id: 'small-drift', emisPaid: 2 }),
      makeLoan({ id: 'big-drift',   emisPaid: 5 }),
    ])
    // chain says 3 vs 2 (small) and 1 vs 5 (big)
    mockGetLoanFromChain
      .mockResolvedValueOnce(makeChainLoan({ emisPaid: 3 }))
      .mockResolvedValueOnce(makeChainLoan({ emisPaid: 1 }))

    const result = await runReconcile()

    expect(result.drift).toBe(2)

    const calls = mockPrisma.driftAlert.create.mock.calls.map(c => c[0].data)
    expect(calls).toContainEqual(
      expect.objectContaining({ loanId: 'small-drift', severity: 'MEDIUM' }),
    )
    expect(calls).toContainEqual(
      expect.objectContaining({ loanId: 'big-drift',   severity: 'HIGH' }),
    )
  })

  // ── Loan missing on chain ───────────────────────────────
  it('flags CRITICAL when loan is not found on-chain', async () => {
    mockPrisma.loan.findMany.mockResolvedValue([makeLoan()])
    mockGetLoanFromChain.mockResolvedValue(null)

    const result = await runReconcile()

    expect(result.drift).toBe(1)
    expect(mockPrisma.driftAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          field:    'existence',
          severity: 'CRITICAL',
        }),
      }),
    )
  })

  // ── Idempotency: don't spam open alerts ─────────────────
  it('skips creating a duplicate drift when an open alert exists', async () => {
    mockPrisma.loan.findMany.mockResolvedValue([makeLoan({ status: 'APPROVED' })])
    mockGetLoanFromChain.mockResolvedValue(makeChainLoan({ status: 2 }))
    mockPrisma.driftAlert.findFirst.mockResolvedValue({ id: 'open-alert-1' })

    await runReconcile()

    expect(mockPrisma.driftAlert.create).not.toHaveBeenCalled()
  })

  // ── Skip un-synced loans ─────────────────────────────────
  it('skips loans without contractLoanId', async () => {
    mockPrisma.loan.findMany.mockResolvedValue([
      makeLoan({ contractLoanId: null, isSyncedOnChain: false }),
    ])

    const result = await runReconcile()

    expect(result).toEqual({ scanned: 1, drift: 0 })
    expect(mockGetLoanFromChain).not.toHaveBeenCalled()
  })

  // ── Resilience: per-loan errors don't break the batch ──
  it('continues scanning when a single loan throws', async () => {
    mockPrisma.loan.findMany.mockResolvedValue([
      makeLoan({ id: 'broken' }),
      makeLoan({ id: 'good' }),
    ])
    mockGetLoanFromChain
      .mockRejectedValueOnce(new Error('RPC timeout'))
      .mockResolvedValueOnce(makeChainLoan())

    const result = await runReconcile()

    expect(result.scanned).toBe(2)
    expect(result.drift).toBe(0) // good loan matches; broken one logged
  })
})
