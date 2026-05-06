import { Router } from 'express'
import * as BankController from '@/controllers/bank.controller'

const router = Router()

// POST /bank/initiate - Start bank linking with mock SMS
router.post('/initiate', BankController.initiateBankLinking)

// POST /bank/verify - Verify SMS OTP and complete linking
router.post('/verify', BankController.verifyBankLinking)

// GET /bank/accounts - List linked accounts
router.get('/accounts', BankController.getBankAccounts)

// DELETE /bank/accounts/:id - Unlink account
router.delete('/accounts/:id', BankController.deleteBankAccount)

export default router
