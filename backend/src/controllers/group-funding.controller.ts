import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '@/middleware/auth.middleware'
import { prisma } from '@/lib/prisma'
import * as NotificationService from '@/services/notification.service'
import { generateInvestmentAgreementById } from '@/services/pdf.service'

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

    // Create investment
    const investment = await prisma.lenderInvestment.create({
      data: {
        fundingRequestId,
        lenderId: userId,
        shgId: fundingRequest.shgId,
        amount,
        interestRateBps,
        status: 'PENDING'
      }
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

