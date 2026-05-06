import { Response } from 'express'
import * as LoanService from '@/services/loan.service'
import { sendSuccess } from '@/utils/response'
import { AuthenticatedRequest } from '@/middleware/auth.middleware'
import { z } from 'zod'

const applyLoanSchema = z.object({
  shgId: z.string().min(1, 'shgId is required'),
  // FIX: Accept both string and number from the request body for compatibility
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => v > 0 && v <= 100000, 'Loan amount must be between ₹1 and ₹1,00,000'),
  tenureMonths: z.number().int().min(1).max(36, 'Tenure must be between 1 and 36 months'),
  purpose: z.string().max(500).optional(),
})

/** POST /loan/apply — Submit loan application */
export const applyLoan = async (
  req: AuthenticatedRequest,
  res: Response,
  next: Function
): Promise<void> => {
  try {
    const { shgId, amount, tenureMonths, purpose } = applyLoanSchema.parse(req.body)
    const loan = await LoanService.applyLoan({
      memberId: req.userId!,
      shgId,
      amount: amount.toString(),
      tenureMonths,
      purpose,
    })
    sendSuccess(res, loan, 201)
  } catch (error) {
    next(error)
  }
}

/** POST /loan/:id/approve — Leader approves loan */
export const approveLoan = async (
  req: AuthenticatedRequest,
  res: Response,
  next: Function
): Promise<void> => {
  try {
    const loan = await LoanService.approveLoan(req.params.id as string, req.userId!)
    sendSuccess(res, loan)
  } catch (error) {
    next(error)
  }
}

/** POST /loan/:id/disburse — Admin disburses loan */
export const disburseLoan = async (
  req: AuthenticatedRequest,
  res: Response,
  next: Function
): Promise<void> => {
  try {
    const loan = await LoanService.disburseLoan(req.params.id as string)
    sendSuccess(res, loan)
  } catch (error) {
    next(error)
  }
}

/** POST /loan/:id/repay — Record repayment */
export const repayLoan = async (
  req: AuthenticatedRequest,
  res: Response,
  next: Function
): Promise<void> => {
  try {
    const repayment = await LoanService.repayLoan(req.params.id as string, req.userId!)
    sendSuccess(res, repayment, 201)
  } catch (error) {
    next(error)
  }
}

/** GET /loan/my — Get my loans */
export const getMyLoans = async (
  req: AuthenticatedRequest,
  res: Response,
  next: Function
): Promise<void> => {
  try {
    const loans = await LoanService.getUserLoans(req.userId!)
    sendSuccess(res, loans)
  } catch (error) {
    next(error)
  }
}

/** GET /loan/:id — Get single loan */
export const getLoan = async (
  req: AuthenticatedRequest,
  res: Response,
  next: Function
): Promise<void> => {
  try {
    const loan = await LoanService.getLoanById(req.params.id as string)
    sendSuccess(res, loan)
  } catch (error) {
    next(error)
  }
}

/** GET /loan/credit-score — M4: Get credit score for borrow screen */
export const getCreditScore = async (
  req: AuthenticatedRequest,
  res: Response,
  next: Function
): Promise<void> => {
  try {
    const shgId = req.query.shgId as string
    const amount = parseFloat(req.query.amount as string) || 10000
    const forceRefresh = req.query.refresh === 'true' || req.query.refresh === '1'

    if (!shgId) {
      res.status(400).json({ success: false, error: { code: 'MISSING_PARAMS', message: 'shgId is required' } })
      return
    }

    const result = await LoanService.getCreditScore(req.userId!, shgId, amount, forceRefresh)
    sendSuccess(res, result)
  } catch (error) {
    next(error)
  }
}

