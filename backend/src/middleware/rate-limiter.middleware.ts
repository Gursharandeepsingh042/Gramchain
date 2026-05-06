/**
 * SEC5 + SEC6: Route-specific rate limiters for sensitive endpoints.
 * These are stricter than the global 100 req/min API limiter in index.ts.
 */

import rateLimit from 'express-rate-limit'

/**
 * SEC5: KYC PAN verification — 5 requests per minute per user.
 * Prevents API quota burn on Sandbox/production KYC provider.
 */
export const kycPanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req: any) => req.userId || req.ip,
  message: {
    success: false,
    error: {
      code: 'KYC_RATE_LIMIT',
      message: 'Too many PAN verification attempts. Try again after 1 minute.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * SEC5: KYC Aadhaar OTP — 3 requests per minute per user.
 * Aadhaar OTP is more sensitive (costs real money per API call).
 */
export const kycAadhaarLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  keyGenerator: (req: any) => req.userId || req.ip,
  message: {
    success: false,
    error: {
      code: 'KYC_RATE_LIMIT',
      message: 'Too many Aadhaar OTP requests. Try again after 1 minute.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * SEC6: Loan apply — 3 requests per minute per user.
 * Prevents spam loan applications.
 */
export const loanApplyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  keyGenerator: (req: any) => req.userId || req.ip,
  message: {
    success: false,
    error: {
      code: 'LOAN_RATE_LIMIT',
      message: 'Too many loan applications. Try again after 1 minute.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
})
