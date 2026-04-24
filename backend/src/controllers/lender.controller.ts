import { Request, Response, NextFunction } from 'express'
import * as LenderService from '@/services/lender.service'
import { sendSuccess, sendError } from '@/utils/response'
import { AuthenticatedRequest } from '@/middleware/auth.middleware'

/**
 * GET /lender/portfolio
 * Returns the lender's portfolio metrics (INR + USDC values)
 */
export const getPortfolio = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const metrics = await LenderService.getPortfolioMetrics(req.userId!)
    sendSuccess(res, metrics)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /lender/pools
 * Query: ?tier=AA&state=Jammu%20%26%20Kashmir
 * Returns available lending pools filtered by risk tier and geography (FIFO ordered)
 */
export const getAvailablePools = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { tier, state } = req.query as { tier?: string; state?: string }
    const result = await LenderService.getAvailablePools({ tier, state })
    sendSuccess(res, result)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /lender/pools/:poolId/fund
 * Body: { amount: number }
 * Initiates funding of a specific loan pool
 */
export const fundPool = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { poolId } = req.params
    const { amount } = req.body

    if (!poolId || !amount || amount <= 0) {
      sendError(res, 'INVALID_INPUT', 'Valid poolId and positive amount are required')
      return
    }

    // Phase 2: Integrate with LenderPool.sol smart contract
    // For now, return a success acknowledgment
    sendSuccess(res, {
      message: 'Fund request received. Transak payment flow will be initiated.',
      poolId,
      amount,
      status: 'PENDING_PAYMENT',
    })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /lender/impact
 * Returns ESG impact metrics for the lender's portfolio
 */
export const getImpactMetrics = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const metrics = await LenderService.getImpactMetrics(req.userId!)
    sendSuccess(res, metrics)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /lender/transactions
 * Returns the lender's transaction history
 */
export const getTransactions = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Phase 2: Query LenderTransaction model
    sendSuccess(res, { transactions: [], totalCount: 0 })
  } catch (error) {
    next(error)
  }
}
