import { Worker, Job } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { repaymentReminderQueue } from './queue'
import { sendPushNotification } from '@/services/notification.service'
import { logger } from '@/lib/logger'

export const startRepaymentReminderJob = async () => {
  if (process.env.DEMO_MODE === 'true') {
    logger.info('✅ [DEMO] Repayment reminder cron job mocked.')
    return
  }

  if (!redisConnection) return

  const worker = new Worker(
    'repayment-reminder',
    async (_job: Job) => {
      // FIX: Find loans due within the next 3 days
      const now = new Date()
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)

      const loans = await prisma.loan.findMany({
        where: {
          status: 'ACTIVE',
          nextEmiDue: {
            gte: now,               // Has not passed yet
            lte: threeDaysFromNow,  // Due within 3 days
          },
        },
        select: {
          id: true,
          memberId: true,
          emiAmount: true,
          amount: true,
          nextEmiDue: true,
        },
      })

      logger.info(`Repayment reminder: found ${loans.length} loans due soon.`)

      for (const loan of loans) {
        const amount = loan.emiAmount ?? loan.amount
        const amountStr = `₹${Number(amount).toLocaleString('en-IN')}`
        const dueDateStr = loan.nextEmiDue?.toLocaleDateString('en-IN') ?? 'soon'

        await sendPushNotification(
          loan.memberId,
          '⏰ EMI Reminder',
          `Your EMI of ${amountStr} is due on ${dueDateStr}. Please ensure funds are available.`,
          { loanId: loan.id, type: 'EMI_REMINDER', dueDate: loan.nextEmiDue?.toISOString() ?? '' }
        )
      }
    },
    { connection: redisConnection }
  )

  // Schedule the cron job (9 AM daily IST = 3:30 AM UTC)
  if (repaymentReminderQueue) {
    await repaymentReminderQueue
      .add('daily-reminder', {}, {
        repeat: { pattern: '30 3 * * *' }, // 9:00 AM IST
      })
      .catch(logger.error)
  }

  logger.info('✅ Repayment reminder job started (Cron: 9:00 AM IST daily)')
  return worker
}
