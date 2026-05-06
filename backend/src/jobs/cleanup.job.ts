import cron from 'node-cron'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * Runs daily at 2:00 AM.
 * Cleans up expired OTP records to prevent database bloat.
 */
export const startCleanupJob = () => {
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running nightly OTP cleanup job...')
    try {
      const result = await prisma.otpRecord.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      })
      logger.info(`Cleanup complete. Deleted ${result.count} expired OTP records.`)
    } catch (error) {
      logger.error({ err: error }, 'Nightly OTP cleanup job failed')
    }
  })

  logger.info('✅ Cleanup cron job registered (runs at 02:00 AM)')
}
