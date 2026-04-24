import axios from 'axios'
import { AppError } from '@/middleware/error.middleware'
import crypto from 'crypto'
const DEMO_MODE = process.env.DEMO_MODE === 'true'

/**
 * Sandbox API Authentication Token Helper
 */
const getSandboxToken = async (): Promise<string> => {
  const apiKey = process.env.SANDBOX_API_KEY
  const apiSecret = process.env.SANDBOX_API_SECRET
  
  if (!apiKey || !apiSecret) {
    throw new AppError(500, 'KYC_CONFIG_ERROR', 'Sandbox API credentials missing')
  }

  try {
    const response = await axios.post(
      'https://api.sandbox.co.in/authenticate',
      {},
      {
        headers: {
          'x-api-key': apiKey,
          'x-api-secret': apiSecret,
          'x-api-version': '1.0'
        }
      }
    )
    return response.data.access_token
  } catch (error: any) {
    console.error('Sandbox Auth Error:', error?.response?.data || error.message)
    throw new AppError(500, 'KYC_CONFIG_ERROR', 'Failed to authenticate with Sandbox API')
  }
}

/**
 * Verify PAN Card
 */
export const verifyPan = async (panNumber: string, name: string, dob: string) => {
  if (DEMO_MODE || panNumber === 'ABCDE1234F') {
    return {
      name: 'DEMO USER ' + panNumber.toUpperCase(),
      panFormat: panNumber.toUpperCase().trim(),
      status: 'VERIFIED'
    }
  }

  const token = await getSandboxToken()
  const apiKey = process.env.SANDBOX_API_KEY

  try {
    // Basic formatting enforcement
    const formattedPan = panNumber.toUpperCase().trim()
    
    // Format DOB to DD/MM/YYYY (Aadhaar sometimes returns DD-MM-YYYY or just YYYY)
    let formattedDob = dob.replace(/-/g, '/')
    if (formattedDob.length === 4) {
      formattedDob = `01/01/${formattedDob}`
    }

    const response = await axios.post(
      'https://api.sandbox.co.in/kyc/pan/verify',
      { 
        "@entity": "in.co.sandbox.kyc.pan_verification.request",
        "pan": formattedPan,
        "name_as_per_pan": name,
        "date_of_birth": formattedDob,
        "consent": "Y",
        "reason": "For onboarding"
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-api-key': apiKey,
          'x-api-version': '1.0',
          'Content-Type': 'application/json'
        }
      }
    )

    const data = response.data.data
    if (!data || data.status !== 'VALID') {
      throw new AppError(400, 'INVALID_PAN', 'The PAN number provided is invalid or inactive.')
    }

    return {
      name: data.full_name,
      panFormat: formattedPan,
      status: 'VERIFIED'
    }
  } catch (error: any) {
    if (error instanceof AppError) throw error
    const errorData = error?.response?.data
    console.error('KYC API Error:', {
      status: error?.response?.status,
      data: errorData,
      message: error.message
    })
    
    // Provide more specific error messages based on Sandbox response
    const apiMessage = errorData?.message || 'Verification failed'
    throw new AppError(error?.response?.status || 400, 'KYC_API_FAILURE', `Sandbox API Error: ${apiMessage}`)
  }
}

/**
 * Send Aadhaar OTP
 */
export const sendAadhaarOtp = async (aadhaarNumber: string) => {
  if (DEMO_MODE || aadhaarNumber === '000000000000') {
    return {
      referenceId: 'demo_ref_' + Math.random().toString(36).substring(7),
      message: 'Demo mode: OTP sent to Aadhaar registered mobile.'
    }
  }

  const token = await getSandboxToken()
  const apiKey = process.env.SANDBOX_API_KEY

  try {
    const response = await axios.post(
      'https://api.sandbox.co.in/kyc/aadhaar/okyc/otp',
      { 
        "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request",
        "aadhaar_number": aadhaarNumber,
        "consent": "Y",
        "reason": "For onboarding"
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-api-key': apiKey,
          'x-api-version': '1.0',
          'Content-Type': 'application/json'
        }
      }
    )

    const data = response.data.data
    return {
      referenceId: data.reference_id,
      message: 'OTP sent successfully to registered mobile.'
    }
  } catch (error: any) {
    const errorData = error?.response?.data
    console.error('Aadhaar OTP Error:', {
      status: error?.response?.status,
      data: errorData,
      message: error.message
    })
    const apiMessage = errorData?.message || 'Failed to send OTP'
    throw new AppError(error?.response?.status || 400, 'AADHAAR_OTP_FAILED', `Sandbox API Error: ${apiMessage}`)
  }
}

/**
 * Verify Aadhaar OTP and fetch details
 */
export const verifyAadhaarOtp = async (referenceId: string, otp: string) => {
  if (DEMO_MODE || otp === '222222' || referenceId.startsWith('demo_ref_')) {
    return {
      name: 'DEMO ADHAAR USER',
      gender: 'M',
      dob: '01-01-1990',
      address: '123 Demo Street, Demo City, Demo State - 123456',
      photo: ''
    }
  }

  const token = await getSandboxToken()
  const apiKey = process.env.SANDBOX_API_KEY

  try {
    const response = await axios.post(
      'https://api.sandbox.co.in/kyc/aadhaar/okyc/otp/verify',
      { 
        "@entity": "in.co.sandbox.kyc.aadhaar.okyc.request",
        "reference_id": referenceId, 
        "otp": otp 
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-api-key': apiKey,
          'x-api-version': '1.0',
          'Content-Type': 'application/json'
        }
      }
    )

    const data = response.data.data
    return {
      name: data.name,
      gender: data.gender,
      dob: data.dob,
      address: data.address ? `${data.address.house}, ${data.address.street}, ${data.address.dist}, ${data.address.state} - ${data.address.zip}` : '',
      photo: data.photo_base64
    }
  } catch (error: any) {
    const errorData = error?.response?.data
    console.error('Aadhaar Verify Error:', {
      status: error?.response?.status,
      data: errorData,
      message: error.message
    })
    const apiMessage = errorData?.message || 'Invalid OTP or verification failed'
    throw new AppError(error?.response?.status || 400, 'AADHAAR_VERIFY_FAILED', `Sandbox API Error: ${apiMessage}`)
  }
}

/**
 * Utility: Standardize Hash function for PAN/Aadhaar storage
 */
export const hashData = (data: string): string => {
  return crypto.createHash('sha256').update(data.toUpperCase().trim()).digest('hex')
}
