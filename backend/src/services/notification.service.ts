/**
 * Notification Service — GramChain
 *
 * Handles both in-app (DB) notifications and FCM push notifications.
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
type NotificationType =
  | 'LOAN_APPROVAL_REQUEST'
  | 'LOAN_APPROVED'
  | 'LOAN_REJECTED'
  | 'LOAN_OPPORTUNITY'
  | 'MEMBER_REMOVED'
  | 'GROUP_INVITE'
  | 'DISSOLUTION_VOTE'
  | 'KYC_REMINDER'
  | 'GENERAL'

const DEMO_MODE = process.env.DEMO_MODE === 'true'

// Lazy-load Firebase Admin to avoid startup errors if env is not configured
let firebaseAdmin: any = null

function getFirebaseAdmin() {
  if (firebaseAdmin) return firebaseAdmin

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) {
    logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications disabled')
    return null
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require('firebase-admin')
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
      })
    }
    firebaseAdmin = admin
    logger.info('✅ Firebase Admin initialized')
    return admin
  } catch (err) {
    logger.error({ err }, 'Failed to initialize Firebase Admin')
    return null
  }
}

/**
 * Send a push notification to a user.
 * Looks up the user's FCM token from the DB if not provided.
 */
export const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> => {
  if (DEMO_MODE) {
    logger.info({ userId, title, body }, '[DEMO] Push notification (not sent)')
    return
  }

  // N4: Quiet Hours Config (10 PM - 7 AM IST)
  const now = new Date()
  const istHours = (now.getUTCHours() + 5 + (now.getUTCMinutes() + 30) / 60) % 24
  if (istHours >= 22 || istHours < 7) {
    logger.info({ userId, title }, 'Quiet hours active: Push notification deferred')
    // TODO: Actually enqueue in BullMQ with delay for 7 AM
    return
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    })

    if (!user?.fcmToken) {
      logger.debug({ userId }, 'No FCM token found for user — skipping push')
      return
    }

    const admin = getFirebaseAdmin()
    if (!admin) return

    await admin.messaging().send({
      token: user.fcmToken,
      notification: { title, body },
      data: data ?? {},
      android: {
        priority: 'high',
        notification: { sound: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    })

    logger.info({ userId, title }, 'Push notification sent')
  } catch (err: any) {
    // If token is stale/invalid, clear it from DB to prevent future failures
    if (
      err?.code === 'messaging/registration-token-not-registered' ||
      err?.code === 'messaging/invalid-registration-token'
    ) {
      logger.warn({ userId }, 'Stale FCM token — clearing from DB')
      await prisma.user.update({
        where: { id: userId },
        data: { fcmToken: null },
      }).catch(() => {})
    } else {
      logger.error({ userId, err }, 'Failed to send push notification')
    }
  }
}

/**
 * Persist an in-app notification to the DB.
 */
export const createNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, any>
) => {
  return prisma.notification.create({
    data: { userId, type: type as any, title, body, data: data ?? undefined }
  })
}

/**
 * Create in-app notification AND send FCM push in one call.
 */
export const notify = async (
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, string>
) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferredLanguage: true } })
  const { getTemplate } = await import('./notification-templates')
  const template = getTemplate(type, user?.preferredLanguage ?? 'en', { ...data, title, body })

  await Promise.all([
    createNotification(userId, type, template.title, template.body, data),
    sendPushNotification(userId, template.title, template.body, data),
  ])
}

/**
 * Fan-out: notify all members of an SHG (except the sender).
 */
export const notifyGroup = async (
  shgId: string,
  excludeUserId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, string>
) => {
  const members = await prisma.sHGMember.findMany({
    where: { shgId, userId: { not: excludeUserId } },
    select: { userId: true }
  })
  await Promise.all(members.map(m => notify(m.userId, type, title, body, data)))
}

/**
 * Fan-out: notify a specific list of user IDs.
 */
export const notifyUsers = async (
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, any>
) => {
  await Promise.all(userIds.map(uid => notify(uid, type, title, body, data as Record<string, string>)))
}

/**
 * Fan-out: notify all lenders (users with LENDER role)
 */
export const notifyLenders = async (
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, string>
) => {
  const lenders = await prisma.user.findMany({
    where: { role: 'LENDER' },
    select: { id: true }
  })
  await Promise.all(lenders.map(l => notify(l.id, type, title, body, data)))
}

/**
 * Get paginated notifications for a user.
 */
export const getUserNotifications = async (userId: string, skip = 0, take = 30) => {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ])
  return { items, unreadCount }
}

/**
 * Mark a notification as read (or all notifications for a user).
 */
export const markNotificationsRead = async (userId: string, notificationId?: string) => {
  if (notificationId) {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true }
    })
  } else {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    })
  }
}
