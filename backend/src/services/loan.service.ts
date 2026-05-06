import { prisma } from '@/lib/prisma'
import { AppError } from '@/middleware/error.middleware'
import axios from 'axios'
import { getRedis } from '@/lib/redis'
import { enqueueOutboxJob } from './outbox.service'
import { recordLedgerEntry } from './ledger.service'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? 'http://localhost:8000'
const ML_INTERNAL_SECRET = process.env.ML_INTERNAL_SECRET ?? 'dev-secret-key-change-in-prod'
const DEMO_MODE = process.env.DEMO_MODE === 'true'

// ─────────────────────────────────────────────────────────────
// ML SCORING HELPER
// ─────────────────────────────────────────────────────────────

async function fetchMlScore(
  memberId: string,
  shgId: string,
  amount: number,
  membership: any,
  forceRefresh = false
): Promise<{ mlScore: number; mlRiskBand: string }> {
  const redis = await getRedis()
  const cacheKey = `ml_score:${memberId}`
  const cached = !forceRefresh && redis ? await redis.get(cacheKey) : null

  if (cached) {
    const parsed = JSON.parse(cached)
    return { mlScore: parsed.score, mlRiskBand: parsed.riskBand }
  }

  const attendanceRate = membership.shg.meetings.length > 0 ? 0.85 : 0.5
  const savingsRatio = 2.5

  try {
    const scoreRes = await axios.post(
      `${ML_SERVICE_URL}/score/`,
      {
        member_id: memberId,
        shg_id: shgId,
        loan_amount: amount,
        features: {
          meeting_attendance_rate: attendanceRate,
          savings_regularity: 0.75,
          group_repayment_history: 0.9,
          loan_count: membership.shg.loans.length,
          individual_prior_repayment: 0.88,
          savings_to_loan_ratio: savingsRatio,
          tenure_months: Math.floor(
            (Date.now() - membership.joinedAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
          ),
          seasonal_factor: new Date().getMonth() < 6 ? 1.0 : 0.8,
        },
      },
      {
        headers: { 'X-Internal-Secret': ML_INTERNAL_SECRET },
        timeout: 5000, // FIX: add timeout — ML service could hang indefinitely
      }
    )
    const mlScore: number = scoreRes.data.score
    const mlRiskBand: string = scoreRes.data.risk_band

    if (redis) {
      await redis.setEx(cacheKey, 86400, JSON.stringify({ score: mlScore, riskBand: mlRiskBand }))
    }

    return { mlScore, mlRiskBand }
  } catch (err) {
    logger.warn({ err }, '⚠️  ML service unavailable, using rule-based fallback')
    if (savingsRatio > 0.5 && attendanceRate > 0.8) {
      return { mlScore: 750, mlRiskBand: 'LOW' }
    }
    return { mlScore: 650, mlRiskBand: 'MEDIUM' }
  }
}

// ─────────────────────────────────────────────────────────────
// APPLY FOR LOAN
// FIX: Uses outbox pattern — blockchain jobs written inside the
//      same Prisma transaction to guarantee atomicity.
// ─────────────────────────────────────────────────────────────

/**
 * Apply for a loan — runs ML scoring, persists application, enqueues on-chain record.
 */
export const applyLoan = async (params: {
  memberId: string
  shgId: string
  amount: string
  tenureMonths: number
  purpose?: string
}) => {
  const { memberId, shgId, amount, tenureMonths, purpose } = params

  // Verify member belongs to SHG
  const membership = await prisma.sHGMember.findUnique({
    where: { userId_shgId: { userId: memberId, shgId } },
    include: { shg: { include: { meetings: true, members: true, loans: true } }, user: true },
  })
  if (!membership) throw new AppError(403, 'NOT_SHG_MEMBER', 'User is not a member of this SHG')

  // FIX: Only call ML if not in demo mode
  let mlScore = 720
  let mlRiskBand = 'LOW'
  if (!DEMO_MODE) {
    const scores = await fetchMlScore(memberId, shgId, parseFloat(amount), membership)
    mlScore = scores.mlScore
    mlRiskBand = scores.mlRiskBand
  }

  const principal = parseFloat(amount)
  const annualRate = 0.18
  const emiAmount = (principal * annualRate) / 12 + principal / tenureMonths
  const principalPaise = Math.round(principal * 100)
  const interestRateBps = 1800

  const borrowerAddress =
    membership.user.walletAddress ?? '0x0000000000000000000000000000000000000000'

  // FIX: All operations in one transaction — DB write + outbox job together
  const loan = await prisma.$transaction(async (tx) => {
    const newLoan = await tx.loan.create({
      data: {
        memberId,
        shgId,
        amount: principal,
        interestRateBps,
        tenureMonths,
        purpose,
        mlScore,
        mlRiskBand,
        emiAmount,
        contractLoanId: null, // Populated by blockchain-writer worker
        txHash: null,
        isSyncedOnChain: false,
        nextEmiDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'PENDING',
      },
      include: { member: true, shg: true },
    })

    // Write blockchain job into outbox ATOMICALLY with the loan creation
    await enqueueOutboxJob(tx, 'create-loan', {
      dbLoanId: newLoan.id,
      borrowerAddress,
      principalPaise,
      interestRateBps,
      tenureMonths,
      shgPoolId: shgId,
    })

    // Enqueue ML score recording if user has a wallet
    if (membership.user.walletAddress) {
      await enqueueOutboxJob(tx, 'record-score', {
        memberAddress: membership.user.walletAddress,
        score: mlScore,
        riskBand: mlRiskBand,
        modelVersion: 'gramchain-ml-v1.0',
      })
    }

    return newLoan
  })

  logger.info({ loanId: loan.id }, 'Loan application created with outbox jobs')

  // Fan-out notification to all group members (except the applicant)
  try {
    const { notifyGroup } = await import('./notification.service')
    const applicantName = membership.user.name || 'A member'
    await notifyGroup(
      shgId,
      memberId,
      'LOAN_APPROVAL_REQUEST',
      'New Loan Request',
      `${applicantName} has requested a loan of ₹${Number(amount).toLocaleString('en-IN')}. Tap to review.`,
      { type: 'LOAN_APPROVAL_REQUEST', loanId: loan.id, shgId }
    )
  } catch (notifErr) {
    logger.warn({ notifErr }, 'Loan notification fan-out failed (non-fatal)')
  }

  return loan
}

// ─────────────────────────────────────────────────────────────
// APPROVE LOAN
// FIX: Handles race condition where contractLoanId may not be
//      populated yet. If null, writes outbox job anyway — the
//      blockchain-writer will look it up when processing.
// ─────────────────────────────────────────────────────────────

/**
 * Approve loan (SHG leader action) — records approval on-chain.
 */
export const approveLoan = async (loanId: string, approverId: string) => {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { shg: { include: { members: { include: { user: true } } } }, member: true },
  })
  if (!loan) throw new AppError(404, 'LOAN_NOT_FOUND', 'Loan not found')
  if (loan.status !== 'PENDING') throw new AppError(400, 'INVALID_STATUS', 'Loan is not in PENDING state')

  const approverMembership = loan.shg.members.find(
    (m: any) => m.userId === approverId && m.role === 'LEADER'
  )
  if (!approverMembership) throw new AppError(403, 'NOT_LEADER', 'Only SHG leaders can approve loans')

  const leaderAddress =
    approverMembership.user?.walletAddress ?? '0x0000000000000000000000000000000000000000'

  const updated = await prisma.$transaction(async (tx) => {
    const updatedLoan = await tx.loan.update({
      where: { id: loanId },
      data: { status: 'APPROVED' },
    })

    // FIX: Enqueue approve-loan regardless of whether contractLoanId is populated.
    // The blockchain-writer worker handles the case where it's null by waiting/retrying.
    // We pass the dbLoanId so the worker can look up contractLoanId at execution time.
    await enqueueOutboxJob(tx, 'approve-loan', {
      dbLoanId: loanId,
      contractLoanId: updatedLoan.contractLoanId, // may be null — worker handles this
      leaderAddress,
    })

    return updatedLoan
  })

  logger.info({ loanId, approverId }, 'Loan approved with outbox job')
  return updated
}

