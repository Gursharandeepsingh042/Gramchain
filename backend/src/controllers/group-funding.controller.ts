import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '@/middleware/auth.middleware'
import { prisma } from '@/lib/prisma'
import * as NotificationService from '@/services/notification.service'
import { generateInvestmentAgreementById, generateLoanReceipt } from '@/services/pdf.service'
import { recordLedgerEntry } from '@/services/ledger.service'

// Create a group funding request (SHG leader only)
export const createFundingRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!
    const { shgId, amount, durationMonths, purpose, minInvestment, maxInvestment, signatureUrl } = req.body

    // Validate max investment is <= 1 lakh
    if (maxInvestment > 100000) {
      res.status(400).json({
        error: {
          message: 'Maximum investment per lender cannot exceed ₹1,00,000',
          code: 'MAX_INVESTMENT_EXCEEDED'
        }
      })
      return
    }

    // Verify user is leader of the SHG
    const membership = await prisma.sHGMember.findFirst({
      where: {
        userId,
        shgId,
        role: 'LEADER'
      }
    })

    if (!membership) {
      res.status(403).json({
        error: {
          message: 'Only SHG leaders can create funding requests',
          code: 'NOT_LEADER'
        }
      })
      return
    }

    // Create funding request
    const fundingRequest = await prisma.groupFundingRequest.create({
      data: {
        shgId,
        requestedBy: userId,
        amount,
        durationMonths,
        purpose,
        minInvestment,
        maxInvestment,
        signatureUrl,
        termsAccepted: true
      }
    })

    // Notify all lenders
    const lenders = await prisma.user.findMany({
      where: { role: 'LENDER' }
    })

    await Promise.all(
      lenders.map(lender =>
        NotificationService.createNotification(
          lender.id,
          'GROUP_FUNDING_REQUEST' as any,
          'New Group Funding Opportunity',
          `${purpose} - ₹${Number(amount).toLocaleString('en-IN')} requested`,
          { fundingRequestId: fundingRequest.id, shgId }
        )
      )
    )

    res.status(201).json({ data: fundingRequest })
  } catch (error) {
    next(error)
  }
}

