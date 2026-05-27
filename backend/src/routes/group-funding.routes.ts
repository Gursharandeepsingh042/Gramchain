import { Router } from 'express'
import {
  createFundingRequest,
  getFundingRequests,
  investInGroup,
  getMyFundingRequests,
  approveInvestment,
  downloadAgreement,
} from '@/controllers/group-funding.controller'

const router = Router()

// Create group funding request (SHG leader only)
router.post('/funding', createFundingRequest)

// Get all funding requests (lenders only)
router.get('/funding', getFundingRequests)

// Invest in a group funding request (lenders only)
router.post('/funding/:fundingRequestId/invest', investInGroup)

// Get my funding requests (SHG leader)
router.get('/funding/my', getMyFundingRequests)

// Approve investment (SHG leader)
router.post('/funding/investments/:investmentId/approve', approveInvestment)

// Download investment agreement PDF
router.get('/funding/investments/:investmentId/agreement', downloadAgreement)

export default router
