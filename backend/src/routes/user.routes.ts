import { Router } from 'express'
import { authenticate } from '@/middleware/auth.middleware'
import { updateProfile, getBorrowers, getLenders } from '@/controllers/user.controller'

const router = Router()

router.use(authenticate)

/** @route PATCH /user/profile */
router.patch('/profile', updateProfile)

/** @route GET /user/borrowers */
router.get('/borrowers', getBorrowers)

/** @route GET /user/lenders */
router.get('/lenders', getLenders)

export default router