// Get all funding requests (for lenders)
export const getFundingRequests = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!
    const { status } = req.query

    // Only lenders can view funding requests
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (user?.role !== 'LENDER') {
      res.status(403).json({
        error: {
          message: 'Only lenders can view funding requests',
          code: 'NOT_LENDER'
        }
      })
      return
    }

    const where: any = {}
    if (status) {
      where.status = status
    }

    const requests = await prisma.groupFundingRequest.findMany({
      where,
      include: {
        shg: {
          include: {
            members: {
              include: {
                user: true
              }
            }
          }
        },
        requestor: {
          select: {
            id: true,
            name: true
          }
        },
        investments: {
          include: {
            lender: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate total funded amount for each request
    const requestsWithFunding = requests.map((request: any) => ({
      ...request,
      totalFunded: request.investments
        .filter((inv: any) => inv.status === 'APPROVED')
        .reduce((sum: number, inv: any) => sum + Number(inv.amount), 0),
      investorCount: request.investments.filter((inv: any) => inv.status === 'APPROVED').length
    }))

    res.json({ data: requestsWithFunding })
  } catch (error) {
    next(error)
  }
}

// Lender invests in a group funding request
export const investInGroup = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!
    const { fundingRequestId, amount, interestRateBps } = req.body

    // Verify user is a lender
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (user?.role !== 'LENDER') {
      res.status(403).json({
        error: {
          message: 'Only lenders can invest',
          code: 'NOT_LENDER'
        }
      })
      return
    }

    // Get funding request
    const fundingRequest = await prisma.groupFundingRequest.findUnique({
      where: { id: fundingRequestId },
      include: {
        investments: true
      }
    })

    if (!fundingRequest) {
      res.status(404).json({
        error: {
          message: 'Funding request not found',
          code: 'NOT_FOUND'
        }
      })
      return
    }

    // Validate investment amount
    if (amount < Number(fundingRequest.minInvestment) || amount > Number(fundingRequest.maxInvestment)) {
      res.status(400).json({
        error: {
          message: `Investment must be between ₹${Number(fundingRequest.minInvestment).toLocaleString('en-IN')} and ₹${Number(fundingRequest.maxInvestment).toLocaleString('en-IN')}`,
          code: 'INVALID_AMOUNT'
        }
      })
      return
    }

    // Check if already invested
    const existingInvestment = fundingRequest.investments.find((inv: any) => inv.lenderId === userId)
    if (existingInvestment) {
      res.status(400).json({
        error: {
          message: 'You have already invested in this request',
          code: 'ALREADY_INVESTED'
        }
      })
      return
    }

    // Create investment with ledger entries
    const investment = await prisma.$transaction(async (tx) => {
      const inv = await tx.lenderInvestment.create({
        data: {
          fundingRequestId,
          lenderId: userId,
          shgId: fundingRequest.shgId,
          amount,
          interestRateBps,
          status: 'PENDING'
        }
      })

      // Record ledger entry: lender deposit (investment outflow)
      await recordLedgerEntry(tx, {
        entityType: 'USER',
        entityId: userId,
        type: 'LENDER_DEPOSIT',
        amountPaise: -Math.round(Number(amount) * 100),
        ref: `INVESTMENT-${inv.id}`
      })

      // Record ledger entry: SHG receives investment (inflow)
      await recordLedgerEntry(tx, {
        entityType: 'SHG',
        entityId: fundingRequest.shgId,
        type: 'LOAN_DISBURSAL',
        amountPaise: Math.round(Number(amount) * 100),
        ref: `INVESTMENT-${inv.id}`
      })

      return inv
    })

    // Notify SHG leader
    await NotificationService.createNotification(
      fundingRequest.requestedBy,
      'GROUP_FUNDING_APPROVED' as any,
      'New Investment Received',
      `Lender invested ₹${Number(amount).toLocaleString('en-IN')} in your group`,
      { investmentId: investment.id, fundingRequestId }
    )

    res.status(201).json({ data: investment })
  } catch (error) {
    next(error)
  }
}

// Get my funding requests (for SHG leader)
export const getMyFundingRequests = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!

    const requests = await prisma.groupFundingRequest.findMany({
      where: { requestedBy: userId },
      include: {
        shg: true,
        investments: {
          include: {
            lender: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const requestsWithFunding = requests.map((request: any) => ({
      ...request,
      totalFunded: request.investments
        .filter((inv: any) => inv.status === 'APPROVED')
        .reduce((sum: number, inv: any) => sum + Number(inv.amount), 0),
      investorCount: request.investments.filter((inv: any) => inv.status === 'APPROVED').length
    }))

    res.json({ data: requestsWithFunding })
  } catch (error) {
    next(error)
  }
}

// Approve investment (SHG leader)
export const approveInvestment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!
    const { investmentId } = req.params

    const investment = await prisma.lenderInvestment.findUnique({
      where: { id: Array.isArray(investmentId) ? investmentId[0] : investmentId },
      include: {
        fundingRequest: true
      }
    })

    if (!investment) {
      res.status(404).json({
        error: {
          message: 'Investment not found',
          code: 'NOT_FOUND'
        }
      })
      return
    }

    // Verify user is the SHG leader who requested funding
    if (investment.fundingRequest.requestedBy !== userId) {
      res.status(403).json({
        error: {
          message: 'Only the SHG leader can approve investments',
          code: 'NOT_AUTHORIZED'
        }
      })
      return
    }

    // Update investment status
    const updated = await prisma.lenderInvestment.update({
      where: { id: Array.isArray(investmentId) ? investmentId[0] : investmentId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date()
      }
    })

    // Check if fully funded
    const totalFunded = await prisma.lenderInvestment.aggregate({
      where: {
        fundingRequestId: investment.fundingRequestId,
        status: 'APPROVED'
      },
      _sum: {
        amount: true
      }
    })

    if (totalFunded._sum.amount && Number(totalFunded._sum.amount) >= Number(investment.fundingRequest.amount)) {
      await prisma.groupFundingRequest.update({
        where: { id: investment.fundingRequestId },
        data: { status: 'FULLY_FUNDED' }
      })
    }

    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
}

// Decline investment (SHG leader)
export const declineInvestment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!
    const { investmentId } = req.params

    const investment = await prisma.lenderInvestment.findUnique({
      where: { id: Array.isArray(investmentId) ? investmentId[0] : investmentId },
      include: {
        fundingRequest: true
      }
    })

    if (!investment) {
      res.status(404).json({
        error: {
          message: 'Investment not found',
          code: 'NOT_FOUND'
        }
      })
      return
    }

    // Verify user is the SHG leader who requested funding
    if (investment.fundingRequest.requestedBy !== userId) {
      res.status(403).json({
        error: {
          message: 'Only the SHG leader can decline investments',
          code: 'NOT_AUTHORIZED'
        }
      })
      return
    }

    // Update investment status
    const updated = await prisma.lenderInvestment.update({
      where: { id: Array.isArray(investmentId) ? investmentId[0] : investmentId },
      data: {
        status: 'REJECTED',
        declinedAt: new Date()
      }
    })

    // Notify lender
    await NotificationService.createNotification(
      investment.lenderId,
      'INVESTMENT_DECLINED' as any,
      'Investment Declined',
      'Your investment offer was declined by the SHG leader',
      { investmentId: investment.id, fundingRequestId: investment.fundingRequestId }
    )

    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
}

// Disburse loan (trigger on-chain transaction)
export const disburseLoan = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!
    const { fundingRequestId } = req.params

    const fundingRequest = await prisma.groupFundingRequest.findUnique({
      where: { id: Array.isArray(fundingRequestId) ? fundingRequestId[0] : fundingRequestId },
      include: {
        investments: true,
        shg: true
      }
    })

    if (!fundingRequest) {
      res.status(404).json({
        error: {
          message: 'Funding request not found',
          code: 'NOT_FOUND'
        }
      })
      return
    }

    // Verify user is the SHG leader
    if (fundingRequest.requestedBy !== userId) {
      res.status(403).json({
        error: {
          message: 'Only the SHG leader can disburse the loan',
          code: 'NOT_AUTHORIZED'
        }
      })
      return
    }

    // Check if fully funded
    const totalFunded = fundingRequest.investments
      .filter((inv: any) => inv.status === 'APPROVED')
      .reduce((sum: number, inv: any) => sum + Number(inv.amount), 0)

    if (totalFunded < Number(fundingRequest.amount)) {
      res.status(400).json({
        error: {
          message: 'Loan is not fully funded yet',
          code: 'NOT_FULLY_FUNDED'
        }
      })
      return
    }

    // Update funding request status to DISBURSED
    const updated = await prisma.groupFundingRequest.update({
      where: { id: Array.isArray(fundingRequestId) ? fundingRequestId[0] : fundingRequestId },
      data: {
        status: 'DISBURSED',
        disbursedAt: new Date()
      }
    })

    // TODO: Trigger blockchain transaction via blockchain service
    // This would interact with the smart contract to transfer funds

    // Notify all investors
    await Promise.all(
      fundingRequest.investments
        .filter((inv: any) => inv.status === 'APPROVED')
        .map((inv: any) =>
          NotificationService.createNotification(
            inv.lenderId,
            'LOAN_DISBURSED' as any,
            'Loan Disbursed',
            `Your investment in ${fundingRequest.shg.name} has been disbursed`,
            { fundingRequestId, investmentId: inv.id }
          )
        )
    )

    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
}

// Get transaction receipt (blockchain details)
export const getReceipt = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!
    const { fundingRequestId } = req.params

    const fundingRequest = await prisma.groupFundingRequest.findUnique({
      where: { id: Array.isArray(fundingRequestId) ? fundingRequestId[0] : fundingRequestId },
      include: {
        shg: true,
        investments: {
          include: {
            lender: true
          }
        },
        requestor: true
      }
    })

    if (!fundingRequest) {
      res.status(404).json({
        error: {
          message: 'Funding request not found',
          code: 'NOT_FOUND'
        }
      })
      return
    }

    // Verify user is either the SHG leader or an investor
    const isLeader = fundingRequest.requestedBy === userId
    const isInvestor = fundingRequest.investments.some((inv: any) => inv.lenderId === userId)

    if (!isLeader && !isInvestor) {
      res.status(403).json({
        error: {
          message: 'Only the SHG leader or investors can view the receipt',
          code: 'NOT_AUTHORIZED'
        }
      })
      return
    }

    // TODO: Fetch blockchain transaction details from blockchain service
    // For now, return mock data
    const receipt = {
      fundingRequestId: fundingRequest.id,
      shgName: fundingRequest.shg.name,
      amount: fundingRequest.amount,
      status: fundingRequest.status,
      disbursedAt: fundingRequest.disbursedAt,
      // Blockchain details (mock for now)
      transactionId: '0x' + Math.random().toString(16).substr(2, 64),
      blockNumber: Math.floor(Math.random() * 10000000) + 40000000,
      blockHash: '0x' + Math.random().toString(16).substr(2, 64),
      borrowerWallet: '0x' + Math.random().toString(16).substr(2, 40),
      lenderWallets: fundingRequest.investments
        .filter((inv: any) => inv.status === 'APPROVED')
        .map(() => '0x' + Math.random().toString(16).substr(2, 40)),
      contractAddress: '0x' + Math.random().toString(16).substr(2, 40),
      network: 'Polygon',
      investments: fundingRequest.investments
        .filter((inv: any) => inv.status === 'APPROVED')
        .map((inv: any) => ({
          lenderId: inv.lenderId,
          lenderName: inv.lender.name,
          amount: inv.amount,
          interestRateBps: inv.interestRateBps
        }))
    }

    res.json({ data: receipt })
  } catch (error) {
    next(error)
  }
}

