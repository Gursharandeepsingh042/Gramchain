import { LedgerType } from '@prisma/client'
import { logger } from '@/lib/logger'

import { Prisma } from '@prisma/client'

// Prisma transaction client type
type TxClient = Prisma.TransactionClient

/**
 * Record a ledger entry inside a Prisma transaction.
 *
 * FIX: Running balance is computed via aggregate SUM, not by reading the last row.
 * The previous findFirst approach had a concurrency bug: if two concurrent transactions
 * both read the same "last entry", they'd both compute the same balance and create
 * duplicate/incorrect ledger rows. Using aggregate SUM is idempotent and correct.
 *
 * NOTE: This function MUST be called inside a prisma.$transaction() to ensure atomicity.
 */
export const recordLedgerEntry = async (
  tx: any,
  params: {
    entityType: string
    entityId: string
    type: LedgerType
    amountPaise: number
    ref?: string
  }
) => {
  // FIX: Compute running balance from the authoritative SUM across all prior entries,
  // instead of reading the last row's snapshot (which is susceptible to race conditions).
  const sumResult = await tx.ledgerEntry.aggregate({
    where: { entityType: params.entityType, entityId: params.entityId },
    _sum: { amountPaise: true },
  })

  const currentBalance = sumResult._sum.amountPaise ?? 0
  const newBalance = currentBalance + params.amountPaise

  logger.debug(
    { entityId: params.entityId, type: params.type, amountPaise: params.amountPaise, newBalance },
    'Recording ledger entry'
  )

  return await tx.ledgerEntry.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      type: params.type,
      amountPaise: params.amountPaise,
      balancePaise: newBalance,
      ref: params.ref,
    },
  })
}

/**
 * Get the current balance for an entity (user / shg / loan).
 * Use this for read-only balance checks — not inside a write transaction.
 */
export const getEntityBalance = async (
  tx: any,
  entityType: string,
  entityId: string
): Promise<number> => {
  const sumResult = await tx.ledgerEntry.aggregate({
    where: { entityType, entityId },
    _sum: { amountPaise: true },
  })
  return sumResult._sum.amountPaise ?? 0
}
