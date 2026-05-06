/**
 * Reconcile Worker — B6
 * ────────────────────────────────────────────────────────────
 * Periodically compares the DB's view of each loan with the
 * on-chain LoanManager state. Any discrepancy is recorded as
 * a `DriftAlert` row for ops to investigate.
 *
 * Why we need this:
 *   - Outbox + BullMQ retries minimise drift but can't eliminate it
 *     (e.g. a tx mined but the worker crashed before the DB write).
 *   - On-chain is the legal source of truth; DB lag = silent bug.
 *
 * Schedule: every 30 minutes (configurable via RECONCILE_CRON).
 *
 * Output:
 *   - `DriftAlert` rows in PostgreSQL.
 *   - Slack/Sentry alert on HIGH/CRITICAL severity (handled by
 *     downstream ops tooling watching the table).
 */

import cron from 'node-cron'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getLoanFromChain } from '@/services/blockchain.service'

const RECONCILE_CRON = process.env.RECONCILE_CRON ?? '*/30 * * * *' // every 30 min
const RECONCILE_BATCH = 100

// LoanStatus enum on the contract (must match Solidity)
const STATUS_DB_TO_CHAIN: Record<string, number> = {
  PENDING:   0,
  APPROVED:  1,
  ACTIVE:    2,
  REPAID:    3,
  DEFAULTED: 4,
}

interface DriftFinding {
  field:      string
  dbValue:    string
  chainValue: string
  severity:   'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

/**
 * Compare a single loan record against on-chain state.
 * Returns an array of drift findings (empty if everything matches).
 */
async function reconcileLoan(loan: {
  id: string
  contractLoanId: number | null
  status: string
  emisPaid: number
  isSyncedOnChain: boolean
}): Promise<DriftFinding[]> {
  if (!loan.contractLoanId || !loan.isSyncedOnChain) return []

  const onChain = await getLoanFromChain(loan.contractLoanId)
  if (!onChain) {
    return [{
      field:      'existence',
      dbValue:    'present',
      chainValue: 'missing',
      severity:   'CRITICAL',
    }]
  }

  const findings: DriftFinding[] = []

  // ── status ──────────────────────────────────────────────
  const expectedChainStatus = STATUS_DB_TO_CHAIN[loan.status]
  if (expectedChainStatus !== undefined && expectedChainStatus !== onChain.status) {
    findings.push({
      field:      'status',
      dbValue:    loan.status,
      chainValue: String(onChain.status),
      // Status drift is severe because it changes who-owes-what
      severity:   'HIGH',
    })
  }

  // ── emisPaid ────────────────────────────────────────────
  if (loan.emisPaid !== onChain.emisPaid) {
    findings.push({
      field:      'emisPaid',
      dbValue:    String(loan.emisPaid),
      chainValue: String(onChain.emisPaid),
      // EMI count drift = financial reporting error
      severity:   Math.abs(loan.emisPaid - onChain.emisPaid) > 1 ? 'HIGH' : 'MEDIUM',
    })
  }

  return findings
}

/**
 * Persist a drift finding, deduplicating against open alerts.
 */
async function recordDrift(loanId: string, finding: DriftFinding): Promise<void> {
  const existing = await prisma.driftAlert.findFirst({
    where: {
      loanId,
      field:    finding.field,
      resolved: false,
    },
  })
  if (existing) {
    // Already flagged & open — don't spam the table.
    return
  }
  await prisma.driftAlert.create({
    data: { loanId, ...finding },
  })
  logger.warn({ loanId, ...finding }, '🚨 Drift detected')
}

/**
 * One reconciliation pass over the active-loan portfolio.
 */
export async function runReconcile(): Promise<{ scanned: number; drift: number }> {
  // Only loans that are on-chain and still mutable need reconciliation.
  const loans = await prisma.loan.findMany({
    where: {
      isSyncedOnChain: true,
      status: { in: ['APPROVED', 'ACTIVE'] },
    },
    select: {
      id: true,
      contractLoanId: true,
      status: true,
      emisPaid: true,
      isSyncedOnChain: true,
    },
    take: RECONCILE_BATCH,
  })

  let drift = 0
  for (const loan of loans) {
    try {
      const findings = await reconcileLoan(loan)
      for (const f of findings) {
        await recordDrift(loan.id, f)
        drift++
      }
    } catch (err) {
      logger.error({ err, loanId: loan.id }, 'Reconcile failed for loan')
    }
  }
  return { scanned: loans.length, drift }
}

/**
 * Register the cron schedule. Called once at bootstrap.
 */
export function startReconcileJob(): void {
  if (process.env.DEMO_MODE === 'true') {
    logger.info('✅ [DEMO] Reconcile cron job mocked.')
    return
  }
  cron.schedule(RECONCILE_CRON, async () => {
    const start = Date.now()
    try {
      const { scanned, drift } = await runReconcile()
      logger.info(
        { scanned, drift, durationMs: Date.now() - start },
        '✅ Reconcile pass complete',
      )
    } catch (err) {
      logger.error({ err }, '🚨 Reconcile pass failed')
    }
  })
  logger.info(`✅ Reconcile job registered (cron: ${RECONCILE_CRON})`)
}
