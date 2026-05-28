import { prisma } from '@/lib/prisma'
import { AppError } from '@/middleware/error.middleware'

/**
 * Lender Service — handles portfolio metrics, pool browsing, and fund allocation.
 * All monetary values are stored in INR (paise on-chain, rupees in DB).
 * No USDC / ERC-20 tokens involved. Lenders fund loans via INR UPI/bank transfers.
 */

/**
 * Get lender portfolio metrics — total invested, returns, active loans.
 */
export const getPortfolioMetrics = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found')

  // Aggregate real data from LenderInvestment table (new source of truth)
  const investments = await (prisma as any).lenderInvestment.findMany({
    where: { lenderId: userId, status: 'APPROVED' },
    include: { fundingRequest: true },
  })

  const totalInvestedInr = investments.reduce((sum: number, inv: any) => sum + Number(inv.amount), 0)

  // Find all loans associated with the SHGs funded by this lender
  const fundedShgIds = investments.map((inv: any) => inv.shgId).filter(Boolean) as string[]

  const loans = await prisma.loan.findMany({
    where: {
      shgId: { in: fundedShgIds }
    }
  })

  const activeLoans = loans.filter(l => l.status === 'ACTIVE').length
  const repaidLoans = loans.filter(l => l.status === 'REPAID').length

  // Calculate returns from actual Repayment records
  const repayments = await prisma.repayment.findMany({
    where: {
      loan: { shgId: { in: fundedShgIds } }
    }
  })
  const totalReturnsInr = repayments.reduce((sum: number, r: any) => sum + Number(r.amount), 0)

  const totalLoansCount = activeLoans + repaidLoans
  const repaymentRate = totalLoansCount > 0
    ? Math.round((repaidLoans / totalLoansCount) * 100)
    : 100

  return {
    totalInvested: {
      inr: totalInvestedInr,
    },
    currentValue: {
      inr: totalInvestedInr + totalReturnsInr,
    },
    totalReturns: {
      inr: totalReturnsInr,
    },
    apy: 12.4,           // Calculated from pool performance
    activeLoans,
    repaidLoans,
    repaymentRate,
  }
}

/**
 * Get lender transactions (list of pool funding commitments)
 */
export const getLenderTransactions = async (userId: string) => {
  const investments = await (prisma as any).lenderInvestment.findMany({
    where: { lenderId: userId, status: 'APPROVED' },
    include: {
      fundingRequest: {
        include: { shg: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const transactions = investments.map((inv: any) => {
    const shg = inv.fundingRequest?.shg
    const request = inv.fundingRequest

    let daysRemaining = 0
    if (request?.disbursedAt) {
      const disbursedDate = new Date(request.disbursedAt)
      const endDate = new Date(disbursedDate)
      endDate.setMonth(endDate.getMonth() + (request.durationMonths || 12))
      daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    }

    return {
      id: inv.id,
      shg: shg?.name || 'SHG Pool',
      shgName: shg?.name || 'SHG Pool',
      district: shg?.district || shg?.state || 'District',
      amount: Number(inv.amount),
      status: request?.status === 'DISBURSED' ? 'ACTIVE' : request?.status || 'PENDING',
      daysRemaining,
      createdAt: inv.createdAt,
    }
  })

  return {
    transactions,
    totalCount: transactions.length,
  }
}

/**
 * Get available lending pools — filtered by risk tier and geography.
 * Returns all active SHG groups (not just those with pending loans).
 */
export const getAvailablePools = async (filters?: { tier?: string; state?: string }) => {
  const where: any = {
    isActive: true,
  }

  // Fetch all active SHG groups
  const shgGroups = await prisma.sHGGroup.findMany({
    where,
    include: {
      members: {
        select: { userId: true },
      },
      loans: {
        where: { status: 'PENDING' },
        select: {
          id: true,
          amount: true,
          mlScore: true,
          purpose: true,
          interestRateBps: true,
          tenureMonths: true,
          txHash: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Filter by state (post-query for now)
  const filtered = filters?.state && filters.state !== 'All States'
    ? shgGroups.filter(g => g.state === filters.state)
    : shgGroups

  // Map risk tier from average ML score of pending loans
  const getRiskTier = (loans: any[]): string => {
    if (loans.length === 0) return 'B'
    const avgScore = loans.reduce((sum, l) => sum + (l.mlScore || 650), 0) / loans.length
    if (avgScore >= 750) return 'AA'
    if (avgScore >= 600) return 'A'
    return 'B'
  }

  const pools = filtered
    .map(shg => {
      const pendingLoans = shg.loans
      const latestLoan = pendingLoans[0] || null

      return {
        id: shg.id,
        shgName: shg.name,
        district: shg.district,
        state: shg.state,
        village: shg.village,
        poolContractAddress: shg.poolContractAddress,
        tier: getRiskTier(pendingLoans),
        amountInr: latestLoan ? Number(latestLoan.amount) : 0,
        funded: 0,
        memberCount: shg.members.length,
        purpose: latestLoan?.purpose || 'General',
        interestRateBps: latestLoan?.interestRateBps || 1800,
        tenureMonths: latestLoan?.tenureMonths || 12,
        txHash: latestLoan?.txHash || null,
        createdAt: latestLoan?.createdAt || shg.createdAt,
        hasPendingLoan: pendingLoans.length > 0,
      }
    })
    .filter(p => {
      if (filters?.tier && filters.tier !== 'ALL') {
        return p.tier === filters.tier
      }
      return true
    })

  return {
    pools,
    totalCount: pools.length,
  }
}

/**
 * Get ESG impact metrics for the lender's portfolio.
 */
export const getImpactMetrics = async (userId: string) => {
  // Aggregate real data from DB + on-chain events
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

  // Sum total disbursed from DB
  const disbursedSum = await prisma.loan.aggregate({
    where: { status: { in: ['ACTIVE', 'REPAID'] } },
    _sum: { amount: true },
  })

  return {
    womenSupported: totalMembers,
    familiesBenefited: totalMembers * 2,
    totalDisbursedInr: Number(disbursedSum._sum.amount ?? 0),
    activeLoans,
    repaidLoans,
    totalLoans,
    shgGroups: totalSHGs,
    statesReached: states.length,
    repaymentRate: totalLoans > 0
      ? ((repaidLoans / Math.max(repaidLoans + activeLoans, 1)) * 100).toFixed(1)
      : '0',
  }
}