// Download investment agreement PDF
export const downloadAgreement = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!
    const { investmentId } = req.params

    // Get investment to verify user is either the lender or the SHG leader
    const investment = await prisma.lenderInvestment.findUnique({
      where: { id: Array.isArray(investmentId) ? investmentId[0] : investmentId },
      include: {
        lender: true,
        fundingRequest: {
          include: {
            shg: true
          }
        }
      }
    })

    if (!investment) {
      res.status(404).json({
        error: {
          message: 'Investment not found',
          code: 'NOT_FOUND'
        }
      })
      return
    }

    // Verify user is either the lender or the SHG leader
    const isLender = investment.lenderId === userId
    const isLeader = investment.fundingRequest.requestedBy === userId

    if (!isLender && !isLeader) {
      res.status(403).json({
        error: {
          message: 'Only the lender or SHG leader can download the agreement',
          code: 'NOT_AUTHORIZED'
        }
      })
      return
    }

    // Generate PDF
    const pdfBuffer = await generateInvestmentAgreementById(
      Array.isArray(investmentId) ? investmentId[0] : investmentId
    )

    // Send PDF as response
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="investment-agreement-${investmentId}.pdf"`
    )
    res.send(pdfBuffer)
  } catch (error) {
    next(error)
  }
}

// Download loan receipt PDF
export const downloadLoanReceipt = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!
    const { fundingRequestId } = req.params

    // Get funding request to verify user is either the SHG leader or an investor
    const fundingRequest = await prisma.groupFundingRequest.findUnique({
      where: { id: Array.isArray(fundingRequestId) ? fundingRequestId[0] : fundingRequestId },
      include: {
        shg: true,
        investments: {
          include: {
            lender: true
          }
        }
      }
    })

    if (!fundingRequest) {
      res.status(404).json({
        error: {
          message: 'Funding request not found',
          code: 'NOT_FOUND'
        }
      })
      return
    }

    // Verify user is either the SHG leader or an investor
    const isLeader = fundingRequest.requestedBy === userId
    const isInvestor = fundingRequest.investments.some((inv: any) => inv.lenderId === userId)

    if (!isLeader && !isInvestor) {
      res.status(403).json({
        error: {
          message: 'You are not authorized to download this receipt',
          code: 'NOT_AUTHORIZED'
        }
      })
      return
    }

    // Prepare receipt data - use real blockchain data from investments
    const approvedInvestments = fundingRequest.investments.filter((inv: any) => inv.status === 'APPROVED')
    const firstTxHash = approvedInvestments[0]?.txHash || null
    
    const receiptData = {
      fundingRequestId: fundingRequest.id,
      shgName: fundingRequest.shg.name,
      amount: Number(fundingRequest.amount),
      durationMonths: fundingRequest.durationMonths,
      purpose: fundingRequest.purpose,
      disbursedAt: fundingRequest.disbursedAt || new Date(),
      transactionId: firstTxHash || 'PENDING_ON_CHAIN',
      blockNumber: 0, // Will be populated from blockchain when deployed
      blockHash: 'PENDING_ON_CHAIN',
      contractAddress: fundingRequest.shg.poolContractAddress || 'PENDING_DEPLOYMENT',
      network: 'Polygon Mainnet',
      investments: approvedInvestments.map((inv: any) => ({
        lenderName: inv.lender.name || 'Unknown',
        amount: Number(inv.amount),
        interestRateBps: inv.interestRateBps
      }))
    }

    // Generate PDF
    const pdfBuffer = await generateLoanReceipt(receiptData)

    // Send PDF as response
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="loan-receipt-${fundingRequestId}.pdf"`
    )
    res.send(pdfBuffer)
  } catch (error) {
    next(error)
  }
}

