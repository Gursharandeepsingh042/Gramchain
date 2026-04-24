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

export default router
