import { Router } from 'express'
import * as LoanController from '@/controllers/loan.controller'
import { loanApplyLimiter } from '@/middleware/rate-limiter.middleware'

const router = Router()

/** @route GET /loan/my */
router.get('/my', LoanController.getMyLoans)

/** @route GET /loan/credit-score — M4: Credit score endpoint */
router.get('/credit-score', LoanController.getCreditScore)

/** @route POST /loan/apply — SEC6: rate limited to 3 req/min */
router.post('/apply', loanApplyLimiter, LoanController.applyLoan)

/** @route GET /loan/:id */
router.get('/:id', LoanController.getLoan)

/** @route POST /loan/:id/approve */
router.post('/:id/approve', LoanController.approveLoan)

/** @route POST /loan/:id/disburse */
router.post('/:id/disburse', LoanController.disburseLoan)

/** @route POST /loan/:id/repay */
router.post('/:id/repay', LoanController.repayLoan)

export default router
