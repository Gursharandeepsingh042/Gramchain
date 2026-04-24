import { Router } from 'express'
import { z } from 'zod'
import { verifyPan, sendAadhaarOtp, verifyAadhaarOtp, hashData } from '../services/kyc.service'
import { prisma } from '../lib/prisma'
import { AppError } from '../middleware/error.middleware'
import { AuthenticatedRequest } from '../middleware/auth.middleware'

const router = Router()

/**
 * 1. Verify PAN
 */
router.post('/pan/verify', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { pan } = z.object({ pan: z.string().length(10) }).parse(req.body)

    // Fetch user to get name and dob from Aadhaar step
    const currentUser = await prisma.user.findUnique({ where: { id: req.userId! } })
    if (!currentUser || !currentUser.name || !currentUser.kycDetails) {
      throw new AppError(400, 'AADHAAR_REQUIRED', 'Please complete Aadhaar verification first to fetch Name and DOB.')
    }

    const dob = (currentUser.kycDetails as any).dob
    if (!dob) {
      throw new AppError(400, 'AADHAAR_REQUIRED', 'Date of Birth missing from Aadhaar profile.')
    }

    const result = await verifyPan(pan, currentUser.name, dob)
    
    // Check if PAN is already used by someone else
    const panHash = hashData(pan)
    const existing = await prisma.user.findUnique({ where: { panHash } })
    // Allow bypass for demo testing
    if (existing && existing.id !== req.userId! && pan !== 'ABCDE1234F' && process.env.DEMO_MODE !== 'true') {
      throw new AppError(400, 'PAN_IN_USE', 'This PAN is already registered to another account.')
    }

    // Save to user profile and mark KYC complete
    const updatedUser = await prisma.user.update({
      where: { id: req.userId! },
      data: {
        panHash,
        kycStatus: 'VERIFIED'
      }
    })

    res.json({ success: true, data: { ...result, user: updatedUser } })
  } catch (error) {
    next(error)
  }
})

/**
 * 2. Send Aadhaar OTP
 */
router.post('/aadhaar/send-otp', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { aadhaar } = z.object({ aadhaar: z.string().length(12) }).parse(req.body)

    const aadhaarHash = hashData(aadhaar)
    const existing = await prisma.user.findUnique({ where: { aadhaarHash } })
    // Allow bypass for demo testing
    if (existing && existing.id !== req.userId! && aadhaar !== '000000000000' && process.env.DEMO_MODE !== 'true') {
      throw new AppError(400, 'AADHAAR_IN_USE', 'This Aadhaar is already registered to another account.')
    }

    const result = await sendAadhaarOtp(aadhaar)
    
    // Store aadhaar info temporarily in session or client handles referenceId
    res.json({ success: true, data: result })
  } catch (error) {
    next(error)
  }
})

/**
 * 3. Verify Aadhaar OTP and complete KYC
 */
router.post('/aadhaar/verify', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { referenceId, otp, aadhaar } = z.object({
      referenceId: z.string(),
      otp: z.string().length(6),
      aadhaar: z.string().length(12)
    }).parse(req.body)

    const result = await verifyAadhaarOtp(referenceId, otp)

    // Mask Aadhaar before saving alongside Demographic info
    const maskedAadhaar = `XXXX-XXXX-${aadhaar.slice(8)}`
    
    // Save everything & mark KYC Pending (waiting for PAN)
    const updatedUser = await prisma.user.update({
      where: { id: req.userId! },
      data: {
        aadhaarHash: hashData(aadhaar),
        name: result.name, // Save official name from Aadhaar
        kycStatus: 'PENDING',
        kycDetails: {
          maskedAadhaar,
          dob: result.dob,
          gender: result.gender,
          address: result.address
        }
      }
    })

    res.json({ success: true, data: { user: updatedUser, details: result } })
  } catch (error) {
    next(error)
  }
})

export default router