// ─────────────────────────────────────────────────────────────
// DISBURSE LOAN
// ─────────────────────────────────────────────────────────────

/**
 * Disburse loan (Backend/Admin action) — 2-phase: DB Ledger debit + outbox on-chain mark.
 */
export const disburseLoan = async (loanId: string) => {
  return await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUniqueOrThrow({
      where: { id: loanId },
    })
    if (loan.status !== 'APPROVED') throw new AppError(400, 'INVALID_STATUS', 'Loan is not APPROVED')
    if (!loan.contractLoanId) {
      throw new AppError(409, 'CHAIN_NOT_SYNCED', 'Loan is not yet registered on-chain. Please wait a moment and try again.')
    }

    const amountPaise = Math.round(Number(loan.amount) * 100)

    await recordLedgerEntry(tx, {
      entityType: 'loan',
      entityId: loanId,
      type: 'LOAN_DISBURSAL',
      amountPaise: -amountPaise,
      ref: `disbursal-${loanId}`,
    })

    const updatedLoan = await tx.loan.update({
      where: { id: loanId },
      data: { status: 'ACTIVE', disbursedAt: new Date() },
    })

    await enqueueOutboxJob(tx, 'mark-disbursed', {
      contractLoanId: loan.contractLoanId,
      ref: `disbursal-${loanId}`,
    })

    return updatedLoan
  })
}

