import { Router, Request, Response, NextFunction } from 'express'
import {
  getLoanFromChain,
  getScoreFromChain,
  getSignerAddress,
  isConnected,
  checkDefaultOnChain,
} from '@/services/blockchain.service'

const router = Router()

/**
 * @route GET /blockchain/status
 * @desc  Check blockchain connection status
 */
router.get('/status', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      connected: isConnected(),
      signerAddress: getSignerAddress(),
      network: process.env.POLYGON_RPC_URL ?? 'http://127.0.0.1:8545',
      demoMode: process.env.DEMO_MODE === 'true',
    },
  })
})

/**
 * @route GET /blockchain/loan/:contractLoanId
 * @desc  Fetch loan details directly from the chain
 */
router.get('/loan/:contractLoanId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const loanId = parseInt(req.params.contractLoanId as string)
    const loan = await getLoanFromChain(loanId)
    if (!loan) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan not found on-chain' } })
    }
    res.json({ success: true, data: loan })
  } catch (err) {
    next(err)
  }
})

/**
 * @route GET /blockchain/score/:address
 * @desc  Fetch latest credit score from chain
 */
router.get('/score/:address', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const score = await getScoreFromChain(req.params.address as string)
    if (!score) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No score found on-chain' } })
    }
    res.json({ success: true, data: score })
  } catch (err) {
    next(err)
  }
})

/**
 * @route POST /blockchain/check-default/:contractLoanId
 * @desc  Trigger default check for a loan
 */
router.post('/check-default/:contractLoanId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const loanId = parseInt(req.params.contractLoanId as string)
    const result = await checkDefaultOnChain(loanId)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

export default router
