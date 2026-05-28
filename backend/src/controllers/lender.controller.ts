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
    const result = await LenderService.getLenderTransactions(req.userId!)
    sendSuccess(res, result)
  } catch (error) {
    next(error)
  }
}
