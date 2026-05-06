import { Queue } from 'bullmq'
import { redisConnection } from '@/lib/redis'

// Blockchain writes queue (disburse, repay)
export const blockchainQueue = redisConnection 
  ? new Queue('blockchain-writer', { connection: redisConnection })
  : null;

// Cron job queues
export const defaultCheckerQueue = redisConnection
  ? new Queue('default-checker', { connection: redisConnection })
  : null;

export const repaymentReminderQueue = redisConnection
  ? new Queue('repayment-reminder', { connection: redisConnection })
  : null;
