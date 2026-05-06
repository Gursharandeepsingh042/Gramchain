import { Router } from 'express'
import { z } from 'zod'
import { verifyPan, sendAadhaarOtp, verifyAadhaarOtp, hashData, encryptKycData, decryptKycData, completeKyc } from '../services/kyc.service'
import { prisma } from '../lib/prisma'
import { AppError } from '../middleware/error.middleware'
import { AuthenticatedRequest } from '../middleware/auth.middleware'
import { kycPanLimiter, kycAadhaarLimiter } from '../middleware/rate-limiter.middleware'

const router = Router()

/**
 * 1. Verify PAN — SEC5: rate limited to 5 req/min
 */
router.post('/pan/verify', kycPanLimiter, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { pan, dob: providedDob } = z.object({ 
      pan: z.string().length(10),
      dob: z.string().optional()
    }).parse(req.body)

    // Fetch user to get name and dob from Aadhaar step
    const currentUser = await prisma.user.findUnique({ where: { id: req.userId! } })
    if (!currentUser || !currentUser.name || !currentUser.kycDetails) {
      throw new AppError(400, 'AADHAAR_REQUIRED', 'Please complete Aadhaar verification first to fetch Name and DOB.')
    }

    let kycDetails: any;
    try {
      kycDetails = decryptKycData(currentUser.kycDetails as string)
    } catch (e) {
      // Fallback for dev mode/legacy data if not encrypted
      kycDetails = currentUser.kycDetails
    }

    const dob = kycDetails.dob || providedDob
    if (!dob) {
      console.error('PAN Verify: DOB missing for user', { userId: req.userId, kycDetails })
      throw new AppError(400, 'AADHAAR_REQUIRED', 'Date of Birth missing from Aadhaar profile. Please try re-verifying Aadhaar or provide it manually.')
    }

    const result = await verifyPan(pan, currentUser.name, dob)
    
    // Cross-verify Name and DOB with Aadhaar info (Demographic Match)
    const aadhaarName = currentUser.name.toLowerCase().trim()
    const panName = result.name.toLowerCase().trim()
    
    const nameMatch = panName.includes(aadhaarName) || aadhaarName.includes(panName) || 
                      panName.split(' ').some((part: string) => aadhaarName.includes(part))
    
    const normalizeDate = (d: string | undefined) => d ? d.replace(/[-\/]/g, '') : ''
    const dobMatch = normalizeDate(result.dob) === normalizeDate(dob)

    if (!nameMatch || !dobMatch) {
      console.warn('KYC Demographic Mismatch Detected:', {
        userId: req.userId,
        aadhaarName,
        panName,
        aadhaarDob: dob,
        panDob: result.dob,
        nameMatch,
        dobMatch
      })
      
      // If DOB doesn't match at all, we should probably fail even if PAN is valid
      if (!dobMatch && process.env.DEMO_MODE !== 'true') {
        throw new AppError(400, 'KYC_DATA_MISMATCH', 'Date of Birth on PAN does not match Aadhaar records.')
      }
      
      // If Name doesn't match even partially, we should fail
      if (!nameMatch && process.env.DEMO_MODE !== 'true') {
        throw new AppError(400, 'KYC_DATA_MISMATCH', 'Name on PAN does not match Aadhaar records.')
      }
    }

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
        kycStatus: 'VERIFIED',
        kycDetails: encryptKycData({
          ...kycDetails,
          pan: result.panFormat,
          panName: result.name,
          panDob: result.dob,
          demographicMatched: true,
          verifiedAt: new Date().toISOString()
        })
      }
    })

    res.json({ success: true, data: { ...result, user: updatedUser, matchResults: { nameMatch, dobMatch } } })
  } catch (error) {
    next(error)
  }
})

/**
 * 2. Send Aadhaar OTP — SEC5: rate limited to 3 req/min
 */
router.post('/aadhaar/send-otp', kycAadhaarLimiter, async (req: AuthenticatedRequest, res, next) => {
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
    // Accept both naming conventions to prevent redundancy/validation errors
    const body = req.body;
    const refId = body.referenceId || body.reference_id;
    
    const { referenceId, otp, aadhaar } = z.object({
      referenceId: z.coerce.string().min(1, "Reference ID is required"),
      otp: z.string().length(6),
      aadhaar: z.string().length(12)
    }).parse({ ...body, referenceId: refId })

    const result = await verifyAadhaarOtp(referenceId, otp)

    // Mask Aadhaar before saving alongside Demographic info
    const maskedAadhaar = `XXXX-XXXX-${aadhaar.slice(8)}`
    
    const kycDetailsData = {
      maskedAadhaar,
      dob: result.dob,
      gender: result.gender,
      address: result.address
    }

    // Save everything & mark KYC Pending (waiting for PAN)
    const updatedUser = await prisma.user.update({
      where: { id: req.userId! },
      data: {
        aadhaarHash: hashData(aadhaar),
        name: result.name, // Save official name from Aadhaar
        kycStatus: 'PENDING',
        kycDetails: encryptKycData(kycDetailsData)
      }
    })

    res.json({ success: true, data: { user: updatedUser, details: result } })
  } catch (error) {
    next(error)
  }
})

/**
 * 4. Complete KYC and create wallet
 * Called after both Aadhaar and PAN are verified
 */
router.post('/complete', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { aadhaar, pan, name, dob, gender, address } = z.object({
      aadhaar: z.string().length(12),
      pan: z.string().length(10),
      name: z.string().min(1),
      dob: z.string().min(1),
      gender: z.string(),
      address: z.string()
    }).parse(req.body)

    const result = await completeKyc(req.userId!, {
      aadhaarHash: hashData(aadhaar),
      panHash: hashData(pan),
      name,
      dob,
      gender,
      address
    })

    res.json({ success: true, data: result })
  } catch (error) {
    next(error)
  }
})

export default router
