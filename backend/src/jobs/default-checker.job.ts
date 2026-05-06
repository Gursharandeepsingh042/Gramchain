import { Worker, Job } from 'bullmq'
import { redisConnection } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { checkDefaultOnChain } from '@/services/blockchain.service'
import { recordLedgerEntry } from '@/services/ledger.service'
import { defaultCheckerQueue } from './queue'
import { logger } from '@/lib/logger'

export const startDefaultCheckerJob = async () => {
  if (process.env.DEMO_MODE === 'true') {
    logger.info('✅ [DEMO] Default checker cron job mocked.')
    return
  }

  if (!redisConnection) return

  const worker = new Worker('default-checker', async (job: Job) => {
    logger.info({ jobId: job.id }, 'Processing default checker job')
    
    // Find loans where nextEmiDue + 30 days < now
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const overdueLoans = await prisma.loan.findMany({
      where: {
        status: 'ACTIVE',
        nextEmiDue: {
          lt: thirtyDaysAgo
        }
      }
    })

    logger.info({ count: overdueLoans.length }, `Found ${overdueLoans.length} loans severely overdue.`)

    for (const loan of overdueLoans) {
      if (!loan.contractLoanId) continue;

      try {
        const { defaulted, txHash } = await checkDefaultOnChain(loan.contractLoanId)
        
        if (defaulted) {
          // Wrap DB update and Ledger write-off in transaction
          await prisma.$transaction(async (tx) => {
            await tx.loan.update({
              where: { id: loan.id },
              data: { status: 'DEFAULTED' }
            })

            const remainingBalancePaise = Math.round(Number(loan.amount) * 100) // simplified
            
            await recordLedgerEntry(tx, {
              entityType: 'loan',
              entityId: loan.id,
              type: 'DEFAULT_WRITEOFF',
              amountPaise: remainingBalancePaise,
              ref: `default-${loan.id}-${txHash || 'local'}`
            })
          })

          logger.warn({ loanId: loan.id, txHash }, '🚨 Loan marked as DEFAULTED.')
        }
      } catch (err) {
        logger.error({ loanId: loan.id, err }, '❌ Failed to check default for loan')
      }
    }
  }, {
    connection: redisConnection
  })

  // Schedule the cron job (Midnight daily)
  if (defaultCheckerQueue) {
    await defaultCheckerQueue.add('daily-default-check', {}, {
      repeat: { pattern: '0 0 * * *' }
    }).catch((err) => logger.error({ err }, 'Failed to schedule default checker cron'))
  }

  logger.info('✅ Default checker job started (Cron: 0 0 * * *)')
  return worker
}
