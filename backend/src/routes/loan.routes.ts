import { Router } from 'express'
import * as LoanController from '@/controllers/loan.controller'

const router = Router()

/** @route GET /loan/my */
router.get('/my', LoanController.getMyLoans)

/** @route POST /loan/apply */
router.post('/apply', LoanController.applyLoan)

/** @route GET /loan/:id */
router.get('/:id', LoanController.getLoan)

/** @route POST /loan/:id/approve */
router.post('/:id/approve', LoanController.approveLoan)

/** @route POST /loan/:id/repay */
router.post('/:id/repay', LoanController.repayLoan)

export default router
