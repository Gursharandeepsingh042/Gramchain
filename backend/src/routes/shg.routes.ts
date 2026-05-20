import { Router } from 'express'
import * as SHGController from '@/controllers/shg.controller'

const router = Router()

/** @route GET /shg/my */
router.get('/my', SHGController.getMySHGs)

/** @route GET /shg */
router.get('/', SHGController.listSHGs)

/** @route POST /shg */
router.post('/', SHGController.createSHG)

/** @route GET /shg/:id */
router.get('/:id', SHGController.getSHG)

/** @route POST /shg/:id/join */
router.post('/:id/join', SHGController.joinSHG)

/** @route GET /shg/:id/meetings */
router.get('/:id/meetings', SHGController.getMeetings)

/** @route POST /shg/:id/meetings */
router.post('/:id/meetings', SHGController.logMeeting)

/** @route POST /shg/:id/invite - Generate invite code */
router.post('/:id/invite', SHGController.generateInviteCode)

/** @route DELETE /shg/:id/members/:userId - Remove member (leader only) */
router.delete('/:id/members/:userId', SHGController.removeMember)

/** @route POST /shg/:id/dissolve - Leader initiates dissolution vote */
router.post('/:id/dissolve', SHGController.initiateDissolve)

/** @route POST /shg/:id/dissolve/vote - Member casts dissolution vote */
router.post('/:id/dissolve/vote', SHGController.voteDissolve)

/** @route GET /shg/:id/dissolve - Get dissolution vote status */
router.get('/:id/dissolve', SHGController.getDissolveStatus)

/** @route POST /shg/join-by-code - Join by invite code */
router.post('/join-by-code', SHGController.joinByInviteCode)

/** @route DELETE /shg/:id - Delete SHG (leader only, sole member only) */
router.delete('/:id', SHGController.deleteSHG)

export default router
