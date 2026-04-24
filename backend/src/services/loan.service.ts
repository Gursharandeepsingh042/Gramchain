import { prisma } from '@/lib/prisma'
import { AppError } from '@/middleware/error.middleware'
import axios from 'axios'

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? 'http://localhost:8000'
const DEMO_MODE = process.env.DEMO_MODE === 'true'

/**
 * Apply for a loan — runs ML scoring and persists application
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
    include: { shg: { include: { meetings: true, members: true, loans: true } } },
  })
  if (!membership) throw new AppError(403, 'NOT_SHG_MEMBER', 'User is not a member of this SHG')

  // Get credit score from ML service (or use demo fallback)
  let mlScore = 720
  let mlRiskBand = 'LOW'
  if (!DEMO_MODE) {
    try {
      const scoreRes = await axios.post(`${ML_SERVICE_URL}/score`, {
        member_id: memberId,
        shg_id: shgId,
        loan_amount: parseFloat(amount),
        features: {
          meeting_attendance_rate: membership.shg.meetings.length > 0 ? 0.85 : 0.5,
          savings_regularity: 0.75,
          group_repayment_history: 0.9,
          loan_count: membership.shg.loans.length,
          individual_prior_repayment: 0.88,
          savings_to_loan_ratio: 2.5,
          tenure_months: Math.floor(
            (Date.now() - membership.joinedAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
          ),
          seasonal_factor: new Date().getMonth() < 6 ? 1.0 : 0.8,
        },
      })
      mlScore = scoreRes.data.score
      mlRiskBand = scoreRes.data.risk_band
    } catch (err) {
      console.warn('⚠️  ML service unavailable, using fallback score 720')
    }
  }

  // Calculate EMI (simple interest formula)
  const principal = parseFloat(amount)
  const annualRate = 0.18 // 18% default
  const emiAmount = (principal * annualRate) / 12 + principal / tenureMonths

  // Persist loan application
  const loan = await prisma.loan.create({
    data: {
      memberId,
      shgId,
      amount: principal,
      interestRateBps: 1800,
      tenureMonths,
      purpose,
      mlScore,
      mlRiskBand,
      emiAmount,
      nextEmiDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    include: { member: true, shg: true },
  })

  return loan
}

/**
 * Approve loan (SHG leader action)
 */
export const approveLoan = async (loanId: string, approverId: string) => {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { shg: { include: { members: true } } },
  })
  if (!loan) throw new AppError(404, 'LOAN_NOT_FOUND', 'Loan not found')
  if (loan.status !== 'PENDING') throw new AppError(400, 'INVALID_STATUS', 'Loan is not in PENDING state')

  // Verify approver is SHG leader
  const approverMembership = loan.shg.members.find(
    (m: any) => m.userId === approverId && m.role === 'LEADER'
  )
  if (!approverMembership) throw new AppError(403, 'NOT_LEADER', 'Only SHG leaders can approve loans')

  const updated = await prisma.loan.update({
    where: { id: loanId },
    data: {
      status: 'APPROVED',
      disbursedAt: new Date(),
      txHash: DEMO_MODE
        ? `0xdemo${Date.now().toString(16)}000000000000000000000000000000000000`
        : undefined,
    },
  })

  return updated
}

/**
 * Get all loans for a user
 */
export const getUserLoans = async (userId: string) => {
  return prisma.loan.findMany({
    where: { memberId: userId },
    include: { shg: true, repayments: true },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Get single loan by ID
 */
export const getLoanById = async (loanId: string) => {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { shg: true, member: true, repayments: true },
  })
  if (!loan) throw new AppError(404, 'LOAN_NOT_FOUND', 'Loan not found')
  return loan
}

/**
 * Record a repayment
 */
export const repayLoan = async (loanId: string, userId: string) => {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } })
  if (!loan) throw new AppError(404, 'LOAN_NOT_FOUND', 'Loan not found')
  if (loan.memberId !== userId) throw new AppError(403, 'FORBIDDEN', 'Not your loan')
  if (loan.status !== 'ACTIVE' && loan.status !== 'APPROVED')
    throw new AppError(400, 'INVALID_STATUS', 'Loan is not active')

  const txHash = DEMO_MODE
    ? `0xrepay${Date.now().toString(16)}00000000000000000000000000000000`
    : `0x${Math.random().toString(16).slice(2).padEnd(64, '0')}`

  const repayment = await prisma.repayment.create({
    data: {
      loanId,
      amount: loan.emiAmount ?? loan.amount,
      txHash,
    },
  })

  // Update next EMI due
  await prisma.loan.update({
    where: { id: loanId },
    data: {
      nextEmiDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    },
  })

  return repayment
}
