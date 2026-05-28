/**
 * Backfill ledger entries for existing approved investments
 * Also removes duplicate funding requests (keeps latest per SHG)
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ log: ['warn'] })

async function main() {
  console.log('=== Step 1: Remove duplicate funding requests ===')

  // Find all funding requests grouped by shgId, keep only the latest per SHG
  const allRequests = await (prisma as any).groupFundingRequest.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const seenSHGs = new Set<string>()
  const toDelete: string[] = []

  for (const req of allRequests) {
    if (seenSHGs.has(req.shgId)) {
      toDelete.push(req.id)
    } else {
      seenSHGs.add(req.shgId)
    }
  }

  if (toDelete.length > 0) {
    // Delete investments for duplicate requests first
    await (prisma as any).lenderInvestment.deleteMany({
      where: { fundingRequestId: { in: toDelete } },
    })
    await (prisma as any).groupFundingRequest.deleteMany({
      where: { id: { in: toDelete } },
    })
    console.log(`  ✅ Deleted ${toDelete.length} duplicate funding requests`)
  } else {
    console.log('  ✅ No duplicates found')
  }

  console.log('\n=== Step 2: Backfill ledger entries for approved investments ===')

  // Get all remaining approved investments
  const investments = await (prisma as any).lenderInvestment.findMany({
    where: { status: 'APPROVED' },
    include: { fundingRequest: true },
  })

  let created = 0
  for (const inv of investments) {
    // Check if ledger entry already exists for this investment
    const existing = await prisma.ledgerEntry.findFirst({
      where: {
        ref: `INVESTMENT-${inv.id}`,
      },
    })

    if (!existing) {
      await prisma.$transaction(async (tx) => {
        const amountPaise = Math.round(Number(inv.amount) * 100)

        // Running balance for SHG
        const shgSum = await tx.ledgerEntry.aggregate({
          where: { entityType: 'SHG', entityId: inv.shgId },
          _sum: { amountPaise: true },
        })
        const shgBalance = (shgSum._sum.amountPaise ?? 0) + amountPaise

        await tx.ledgerEntry.create({
          data: {
            entityType: 'SHG',
            entityId: inv.shgId,
            type: 'LOAN_DISBURSAL',
            amountPaise,
            balancePaise: shgBalance,
            ref: `INVESTMENT-${inv.id}`,
          },
        })

        // Running balance for lender USER
        const userSum = await tx.ledgerEntry.aggregate({
          where: { entityType: 'USER', entityId: inv.lenderId },
          _sum: { amountPaise: true },
        })
        const userBalance = (userSum._sum.amountPaise ?? 0) + (-amountPaise)

        await tx.ledgerEntry.create({
          data: {
            entityType: 'USER',
            entityId: inv.lenderId,
            type: 'LENDER_DEPOSIT',
            amountPaise: -amountPaise,
            balancePaise: userBalance,
            ref: `INVESTMENT-${inv.id}`,
          },
        })
      })
      created++
      console.log(`  ✅ Created ledger entries for investment ${inv.id} — ₹${inv.amount} → SHG ${inv.shgId}`)
    } else {
      console.log(`  ⏭️  Ledger entry already exists for investment ${inv.id}`)
    }
  }

  console.log(`\n=== Done: ${created} new ledger entry pairs created ===`)

  // Verify
  const ledger = await prisma.ledgerEntry.findMany({
    where: { entityType: 'SHG' },
  })
  console.log('\n=== SHG Ledger Summary ===')
  for (const entry of ledger) {
    console.log(`  SHG ${entry.entityId}: ${entry.type} ₹${entry.amountPaise / 100}`)
  }

  await prisma.$disconnect()
}

main().catch(console.error)
