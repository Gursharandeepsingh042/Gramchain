/**
 * KYC Reminder Job — GramChain
 * 
 * Sends FCM push notifications to users with pending KYC every 6 hours.
 * Only sends reminders to users who haven't received one in the last 6 hours.
 */

import { Queue, Worker, Job } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { sendPushNotification } from '@/services/notification.service'
import { logger } from '@/lib/logger'

const REMINDER_INTERVAL_HOURS = 6
const REMINDER_INTERVAL_MS = REMINDER_INTERVAL_HOURS * 60 * 60 * 1000

export const kycReminderQueue = redisConnection
  ? new Queue('kyc-reminder', { connection: redisConnection })
  : null

/**
 * Find users with pending KYC who need reminders
 */
async function getPendingKycUsers(): Promise<Array<{ id: string; name: string | null }>> {
  const sixHoursAgo = new Date(Date.now() - REMINDER_INTERVAL_MS)

  const users = await prisma.user.findMany({
    where: {
      kycStatus: 'PENDING',
      OR: [
        { lastKycReminderAt: null },
        { lastKycReminderAt: { lt: sixHoursAgo } }
      ]
    },
    select: {
      id: true,
      name: true
    }
  })

  return users
}

/**
 * Send KYC reminder notification to a user
 */
async function sendKycReminder(userId: string, userName: string | null): Promise<void> {
  const title = 'Complete Your KYC'
  const body = userName 
    ? `Hi ${userName}, please complete your KYC to access all GramChain features.`
    : 'Please complete your KYC to access all GramChain features.'

  await sendPushNotification(userId, title, body, {
    type: 'KYC_REMINDER',
    screen: '/(auth)/kyc'
  })
}

/**
 * Update user's last reminder timestamp
 */
async function updateReminderTimestamp(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastKycReminderAt: new Date() }
  })
}

/**
 * Main job handler — runs every 6 hours
 */
async function processKycReminders(): Promise<void> {
  logger.info('[KYC Reminder] Starting reminder job...')

  try {
    const users = await getPendingKycUsers()
    
    if (users.length === 0) {
      logger.info('[KYC Reminder] No users need reminders at this time')
      return
    }

    logger.info(`[KYC Reminder] Found ${users.length} users with pending KYC`)

    let successCount = 0
    let failCount = 0

    for (const user of users) {
      try {
        await sendKycReminder(user.id, user.name)
        await updateReminderTimestamp(user.id)
        successCount++
        
        // Small delay to prevent overwhelming FCM
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        logger.error({ userId: user.id, error }, '[KYC Reminder] Failed to send reminder')
        failCount++
      }
    }

    logger.info(`[KYC Reminder] Job complete. Sent: ${successCount}, Failed: ${failCount}`)
  } catch (error) {
    logger.error({ error }, '[KYC Reminder] Job failed')
  }
}

/**
 * Start the KYC reminder cron job
 * Runs every 6 hours
 */
export function startKycReminderJob(): void {
  if (!kycReminderQueue) {
    logger.warn('[KYC Reminder] Redis not available, job not started')
    return
  }

  // Create worker to process jobs
  const worker = new Worker(
    'kyc-reminder',
    async (_job: Job) => {
      await processKycReminders()
    },
    { connection: redisConnection! }
  )

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, '[KYC Reminder] Worker completed')
  })

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, '[KYC Reminder] Worker failed')
  })

  // Schedule recurring job (every 6 hours)
  kycReminderQueue.add(
    'send-reminders',
    {},
    {
      repeat: {
        pattern: '0 */6 * * *' // Every 6 hours at minute 0
      }
    }
  )

  logger.info('[KYC Reminder] Job scheduled to run every 6 hours')
}

/**
 * Trigger immediate reminder check (useful for testing)
 */
export async function triggerImmediateReminder(): Promise<void> {
  await processKycReminders()
}
