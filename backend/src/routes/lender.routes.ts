import { Router } from 'express'
import * as LenderController from '@/controllers/lender.controller'

const router = Router()

/** @route GET /lender/portfolio — Portfolio metrics */
router.get('/portfolio', LenderController.getPortfolio)

/** @route GET /lender/pools — Browse available lending pools */
router.get('/pools', LenderController.getAvailablePools)

/** @route POST /lender/pools/:poolId/fund — Fund a specific pool */
router.post('/pools/:poolId/fund', LenderController.fundPool)

/** @route GET /lender/impact — ESG impact metrics */
router.get('/impact', LenderController.getImpactMetrics)

/** @route GET /lender/transactions — Transaction history */
router.get('/transactions', LenderController.getTransactions)

export default router
