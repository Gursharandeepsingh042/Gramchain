import { Response, NextFunction } from 'express'
import * as BankService from '@/services/bank.service'
import { sendSuccess, sendError } from '@/utils/response'
import { AuthenticatedRequest } from '@/middleware/auth.middleware'

/**
 * POST /bank/initiate
 * Initiate bank account linking with mock SMS verification
 */
export const initiateBankLinking = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { bankName, accountNumber, ifsc } = req.body
    
    if (!bankName || !accountNumber || !ifsc) {
      sendError(res, 'MISSING_FIELDS', 'bankName, accountNumber, and ifsc are required')
      return
    }

    const result = await BankService.initiateBankLinking({
      userId: req.userId!,
      bankName,
      accountNumber,
      ifsc: ifsc.toUpperCase()
    })

    sendSuccess(res, result, 200)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /bank/verify
 * Verify SMS OTP and complete bank linking
 */
export const verifyBankLinking = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { referenceId, otp } = req.body
    
    if (!referenceId || !otp) {
      sendError(res, 'MISSING_FIELDS', 'referenceId and otp are required')
      return
    }

    const result = await BankService.verifyBankLinking({
      userId: req.userId!,
      referenceId,
      otp
    })

    sendSuccess(res, result, 200)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /bank/accounts
 * Get all linked bank accounts for current user
 */
export const getBankAccounts = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const accounts = await BankService.getUserBankAccounts(req.userId!)
    sendSuccess(res, { accounts })
  } catch (error) {
    next(error)
  }
}

/**
 * DELETE /bank/accounts/:id
 * Unlink a bank account
 */
export const deleteBankAccount = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string
    if (!id) {
      sendError(res, 'MISSING_ACCOUNT_ID', 'Account ID is required')
      return
    }

    const result = await BankService.deleteBankAccount(req.userId!, id)
    sendSuccess(res, result)
  } catch (error) {
    next(error)
  }
}
