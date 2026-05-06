import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from '@/middleware/auth.middleware'
import { sendSuccess, sendError } from '@/utils/response'
import * as NotificationService from '@/services/notification.service'

/**
 * GET /notifications
 * Returns paginated in-app notifications for the authenticated user.
 */
export const getNotifications = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const skip = parseInt((req.query.skip as string) || '0', 10)
    const take = parseInt((req.query.take as string) || '30', 10)
    const result = await NotificationService.getUserNotifications(req.userId!, skip, take)
    sendSuccess(res, result)
  } catch (error) {
    next(error)
  }
}

/**
 * PATCH /notifications/read
 * Mark all unread notifications as read for the authenticated user.
 */
export const markAllRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await NotificationService.markNotificationsRead(req.userId!)
    sendSuccess(res, { message: 'All notifications marked as read' })
  } catch (error) {
    next(error)
  }
}

/**
 * PATCH /notifications/:id/read
 * Mark a single notification as read.
 */
export const markOneRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string
    if (!id) { sendError(res, 'MISSING_ID', 'Notification id is required'); return }
    await NotificationService.markNotificationsRead(req.userId!, id)
    sendSuccess(res, { message: 'Notification marked as read' })
  } catch (error) {
    next(error)
  }
}
