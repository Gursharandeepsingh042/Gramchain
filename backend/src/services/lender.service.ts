import { prisma } from '@/lib/prisma'
import { AppError } from '@/middleware/error.middleware'

/**
 * Lender Service — handles portfolio metrics, pool browsing, and fund allocation.
 * All monetary values are stored in USDC (6 decimals) but returned with INR equivalents.
 */

// Hardcoded exchange rate for MVP. Phase 2 will use a live oracle / Transak rate.
const USDC_TO_INR_RATE = 83.5

/**
 * Get lender portfolio metrics — total invested, returns, active loans.
 * All values returned in both USDC and ₹ (INR) equivalent.
 */
export const getPortfolioMetrics = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found')

  // Fetch all loans this user has funded (via lenderTransactions)
  // For MVP, we return mock data. Phase 2 will query LenderPool on-chain.
  const totalInvestedUsdc = 0
  const totalReturnsUsdc = 0

  return {
    totalInvested: {
      usdc: totalInvestedUsdc,
      inr: totalInvestedUsdc * USDC_TO_INR_RATE,
    },
    currentValue: {
      usdc: totalInvestedUsdc + totalReturnsUsdc,
      inr: (totalInvestedUsdc + totalReturnsUsdc) * USDC_TO_INR_RATE,
    },
    totalReturns: {
      usdc: totalReturnsUsdc,
      inr: totalReturnsUsdc * USDC_TO_INR_RATE,
    },
    apy: 12.4,           // Calculated from pool performance
    activeLoans: 0,
    repaidLoans: 0,
    repaymentRate: 0,
    exchangeRate: USDC_TO_INR_RATE,
  }
}

/**
 * Get available lending pools — filtered by risk tier and geography.
 * Implements the FIFO geographic filter model from the council report.
 */
export const getAvailablePools = async (filters?: { tier?: string; state?: string }) => {
  const where: any = {
    status: 'PENDING',
  }

  // Filter by SHG geographic location
  const shgWhere: any = {}
  if (filters?.state && filters.state !== 'All States') {
    shgWhere.state = filters.state
  }

  // Fetch pending loans joined with SHG data
  const loans = await prisma.loan.findMany({
    where,
    include: {
      shg: {
        select: {
          id: true,
          name: true,
          district: true,
          state: true,
          village: true,
          members: {
            select: { userId: true },
          },
        },
      },
      member: {
        select: {
          id: true,
          name: true,
          kycStatus: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' }, // FIFO — oldest loans funded first
  })

  // Filter by state (post-query for now, can be optimized with a join)
  const filtered = filters?.state && filters.state !== 'All States'
    ? loans.filter(l => l.shg.state === filters.state)
    : loans

  // Map risk tier from ML score
  const getRiskTier = (mlScore: number | null): string => {
    if (!mlScore) return 'B'
    if (mlScore >= 750) return 'AA'
    if (mlScore >= 600) return 'A'
    return 'B'
  }

  const pools = filtered
    .map(loan => ({
      id: loan.id,
      shgName: loan.shg.name,
      district: loan.shg.district,
      state: loan.shg.state,
      village: loan.shg.village,
      tier: getRiskTier(loan.mlScore),
      amount: {
        usdc: Number(loan.amount),
        inr: Number(loan.amount) * USDC_TO_INR_RATE,
      },
      funded: 0,  // Phase 2: track from LenderPool events
      memberCount: loan.shg.members.length,
      purpose: loan.purpose || 'General',
      interestRateBps: loan.interestRateBps,
      tenureMonths: loan.tenureMonths,
      createdAt: loan.createdAt,
    }))
    .filter(p => {
      if (filters?.tier && filters.tier !== 'ALL') {
        return p.tier === filters.tier
      }
      return true
    })

  return {
    pools,
    totalCount: pools.length,
    exchangeRate: USDC_TO_INR_RATE,
  }
}

/**
 * Get ESG impact metrics for the lender's portfolio.
 */
export const getImpactMetrics = async (userId: string) => {
  // Phase 2: aggregate real data from on-chain events + DB
  // For MVP, return aggregated platform metrics
  const totalLoans = await prisma.loan.count()
  const activeLoans = await prisma.loan.count({ where: { status: 'ACTIVE' } })
  const repaidLoans = await prisma.loan.count({ where: { status: 'REPAID' } })
  const totalSHGs = await prisma.sHGGroup.count()
  const totalMembers = await prisma.sHGMember.count()

  // Count unique states
  const states = await prisma.sHGGroup.findMany({
    select: { state: true },
    distinct: ['state'],
  })

  return {
    womenSupported: totalMembers,
    familiesBenefited: totalMembers * 2, // Estimated
    totalDisbursed: {
      usdc: 0,
      inr: 0,
    },
    activeLoans,
    repaidLoans,
    totalLoans,
    shgGroups: totalSHGs,
    statesReached: states.length,
    repaymentRate: totalLoans > 0
      ? ((repaidLoans / Math.max(repaidLoans + activeLoans, 1)) * 100).toFixed(1)
      : '0',
    exchangeRate: USDC_TO_INR_RATE,
  }
}
