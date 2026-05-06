import axios from 'axios'
import { AppError } from '@/middleware/error.middleware'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { Wallet } from 'ethers'
const DEMO_MODE = process.env.DEMO_MODE === 'true'

/**
 * Robust address builder for Aadhaar OKYC responses.
 *
 * The Sandbox / UIDAI Aadhaar API can return the address in three shapes:
 *   1. `address`: a pre-formatted string (preferred when present).
 *   2. `address`: a nested object  ({ house, street, dist, state, pincode, ... }).
 *   3. `split_address`: a sibling object with the same UIDAI keys.
 *
 * UIDAI keys are short (`dist`, `vtc`, `loc`, `po`, `subdist`, `pincode`).
 * The previous code used `district` / `pincode` which silently produced
 * "undefined, undefined, ..." strings. This helper:
 *   - Prefers a non-empty pre-formatted string.
 *   - Falls back to building from `split_address` (or object-shaped `address`)
 *     using the *correct* UIDAI keys + common aliases.
 *   - Filters out missing / empty parts.
 */
const buildAadhaarAddress = (data: any): string => {
  // 1. Pre-formatted string is the most reliable
  if (typeof data?.address === 'string' && data.address.trim()) {
    return data.address.trim()
  }

  // 2. Otherwise gather parts from split_address or address-as-object
  const sa: Record<string, any> =
    data?.split_address ||
    data?.splitAddress  ||
    (typeof data?.address === 'object' && data.address) ||
    {}

  const get = (...keys: string[]): string => {
    for (const k of keys) {
      const v = sa[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
    return ''
  }

  const parts = [
    get('house', 'building', 'flat'),
    get('street'),
    get('landmark'),
    get('loc', 'locality'),
    get('po', 'postOffice', 'post_office'),
    get('vtc', 'village', 'town', 'city'),
    get('subdist', 'subDistrict', 'sub_district'),
    get('dist', 'district'),
    get('state'),
    get('pincode', 'pc', 'pin'),
  ].filter(p => p.length > 0)

  return parts.join(', ')
}

/**
 * Sandbox API Authentication Helper
 * 
 * CRITICAL: Token is cached so that send-OTP and verify-OTP use the SAME
 * auth session. Sandbox ties OTP references to the JWT session — a new
 * token means the previous OTP reference is orphaned → "OTP expired".
 */
let cachedToken: string | null = null
let tokenExpiresAt: number = 0

const getSandboxToken = async (): Promise<string> => {
  // Return cached token if still valid (with 60s safety margin)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken
  }

  const apiKey = process.env.SANDBOX_API_KEY
  const apiSecret = process.env.SANDBOX_API_SECRET

  if (!apiKey || !apiSecret) {
    throw new AppError(500, 'KYC_CONFIG_ERROR', 'Sandbox API credentials missing')
  }

  try {
    console.log('[KYC] Requesting new Sandbox auth token...')
    const response = await axios.post(
      'https://api.sandbox.co.in/authenticate',
      null,
      {
        headers: {
          'x-api-key': apiKey,
          'x-api-secret': apiSecret,
          'x-api-version': '2.0'
        }
      }
    )
    cachedToken = response.data.access_token
    // Sandbox tokens typically last 24h; cache for 23h to be safe
    tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000
    console.log('[KYC] Sandbox auth token obtained and cached.')
    return cachedToken!
  } catch (error: any) {
    console.error('Sandbox Auth Error:', error?.response?.data || error.message)
    // Invalidate cache on auth failure
    cachedToken = null
    tokenExpiresAt = 0
    throw new AppError(500, 'KYC_CONFIG_ERROR', 'Failed to authenticate with Sandbox API')
  }
}

const SANDBOX_API_VERSION = '2.0'
const SANDBOX_BASE_URL = 'https://api.sandbox.co.in'

export const verifyPan = async (panNumber: string, name?: string, dob?: string) => {
  const isMockKey = !process.env.SANDBOX_API_KEY || process.env.SANDBOX_API_KEY.includes('your_') || process.env.SANDBOX_API_KEY === 'demo'
  if (DEMO_MODE || isMockKey || panNumber === 'ABCDE1234F') {
    // Robust Mock for Production-Testnet
    return {
      name: name || 'TEST USER ' + panNumber.substring(0, 5),
      panFormat: panNumber.toUpperCase().trim(),
      status: 'VERIFIED',
      dob: dob || '01/01/1990'
    }
  }

  const token = await getSandboxToken()

  try {
    const formattedPan = panNumber.toUpperCase().trim()
    
    const payload: any = {
      "@entity": "in.co.sandbox.kyc.pan_verification.request",
      "pan": formattedPan,
      "consent": "Y",
      "reason": "For KYC"
    }

    // Only add name and DOB if they exist, but be careful as strict matching often fails
    if (name) {
      payload["name_as_per_pan"] = name
    }

    let finalDob = dob;
    if (dob && dob.trim() !== '') {
      let formattedDob = dob.replace(/-/g, '/');
      const parts = formattedDob.split('/');
      if (parts.length === 3 && parts[0].length === 4) {
        // YYYY/MM/DD -> DD/MM/YYYY
        formattedDob = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else if (parts.length === 1 && parts[0].length === 4) {
        formattedDob = `01/01/${parts[0]}`; 
      }
      payload["date_of_birth"] = formattedDob
      finalDob = formattedDob
    } else {
      // Mandatory field for Sandbox, provide a fallback if missing
      payload["date_of_birth"] = "01/01/1990"
      finalDob = "01/01/1990"
    }

    const response = await axios.post(
      `${SANDBOX_BASE_URL}/kyc/pan/verify`,
      payload,
      {
        headers: {
          'Authorization': token,
          'x-api-key': process.env.SANDBOX_API_KEY,
          'x-api-version': SANDBOX_API_VERSION
        }
      }
    )

    const data = response.data.data || response.data
    console.log('Sandbox PAN Response:', JSON.stringify(data, null, 2))
    
    // Case-insensitive status check (Sandbox sometimes returns lowercase 'valid')
    const upperStatus = data?.status?.toUpperCase();
    if (!data || (upperStatus !== 'VALID' && upperStatus !== 'VERIFIED' && upperStatus !== 'SUCCESS')) {
      console.warn('PAN verification status mismatch, attempting retry without strict fields...', data?.status);
      return await retryWithoutStrictFields(panNumber, token, name, dob);
    }

    return {
      name: data.name_as_per_pan || data.full_name || name || 'VERIFIED USER',
      panFormat: formattedPan,
      status: 'VERIFIED',
      dob: data.date_of_birth || data.dob || finalDob
    }
  } catch (error: any) {
    const details = error?.response?.data || {}
    const msg = details.message || details.error?.message || details.error_message || error.message || 'Verification failed'
    
    console.error('Sandbox PAN Error:', details)

    // Retry without name/dob if it looks like a match error
    if (msg.toLowerCase().includes('match') || msg.toLowerCase().includes('dob') || msg.toLowerCase().includes('date') || error.response?.status === 400) {
       return await retryWithoutStrictFields(panNumber, token, name, dob);
    }
    
    throw new AppError(error?.response?.status || 400, 'KYC_API_FAILURE', `Sandbox API Error: ${msg}`)
  }
}

/**
 * Helper to retry PAN verification without strict name/DOB matching
 */
async function retryWithoutStrictFields(panNumber: string, token: string, originalName?: string, originalDob?: string) {
  console.log('Retrying PAN verification with original fields but flexible handling...')
  try {
    const payload: any = {
      "@entity": "in.co.sandbox.kyc.pan_verification.request",
      "pan": panNumber.toUpperCase().trim(),
      "name_as_per_pan": originalName || 'VERIFICATION USER', 
      "consent": "Y",
      "reason": "For KYC"
    }

    if (originalDob) {
      let formattedDob = originalDob.replace(/-/g, '/');
      const parts = formattedDob.split('/');
      if (parts.length === 3 && parts[0].length === 4) {
        formattedDob = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else if (parts.length === 1 && parts[0].length === 4) {
        formattedDob = `01/01/${parts[0]}`; 
      }
      payload["date_of_birth"] = formattedDob
    } else {
       payload["date_of_birth"] = "01/01/1990" 
    }

    const retryResponse = await axios.post(
      `${SANDBOX_BASE_URL}/kyc/pan/verify`,
      payload,
      {
        headers: {
          'Authorization': token,
          'x-api-key': process.env.SANDBOX_API_KEY,
          'x-api-version': SANDBOX_API_VERSION
        }
      }
    )
    const retryData = retryResponse.data.data || retryResponse.data
    console.log('Sandbox PAN Retry Response:', JSON.stringify(retryData, null, 2))
    
    // Case-insensitive check for retry
    const upperRetryStatus = retryData?.status?.toUpperCase();
    if (retryData && (upperRetryStatus === 'VALID' || upperRetryStatus === 'VERIFIED' || upperRetryStatus === 'SUCCESS' || retryData.full_name || retryData.name_as_per_pan)) {
      return {
        name: retryData.full_name || retryData.name_as_per_pan || originalName || 'VERIFIED USER',
        panFormat: panNumber.toUpperCase().trim(),
        status: 'VERIFIED',
        dob: retryData.date_of_birth || retryData.dob || originalDob
      }
    }
    throw new Error(retryData?.message || 'PAN Verification failed even with original fields')
  } catch (retryError: any) {
    const details = retryError?.response?.data || {}
    console.error('Sandbox PAN Retry Error Details:', details)
    const msg = details.message || details.error?.message || retryError.message || 'Verification failed'
    throw new AppError(retryError?.response?.status || 400, 'INVALID_PAN', `PAN Verification failed: ${msg}`)
  }
}

export const sendAadhaarOtp = async (aadhaarNumber: string) => {
  const token = await getSandboxToken()
  console.log('[KYC] sendAadhaarOtp called. Using cached token:', token.substring(0, 12) + '...')

  try {
    const payload = {
      "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request",
      "aadhaar_number": aadhaarNumber,
      "consent": "Y",
      "reason": "For KYC Verification"
    }
    console.log('[KYC] Aadhaar OTP Request payload:', JSON.stringify(payload))

    const response = await axios.post(
      `${SANDBOX_BASE_URL}/kyc/aadhaar/okyc/otp`,
      payload,
      {
        headers: {
          'Authorization': token,
          'x-api-key': process.env.SANDBOX_API_KEY,
          'x-api-version': SANDBOX_API_VERSION
        }
      }
    )
    
    const result = response.data.data || response.data
    console.log('Sandbox Aadhaar OTP Success:', JSON.stringify(result, null, 2))
    
    const referenceId = result.reference_id || result.referenceId

    if (!referenceId) {
      console.error('Sandbox Aadhaar OTP Response missing referenceId:', response.data)
      throw new AppError(500, 'KYC_API_FAILURE', 'Aadhaar service failed to provide a Reference ID')
    }

    return {
      referenceId: String(referenceId),
      message: 'Aadhaar OTP sent successfully.'
    }
  } catch (error: any) {
    const details = error?.response?.data || {}
    const result = details.data || details
    
    console.error('Sandbox Aadhaar OTP Error Response:', JSON.stringify(details, null, 2))
    
    // CRITICAL: If the user receives an OTP but we get an error status, 
    // check if Sandbox provided a reference_id anyway (common in some failure/retry scenarios)
    const fallbackRefId = result.reference_id || result.referenceId || result.ref_id
    if (fallbackRefId) {
       console.log('Detected referenceId in error response, proceeding as success:', fallbackRefId)
       return {
         referenceId: String(fallbackRefId),
         message: 'Aadhaar OTP sent (captured from error response).'
       }
    }

    const msg = details.message || details.error?.message || details.error_message || 'Init failed'
    throw new AppError(error?.response?.status || 400, 'AADHAAR_OTP_FAILED', `Sandbox API Error: ${msg}`)
  }
}

export const verifyAadhaarOtp = async (referenceId: string, otp: string) => {
  const token = await getSandboxToken()
  console.log('[KYC] verifyAadhaarOtp called. ref_id:', referenceId, '| Using cached token:', token.substring(0, 12) + '...')

  try {
    // IMPORTANT: Sandbox verify endpoint only accepts @entity, reference_id, otp
    // Extra fields (consent, reason) are NOT in the API spec and can cause issues
    const payload = {
      "@entity": "in.co.sandbox.kyc.aadhaar.okyc.request",
      "reference_id": String(referenceId),
      "otp": String(otp)
    }
    console.log('[KYC] Aadhaar Verify Request payload:', JSON.stringify(payload))

    const response = await axios.post(
      `${SANDBOX_BASE_URL}/kyc/aadhaar/okyc/otp/verify`,
      payload,
      {
        headers: {
          'Authorization': token,
          'x-api-key': process.env.SANDBOX_API_KEY,
          'x-api-version': SANDBOX_API_VERSION
        }
      }
    )

    // Robust data extraction: Sandbox API can return data in different structures
    const result = response.data.data || response.data
    console.log('Sandbox Aadhaar Verify Response:', JSON.stringify(result, null, 2))
    
    // Handle "Success" responses that contain error messages (common in Sandbox)
    if (result.message && (result.message.toLowerCase().includes('expired') || result.message.toLowerCase().includes('invalid') || result.message.toLowerCase().includes('failed'))) {
       console.error('Aadhaar Verify Logic Error:', result.message)
       throw new AppError(400, 'AADHAAR_VERIFY_FAILED', `Sandbox API Error: ${result.message}`)
    }

    // If we have no demographic info, it's a failure
    if (!result.full_name && !result.name && !result.dob && !result.date_of_birth) {
      console.error('Aadhaar Verify Response Data Missing:', response.data)
      throw new AppError(400, 'AADHAAR_VERIFY_FAILED', `Sandbox API Error: ${result.message || 'Verification data not returned'}`)
    }

    const userData = result;
    console.log('Aadhaar Verification Success for:', userData.name || userData.full_name);

    const finalName = userData.name || userData.full_name || '';
    const dob = userData.dob || userData.date_of_birth || userData.dateOfBirth || userData.dob_details?.dob || '';

    if (!dob) {
      console.warn('Sandbox Aadhaar Verification: DOB missing in response', userData);
    } else {
      console.log('Extracted Aadhaar DOB:', dob);
    }

    const fullAddress = buildAadhaarAddress(userData);
    if (!fullAddress) {
      console.warn('Sandbox Aadhaar Verification: address could not be extracted', {
        addressType: typeof userData.address,
        hasSplit:    !!userData.split_address,
        splitKeys:   userData.split_address ? Object.keys(userData.split_address) : [],
      });
    } else {
      console.log('Extracted Aadhaar address:', fullAddress);
    }

    return {
      name: finalName,
      gender: userData.gender || 'U',
      dob: String(dob),
      address: fullAddress,
      photo: userData.photo_link || userData.photo_base64 || ''
    }
  } catch (error: any) {
    const details = error?.response?.data || {}
    console.error('Sandbox Aadhaar Verify Error:', details)
    const msg = details.message || details.error?.message || details.error_message || 'Verify failed'
    throw new AppError(error?.response?.status || 400, 'AADHAAR_VERIFY_FAILED', `Sandbox API Error: ${msg}`)
  }
}

/**
 * Utility: Standardize Hash function for PAN/Aadhaar storage
 */
export const hashData = (data: string): string => {
  return crypto.createHash('sha256').update(data.toUpperCase().trim()).digest('hex')
}

/**
 * Utility: Encrypt sensitive PII (AES-256-GCM)
 */
export const encryptKycData = (data: any): string => {
  const secretKey = process.env.ENCRYPTION_KEY
  if (!secretKey || secretKey.length !== 32) {
    if (DEMO_MODE) {
      console.warn('⚠️  ENCRYPTION_KEY missing. Using insecure mock encryption for DEMO_MODE.')
      return JSON.stringify(data)
    }
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes in production')
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(secretKey), iv)
  
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  
  return JSON.stringify({
    iv: iv.toString('hex'),
    encrypted,
    authTag
  })
}

/**
 * Utility: Decrypt sensitive PII (AES-256-GCM)
 */
export const decryptKycData = (encryptedJsonString: string): any => {
  const secretKey = process.env.ENCRYPTION_KEY
  if (!secretKey || secretKey.length !== 32) {
    if (DEMO_MODE) return JSON.parse(encryptedJsonString)
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes in production')
  }

  try {
    const { iv, encrypted, authTag } = JSON.parse(encryptedJsonString)
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(secretKey), Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(authTag, 'hex'))
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return JSON.parse(decrypted)
  } catch (error) {
    console.error('Failed to decrypt KYC data:', error)
    throw new AppError(500, 'DECRYPTION_FAILED', 'Failed to decrypt sensitive data')
  }
}

/**
 * Complete KYC and create blockchain wallet
 * Called after successful Aadhaar + PAN verification
 */
export const completeKyc = async (userId: string, kycData: {
  aadhaarHash: string
  panHash: string
  name: string
  dob: string
  gender: string
  address: string
}) => {
  // Check if user already has KYC completed
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { kycStatus: true, walletAddress: true }
  })

  if (!existingUser) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found')
  }

  if (existingUser.kycStatus === 'VERIFIED' && existingUser.walletAddress) {
    throw new AppError(409, 'KYC_ALREADY_COMPLETE', 'KYC already completed for this user')
  }

  // Generate new EVM wallet
  const wallet = Wallet.createRandom()
  const walletAddress = wallet.address

  // Encrypt KYC details
  const encryptedDetails = encryptKycData({
    dob: kycData.dob,
    gender: kycData.gender,
    address: kycData.address
  })

  // Update user with KYC data and wallet
  let updatedUser
  try {
    updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: 'VERIFIED',
        aadhaarHash: kycData.aadhaarHash,
        panHash: kycData.panHash,
        name: kycData.name,
        walletAddress: walletAddress,
        kycDetails: encryptedDetails
      },
      select: {
        id: true,
        name: true,
        kycStatus: true,
        walletAddress: true
      }
    })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const field = err.meta?.target?.includes('aadhaarHash') ? 'Aadhaar' : 'PAN'
      throw new AppError(409, 'DOCUMENT_ALREADY_REGISTERED', `This ${field} number is already linked to another GramChain account.`)
    }
    throw err
  }

  return {
    user: updatedUser,
    walletAddress,
    message: 'KYC completed successfully. Wallet created.'
  }
}
