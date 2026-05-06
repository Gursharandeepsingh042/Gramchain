import { Router } from 'express'
import * as NotificationController from '@/controllers/notification.controller'

const router = Router()

/** @route GET /notifications */
router.get('/', NotificationController.getNotifications)

/** @route PATCH /notifications/read  — mark ALL as read */
router.patch('/read', NotificationController.markAllRead)

/** @route PATCH /notifications/:id/read */
router.patch('/:id/read', NotificationController.markOneRead)

export default router
