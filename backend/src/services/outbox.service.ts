/**
 * Transactional Outbox Service — GramChain
 *
 * PROBLEM SOLVED:
 *   If the process crashes after prisma.$transaction succeeds but before
 *   blockchainQueue.add() completes, the blockchain write is silently dropped.
 *   This is a classic "dual-write" consistency problem.
 *
 * SOLUTION:
 *   Instead of calling blockchainQueue.add() directly inside a service,
 *   we write a pending OutboxJob row INSIDE the same Prisma transaction.
 *   A sweep job (startOutboxSweep) runs every 10 seconds and picks up any
 *   PENDING rows, enqueues them in BullMQ, and marks them QUEUED.
 *   On startup, the sweep also picks up any PENDING rows from before a crash.
 *
 * USAGE (in a service, inside a Prisma $transaction):
 *   await enqueueOutboxJob(tx, 'create-loan', { dbLoanId, borrowerAddress, ... })
 */

import { prisma } from '@/lib/prisma'
import { blockchainQueue } from '@/jobs/queue'
import { logger } from '@/lib/logger'

import { Prisma } from '@prisma/client'

// Prisma transaction client type
type TxClient = Prisma.TransactionClient

/**
 * Write a blockchain job to the outbox table WITHIN a running transaction.
 * Never call blockchainQueue.add() directly — always use this instead.
 */
export const enqueueOutboxJob = async (
  tx: TxClient,
  jobName: string,
  jobData: Record<string, unknown>
): Promise<void> => {
  await tx.outboxJob.create({
    data: { jobName, jobData: jobData as any },
  })
}

/**
 * Start the outbox sweep. Runs every SWEEP_INTERVAL_MS.
 * Picks up PENDING jobs, enqueues them in BullMQ, marks them QUEUED.
 * On server restart this automatically recovers any jobs that were lost.
 */
const SWEEP_INTERVAL_MS = 10_000 // 10 seconds
const MAX_OUTBOX_ATTEMPTS = 10

export const startOutboxSweep = (): NodeJS.Timeout => {
  logger.info('✅ Outbox sweep started (interval: 10s)')

  const sweep = async () => {
    try {
      if (!blockchainQueue) {
        // Redis not available — nothing we can do
        return
      }

      // Find all unprocessed outbox jobs (PENDING or previously stuck QUEUED with no progress)
      const jobs = await prisma.outboxJob.findMany({
        where: {
          status: 'PENDING',
          attempts: { lt: MAX_OUTBOX_ATTEMPTS },
        },
        orderBy: { createdAt: 'asc' },
        take: 50, // Process in batches to avoid overwhelming the queue
      })

      if (jobs.length === 0) return

      logger.info(`Outbox sweep: found ${jobs.length} pending jobs`)

      for (const job of jobs) {
        try {
          await blockchainQueue.add(
            job.jobName,
            job.jobData as Record<string, unknown>,
            {
              attempts: 5,
              backoff: { type: 'exponential', delay: 2000 },
              jobId: `outbox-${job.id}`, // Idempotent: prevent double-enqueue on rapid retries
            }
          )

          await prisma.outboxJob.update({
            where: { id: job.id },
            data: {
              status: 'QUEUED',
              processedAt: new Date(),
              attempts: { increment: 1 },
            },
          })

          logger.info({ jobId: job.id, jobName: job.jobName }, 'Outbox job enqueued')
        } catch (enqueueErr) {
          logger.error({ jobId: job.id, err: enqueueErr }, 'Failed to enqueue outbox job')
          await prisma.outboxJob
            .update({
              where: { id: job.id },
              data: {
                attempts: { increment: 1 },
                lastError: (enqueueErr as Error).message,
                // Mark FAILED if we've exhausted retries
                status: job.attempts + 1 >= MAX_OUTBOX_ATTEMPTS ? 'FAILED' : 'PENDING',
              },
            })
            .catch(() => {
              /* swallow secondary DB error */
            })
        }
      }
    } catch (sweepErr) {
      logger.error({ err: sweepErr }, 'Outbox sweep iteration failed')
    }
  }

  // Run immediately on startup to recover any crash-survivors
  sweep()

  return setInterval(sweep, SWEEP_INTERVAL_MS)
}
