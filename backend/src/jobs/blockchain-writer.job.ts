/**
 * Blockchain Writer Worker — GramChain
 *
 * Processes jobs from the 'blockchain-writer' BullMQ queue.
 * All jobs originate from the OutboxJob table (via outbox.service.ts sweep),
 * ensuring they survive process crashes.
 *
 * CONCURRENCY = 1 to prevent nonce collisions on the single backend signer.
 *
 * RACE CONDITION FIX (approve-loan):
 *   When a leader approves a loan immediately after creation, contractLoanId
 *   may not yet be populated (the create-loan job might still be in flight).
 *   The worker now looks up the current contractLoanId from the DB at job-time,
 *   retrying up to the job's attempt limit until it becomes available.
 */

import { Worker, Job } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import {
  createLoanOnChain,
  markDisbursedOnChain,
  markEmiPaidOnChain,
  approveLoanOnChain,
  recordScoreOnChain,
  addPoolMemberOnChain,
  removePoolMemberOnChain,
  grantLeaderRoleOnChain,
  revokeLeaderRoleOnChain,
} from '@/services/blockchain.service'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const startBlockchainWriterWorker = () => {
  if (!redisConnection) return

  const worker = new Worker(
    'blockchain-writer',
    async (job: Job) => {
      logger.info({ jobId: job.id, jobName: job.name }, 'Processing blockchain write job')

      switch (job.name) {
        // ── Create Loan ────────────────────────────────────────
        case 'create-loan': {
          const { dbLoanId, borrowerAddress, principalPaise, interestRateBps, tenureMonths, shgPoolId } =
            job.data

          const result = await createLoanOnChain({
            borrowerAddress,
            principalPaise,
            interestRateBps,
            tenureMonths,
            shgPoolId,
          })

          await prisma.loan.update({
            where: { id: dbLoanId },
            data: {
              contractLoanId: result.contractLoanId,
              txHash: result.txHash,
              isSyncedOnChain: true,
            },
          })

          logger.info({ dbLoanId, contractLoanId: result.contractLoanId }, '✅ On-chain loan created')
          break
        }

        // ── Approve Loan ───────────────────────────────────────
        // FIX: Race condition handled here.
        // If contractLoanId is null (create-loan job not yet complete),
        // we look it up from DB and throw to trigger a BullMQ retry.
        case 'approve-loan': {
          const { dbLoanId, leaderAddress } = job.data
          let { contractLoanId } = job.data

          // If not provided or null, look it up from DB
          if (!contractLoanId) {
            const loan = await prisma.loan.findUnique({
              where: { id: dbLoanId },
              select: { contractLoanId: true, isSyncedOnChain: true },
            })

            if (!loan?.contractLoanId || !loan.isSyncedOnChain) {
              // The create-loan job hasn't finished yet. Throw to trigger exponential backoff retry.
              throw new Error(
                `contractLoanId not yet available for dbLoanId=${dbLoanId}. Will retry.`
              )
            }

            contractLoanId = loan.contractLoanId
          }

          const result = await approveLoanOnChain(contractLoanId, leaderAddress)
          logger.info({ contractLoanId, txHash: result.txHash }, '✅ On-chain approval marked')
          break
        }

        // ── Mark Disbursed ─────────────────────────────────────
        case 'mark-disbursed': {
          const { contractLoanId, ref } = job.data
          const result = await markDisbursedOnChain(contractLoanId, ref)
          logger.info({ contractLoanId, txHash: result.txHash }, '✅ On-chain disbursal marked')
          break
        }

        // ── Mark EMI Paid ──────────────────────────────────────
        case 'mark-emi': {
          const { contractLoanId, upiRef } = job.data
          const result = await markEmiPaidOnChain(contractLoanId, upiRef)
          logger.info({ contractLoanId, txHash: result.txHash }, '✅ On-chain EMI marked')
          break
        }

        // ── Record ML Score ────────────────────────────────────
        case 'record-score': {
          const { memberAddress, score, riskBand, modelVersion } = job.data
          const result = await recordScoreOnChain({ memberAddress, score, riskBand, modelVersion })
          logger.info({ memberAddress, txHash: result.txHash }, '✅ On-chain ML score recorded')
          break
        }

        // ── Sync SHGPool membership (off-chain → on-chain) ─────
        case 'add-pool-member': {
          const { poolAddress, memberAddress } = job.data
          if (!poolAddress || !memberAddress) {
            logger.warn({ jobId: job.id }, 'add-pool-member missing poolAddress/memberAddress — skipping')
            break
          }
          const result = await addPoolMemberOnChain(poolAddress, memberAddress)
          logger.info({ poolAddress, memberAddress, txHash: result.txHash }, '✅ On-chain pool member added')
          break
        }

        case 'remove-pool-member': {
          const { poolAddress, memberAddress } = job.data
          if (!poolAddress || !memberAddress) {
            logger.warn({ jobId: job.id }, 'remove-pool-member missing poolAddress/memberAddress — skipping')
            break
          }
          const result = await removePoolMemberOnChain(poolAddress, memberAddress)
          logger.info({ poolAddress, memberAddress, txHash: result.txHash }, '✅ On-chain pool member removed')
          break
        }

        // ── Sync GROUP_LEADER_ROLE on LoanManager ──────────────
        case 'grant-leader-role': {
          const { leaderAddress } = job.data
          if (!leaderAddress) {
            logger.warn({ jobId: job.id }, 'grant-leader-role missing leaderAddress — skipping')
            break
          }
          const result = await grantLeaderRoleOnChain(leaderAddress)
          logger.info({ leaderAddress, txHash: result.txHash }, '✅ On-chain leader role granted')
          break
        }

        case 'revoke-leader-role': {
          const { leaderAddress } = job.data
          if (!leaderAddress) {
            logger.warn({ jobId: job.id }, 'revoke-leader-role missing leaderAddress — skipping')
            break
          }
          const result = await revokeLeaderRoleOnChain(leaderAddress)
          logger.info({ leaderAddress, txHash: result.txHash }, '✅ On-chain leader role revoked')
          break
        }

        default:
          logger.warn({ jobName: job.name }, 'Unknown blockchain writer job name — skipping')
      }
    },
    {
      connection: redisConnection,
      concurrency: 1, // MUST be 1 to prevent nonce collisions on single signer wallet
    }
  )

  // ── Dead-letter handler ──────────────────────────────────────
  worker.on('failed', async (job, err) => {
    logger.error({ jobId: job?.id, jobName: job?.name, err: err.message }, '🚨 Job failed after all retries')

    if (job) {
      try {
        await prisma.failedBlockchainJob.create({
          data: {
            jobName: job.name,
            jobData: job.data,
            error: err.message,
          },
        })
      } catch (dbErr) {
        logger.error({ err: dbErr }, 'Failed to save dead-letter job to DB')
      }
    }
  })

  logger.info('✅ Blockchain writer worker started (concurrency=1)')
  return worker
}