// ─────────────────────────────────────────────────────────────
// GET LOANS
// ─────────────────────────────────────────────────────────────

/**
 * Get all loans for a user
 */
export const getUserLoans = async (userId: string) => {
  return prisma.loan.findMany({
    where: { memberId: userId },
    include: { shg: true, repayments: { orderBy: { paidAt: 'desc' }, take: 5 } },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Get single loan by ID
 */
export const getLoanById = async (loanId: string) => {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { shg: true, member: true, repayments: { orderBy: { paidAt: 'desc' } } },
  })
  if (!loan) throw new AppError(404, 'LOAN_NOT_FOUND', 'Loan not found')
  return loan
}

// ─────────────────────────────────────────────────────────────
// REPAY LOAN
// FIX: Properly increments emisPaid in DB as a mirror of chain state.
//      Also validates that repayment count hasn't exceeded tenure.
// ─────────────────────────────────────────────────────────────

/**
 * Record a repayment — marks EMI paid on-chain via outbox
 */
export const repayLoan = async (loanId: string, userId: string) => {
  return await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findUnique({ where: { id: loanId } })
    if (!loan) throw new AppError(404, 'LOAN_NOT_FOUND', 'Loan not found')
    if (loan.memberId !== userId) throw new AppError(403, 'FORBIDDEN', 'Not your loan')
    if (loan.status !== 'ACTIVE')
      throw new AppError(400, 'INVALID_STATUS', 'Loan must be ACTIVE to repay')
    if (loan.emisPaid >= loan.tenureMonths)
      throw new AppError(400, 'ALL_EMIS_PAID', 'All EMIs have already been paid for this loan')
    if (!loan.contractLoanId) {
      throw new AppError(409, 'CHAIN_NOT_SYNCED', 'Loan is not yet registered on-chain.')
    }

    const upiRef = `UPI-${loanId}-${crypto.randomUUID()}`
    const amountToRepay = loan.emiAmount ?? loan.amount
    const amountPaise = Math.round(Number(amountToRepay) * 100)
    const newEmisPaid = loan.emisPaid + 1
    const isLastEmi = newEmisPaid >= loan.tenureMonths

    await recordLedgerEntry(tx, {
      entityType: 'loan',
      entityId: loanId,
      type: 'EMI_RECEIVED',
      amountPaise: amountPaise,
      ref: upiRef,
    })

    const repayment = await tx.repayment.create({
      data: {
        loanId,
        amount: amountToRepay,
        txHash: upiRef, // UPI ref serves as unique identifier before on-chain hash
        upiRef,
      },
    })

    // FIX: Mirror the on-chain state in DB for audit and UI purposes
    await tx.loan.update({
      where: { id: loanId },
      data: {
        nextEmiDue: isLastEmi ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: isLastEmi ? 'REPAID' : 'ACTIVE',
        emisPaid: newEmisPaid,
      },
    })

    await enqueueOutboxJob(tx, 'mark-emi', {
      contractLoanId: loan.contractLoanId,
      upiRef,
    })

    logger.info({ loanId, emiNumber: newEmisPaid, isLastEmi }, 'EMI repayment recorded')
    return repayment
  })
}

// ─────────────────────────────────────────────────────────────
// M4: CREDIT SCORE ENDPOINT
// Returns the ML score (or rule-based fallback) for the mobile app
// to display before loan application.
// ─────────────────────────────────────────────────────────────

/**
 * Get credit score for a user in a specific SHG.
 * Called by mobile borrow.tsx to display score before applying.
 */
export const getCreditScore = async (
  userId: string,
  shgId: string,
  amount: number,
  forceRefresh = false
) => {
  const membership = await prisma.sHGMember.findUnique({
    where: { userId_shgId: { userId, shgId } },
    include: { shg: { include: { meetings: true, loans: true } }, user: true },
  })

  if (!membership) {
    throw new AppError(403, 'NOT_SHG_MEMBER', 'User is not a member of this SHG')
  }

  if (DEMO_MODE) {
    // In demo mode, return a realistic-looking score
    return { score: 720, riskBand: 'LOW', source: 'demo' }
  }

  const { mlScore, mlRiskBand } = await fetchMlScore(userId, shgId, amount, membership, forceRefresh)
  return { score: mlScore, riskBand: mlRiskBand, source: 'ml', cached: !forceRefresh }
}

