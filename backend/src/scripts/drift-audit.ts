/**
 * Blockchain Drift Audit Script — GramChain
 *
 * Usage: npx ts-node src/scripts/drift-audit.ts
 *
 * Compares DB loan states against on-chain loan states and reports any discrepancies.
 * Run this periodically (e.g. weekly cron) or after incidents to detect drift.
 *
 * Output:
 *   - Loans in DB with no contractLoanId (never synced)
 *   - Loans where DB status !== chain status
 *   - Loans where DB emisPaid !== chain emisPaid
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { getLoanFromChain } from '../services/blockchain.service'

const prisma = new PrismaClient()

const LOAN_STATUS_MAP: Record<number, string> = {
  0: 'PENDING',
  1: 'APPROVED',
  2: 'ACTIVE',
  3: 'REPAID',
  4: 'DEFAULTED',
}

async function runAudit() {
  console.log('\n🔍 GramChain Blockchain Drift Audit\n' + '='.repeat(50))

  const loans = await prisma.loan.findMany({
    select: {
      id: true,
      contractLoanId: true,
      isSyncedOnChain: true,
      status: true,
      emisPaid: true,
      amount: true,
      memberId: true,
    },
  })

  console.log(`Total loans in DB: ${loans.length}`)

  const results = {
    neverSynced: [] as any[],
    statusDrift: [] as any[],
    emisPaidDrift: [] as any[],
    ok: 0,
  }

  for (const loan of loans) {
    if (!loan.contractLoanId || !loan.isSyncedOnChain) {
      results.neverSynced.push({ dbLoanId: loan.id, status: loan.status })
      continue
    }

    try {
      const chainLoan = await getLoanFromChain(loan.contractLoanId)
      if (!chainLoan) {
        console.warn(`  ⚠️  contractLoanId ${loan.contractLoanId} not found on-chain`)
        results.statusDrift.push({
          dbLoanId: loan.id,
          contractLoanId: loan.contractLoanId,
          issue: 'Not found on-chain',
        })
        continue
      }

      const chainStatus = LOAN_STATUS_MAP[chainLoan.status] ?? 'UNKNOWN'
      const statusMatch = loan.status === chainStatus
      const emisMatch = loan.emisPaid === chainLoan.emisPaid

      if (!statusMatch) {
        results.statusDrift.push({
          dbLoanId: loan.id,
          contractLoanId: loan.contractLoanId,
          dbStatus: loan.status,
          chainStatus,
        })
      }

      if (!emisMatch) {
        results.emisPaidDrift.push({
          dbLoanId: loan.id,
          contractLoanId: loan.contractLoanId,
          dbEmisPaid: loan.emisPaid,
          chainEmisPaid: chainLoan.emisPaid,
        })
      }

      if (statusMatch && emisMatch) {
        results.ok++
      }
    } catch (err) {
      console.error(`  ❌ Failed to check loan ${loan.id}:`, err)
    }
  }

  // ── Report ────────────────────────────────────────────────────────
  console.log('\n📊 AUDIT RESULTS\n' + '-'.repeat(40))

  if (results.neverSynced.length > 0) {
    console.log(`\n🔴 Never synced to chain (${results.neverSynced.length}):`)
    results.neverSynced.forEach((l) => console.log(`  DB: ${l.dbLoanId} [${l.status}]`))
  }

  if (results.statusDrift.length > 0) {
    console.log(`\n🟠 Status drift (${results.statusDrift.length}):`)
    results.statusDrift.forEach((l) =>
      console.log(
        `  DB: ${l.dbLoanId} | chain#${l.contractLoanId} | DB=${l.dbStatus} Chain=${l.chainStatus}`
      )
    )
  }

  if (results.emisPaidDrift.length > 0) {
    console.log(`\n🟡 EMI count drift (${results.emisPaidDrift.length}):`)
    results.emisPaidDrift.forEach((l) =>
      console.log(
        `  DB: ${l.dbLoanId} | chain#${l.contractLoanId} | DB=${l.dbEmisPaid} Chain=${l.chainEmisPaid}`
      )
    )
  }

  console.log(`\n✅ Clean loans: ${results.ok}`)
  console.log(
    `🚨 Total drifted: ${results.neverSynced.length + results.statusDrift.length + results.emisPaidDrift.length}\n`
  )

  await prisma.$disconnect()
}

runAudit().catch((err) => {
  console.error('Audit failed:', err)
  process.exit(1)
})
