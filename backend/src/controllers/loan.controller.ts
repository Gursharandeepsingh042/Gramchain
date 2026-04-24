import { Response } from 'express'
import * as LoanService from '@/services/loan.service'
import { sendSuccess, sendError } from '@/utils/response'
import { AuthenticatedRequest } from '@/middleware/auth.middleware'

/** POST /loan/apply — Submit loan application */
export const applyLoan = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { shgId, amount, tenureMonths, purpose } = req.body
  if (!shgId || !amount || !tenureMonths) {
    sendError(res, 'MISSING_FIELDS', 'shgId, amount, and tenureMonths are required')
    return
  }
  const loan = await LoanService.applyLoan({
    memberId: req.userId!,
    shgId,
    amount: amount.toString(),
    tenureMonths: parseInt(tenureMonths),
    purpose,
  })
  sendSuccess(res, loan, 201)
}

/** POST /loan/:id/approve — Leader approves loan */
export const approveLoan = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const loan = await LoanService.approveLoan(req.params.id as string, req.userId!)
  sendSuccess(res, loan)
}

/** POST /loan/:id/repay — Record repayment */
export const repayLoan = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const repayment = await LoanService.repayLoan(req.params.id as string, req.userId!)
  sendSuccess(res, repayment, 201)
}

/** GET /loan/my — Get my loans */
export const getMyLoans = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const loans = await LoanService.getUserLoans(req.userId!)
  sendSuccess(res, loans)
}

/** GET /loan/:id — Get single loan */
export const getLoan = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const loan = await LoanService.getLoanById(req.params.id as string)
  sendSuccess(res, loan)
}
